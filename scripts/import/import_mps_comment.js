/**
 * SCRIPT 4: Import MPS REQUEST_DETAIL → CRC COMMENT table
 *
 * DRY_RUN = true  → chỉ in preview, không touch DB
 * DRY_RUN = false → thực sự TRUNCATE + INSERT vào DB
 *
 * Key mappings:
 * - comment_id   = String(MPS.ID)                    e.g. "807804"
 * - request      = String(MPS.REQUEST__ID_REQUEST)   e.g. "197275"
 *                  matches request.request_id exactly
 * - comment      = MPS.COMMENT_REQUEST_DETAIL
 * - link         = MPS.ATTACH_LINK (mostly Google Drive links with files/images)
 * - comment_by   = MPS.COMMENT_BY__EMPLOYEE (null in current export → fill later)
 * - comment_date = MPS.COMMENT_DATE
 * - reply_to     = String(MPS.REPLY_TO__REQUEST_DETAIL) (parent comment if exists)
 * - tag          = MPS.TO__EMPLOYEE (tagged/mentioned users, null in current export)
 *
 * Chạy: node scripts/import/import_mps_comment.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // ← đổi thành false khi muốn import thật

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`COMMENT (REQUEST_DETAIL) IMPORT — DRY_RUN=${DRY_RUN}`);
  console.log('='.repeat(60));

  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json or data/mymps.json!');
  }
  const mymps = JSON.parse(raw);

  // Initialize employee UUID to Email mapping
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  const uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });
  console.log(`Built employee UUID mapping: ${uuidToEmailMap.size} resolved employees.`);

  function resolveEmp(val) {
    if (!val) return null;
    const clean = String(val).toUpperCase().trim();
    if (uuidToEmailMap.has(clean)) {
      return uuidToEmailMap.get(clean);
    }
    return val; // Fallback
  }

  const detailRows = mymps.tables['REQUEST_DETAIL']?.rows || [];
  console.log(`Total MPS request details (comments): ${detailRows.length}`);

  // Fetch valid request IDs from the request table to avoid FK violations
  console.log('Fetching active Request IDs from DB to ensure integrity...');
  let validRequestIds = new Set();
  try {
    const res = await pool.query('SELECT request_id FROM request');
    validRequestIds = new Set(res.rows.map(r => r.request_id));
    console.log(`Found ${validRequestIds.size} valid request IDs in target database.`);
  } catch (e) {
    console.log('⚠️ Could not check target request table (maybe empty or connection issue).');
    console.log('We will skip the FK check for dry-run.');
  }

  // Build mapped rows
  const mapped = detailRows.map(r => {
    const reqId = String(r.REQUEST__ID_REQUEST);
    const isValidReq = validRequestIds.size === 0 || validRequestIds.has(reqId);

    return {
      comment_id: String(r.ID),
      request: reqId,
      comment: r.COMMENT_REQUEST_DETAIL || '',
      link: r.ATTACH_LINK || null,
      file: null, // Files are generally stored as links or drive links in this export
      comment_by: resolveEmp(r['COMMENT_BY__EMPLOYEE']),
      comment_date: r.COMMENT_DATE ? new Date(r.COMMENT_DATE) : null,
      reply_to: r.REPLY_TO__REQUEST_DETAIL ? String(r.REPLY_TO__REQUEST_DETAIL) : null,
      tag: resolveEmp(r['TO__EMPLOYEE']),
      
      // Metadata
      created_by: resolveEmp(r['COMMENT_BY__EMPLOYEE']) || 'mps_import',
      created_date: r.COMMENT_DATE ? new Date(r.COMMENT_DATE) : new Date(),
      isValidRequest: isValidReq
    };
  });

  // Filter out comments pointing to non-existent requests
  const importable = mapped.filter(r => r.isValidRequest);
  const skipped = mapped.length - importable.length;

  console.log(`Importable comments (request exists in DB): ${importable.length}`);
  console.log(`Skipped comments (request not found in DB): ${skipped}`);

  // Preview - use mapped (all) if importable is empty, so user can see what they look like
  const previewList = importable.length > 0 ? importable : mapped;
  console.log('\n===== SAMPLE (first 3 rows) =====');
  previewList.slice(0, 3).forEach((r, i) => {
    const preview = { ...r };
    delete preview.isValidRequest;
    console.log(`[${i}]`, JSON.stringify(preview, null, 2));
  });

  // Stats
  const hasLink = previewList.filter(r => r.link).length;
  const hasReply = previewList.filter(r => r.reply_to).length;
  console.log(`\n===== STATS =====`);
  console.log(`Comments with attachment links (drive/images): ${hasLink} (${Math.round(hasLink/previewList.length*100)}%)`);
  console.log(`Replies to other comments:                     ${hasReply} (${Math.round(hasReply/previewList.length*100)}%)`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    console.log('   Set DRY_RUN=false to execute.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING comment table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: "comment"');
  } else {
    await pool.query('TRUNCATE TABLE "comment" CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting comments (batch of 200)...');
  
  // Sort comments so parents are inserted before children to avoid self-referencing FK issues
  // Comments with null reply_to go first, then others
  const sortedImport = [...importable].sort((a, b) => {
    if (a.reply_to === null && b.reply_to !== null) return -1;
    if (a.reply_to !== null && b.reply_to === null) return 1;
    return 0;
  });

  let inserted = 0;
  let failed = 0;
  const BATCH = 200;

  for (let i = 0; i < sortedImport.length; i += BATCH) {
    const batch = sortedImport.slice(i, i + BATCH);
    for (const r of batch) {
      try {
        await pool.query(`
          INSERT INTO "comment" (
            comment_id, request, comment, file, link,
            comment_by, comment_date, reply_to, tag,
            created_by, created_date
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11
          ) ON CONFLICT (comment_id) DO NOTHING
        `, [
          r.comment_id, r.request, r.comment, r.file, r.link,
          r.comment_by, r.comment_date, r.reply_to, r.tag,
          r.created_by, r.created_date
        ]);
        inserted++;
      } catch (e) {
        // If reply_to FK fails (parent didn't exist in original database), retry with reply_to set to null
        if (e.message.includes('foreign key constraint')) {
          try {
            await pool.query(`
              INSERT INTO "comment" (
                comment_id, request, comment, file, link,
                comment_by, comment_date, reply_to, tag,
                created_by, created_date
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, NULL, $9,
                $10, $11
              ) ON CONFLICT (comment_id) DO NOTHING
            `, [
              r.comment_id, r.request, r.comment, r.file, r.link,
              r.comment_by, r.comment_date, r.tag,
              r.created_by, r.created_date
            ]);
            inserted++;
            continue;
          } catch (retryErr) {
            console.error(`  ❌ Failed [${r.comment_id}] retry:`, retryErr.message);
          }
        } else {
          console.error(`  ❌ Failed [${r.comment_id}]:`, e.message);
        }
        failed++;
      }
    }
    if ((i / BATCH) % 5 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH, sortedImport.length)}/${sortedImport.length}...`);
    }
  }

  console.log(`\n✅ DONE: ${inserted} inserted, ${failed} failed out of ${sortedImport.length} comments.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
