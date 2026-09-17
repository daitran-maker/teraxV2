const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Create table if not exists
async function ensureCmsTenantTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "cms_tenant_info" (
      "id" SERIAL PRIMARY KEY,
      "tenant_domain" TEXT UNIQUE NOT NULL,
      "tenant_api_key" TEXT NOT NULL,
      "customer_id" TEXT,
      "plan_id" TEXT,
      "plan_name" TEXT,
      "billing_status" TEXT,
      "next_payment_date" DATE,
      "super_admin_email" TEXT,
      "subscription_start_date" DATE,
      "subscription_status" TEXT,
      "last_billing_amount" NUMERIC(15,2),
      "last_sync_signature" TEXT,
      "last_sync_timestamp" BIGINT,
      "user_limit" INTEGER,
      "features" JSONB DEFAULT '{}',
      "base_currency" TEXT DEFAULT 'VND',
      "company_name" TEXT,
      "logo" TEXT,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    ALTER TABLE "cms_tenant_info" ADD COLUMN IF NOT EXISTS "user_limit" INTEGER;
    ALTER TABLE "cms_tenant_info" ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT '{}';
    ALTER TABLE "cms_tenant_info" ADD COLUMN IF NOT EXISTS "base_currency" TEXT;
    ALTER TABLE "cms_tenant_info" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
    ALTER TABLE "cms_tenant_info" ADD COLUMN IF NOT EXISTS "logo" TEXT;
  `);
}
ensureCmsTenantTable().catch(err => {
  console.error('Error creating cms_tenant_info table at startup:', err);
});

// Validate CMS_HMAC_SECRET at startup — no fallback allowed
const CMS_HMAC_SECRET = process.env.CMS_HMAC_SECRET;
if (!CMS_HMAC_SECRET) {
  throw new Error('FATAL ERROR: CMS_HMAC_SECRET is not defined in environment variables.');
}

// POST: Sync endpoint from CMS
router.post('/tenant-sync', async (req, res) => {
  const signature = req.headers['x-cms-signature'];
  const timestamp = req.headers['x-cms-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing sync headers' });
  }

  // Reject if timestamp is older than 5 minutes to prevent replay attacks
  const diff = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp));
  if (isNaN(diff) || diff > 300) {
    return res.status(401).json({ error: 'Timestamp expired or invalid' });
  }

  const bodyCopy = { ...req.body };
  const strPayload = JSON.stringify(bodyCopy);
  const expectedSignature = crypto.createHmac('sha256', CMS_HMAC_SECRET).update(strPayload).digest('hex');

  try {
    const isMatched = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
    if (!isMatched) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // Signature valid! Update or insert into cms_tenant_info
  const {
    tenant_domain,
    tenant_api_key,
    customer_id,
    plan_id,
    plan_name,
    billing_status,
    next_payment_date,
    super_admin_email,
    subscription_start_date,
    subscription_status,
    last_billing_amount,
    user_limit,
    features,
    base_currency,
    company_name,
    logo
  } = req.body;

  try {
    await ensureCmsTenantTable();

    await pool.query(`
      INSERT INTO "cms_tenant_info" (
        tenant_domain, tenant_api_key, customer_id, plan_id, plan_name, 
        billing_status, next_payment_date, super_admin_email, 
        subscription_start_date, subscription_status, last_billing_amount,
        last_sync_signature, last_sync_timestamp, user_limit, features,
        base_currency, company_name, logo, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_domain) DO UPDATE SET
        tenant_api_key = EXCLUDED.tenant_api_key,
        customer_id = EXCLUDED.customer_id,
        plan_id = EXCLUDED.plan_id,
        plan_name = EXCLUDED.plan_name,
        billing_status = EXCLUDED.billing_status,
        next_payment_date = EXCLUDED.next_payment_date,
        super_admin_email = EXCLUDED.super_admin_email,
        subscription_start_date = EXCLUDED.subscription_start_date,
        subscription_status = EXCLUDED.subscription_status,
        last_billing_amount = EXCLUDED.last_billing_amount,
        last_sync_signature = EXCLUDED.last_sync_signature,
        last_sync_timestamp = EXCLUDED.last_sync_timestamp,
        user_limit = EXCLUDED.user_limit,
        features = EXCLUDED.features,
        base_currency = COALESCE(EXCLUDED.base_currency, cms_tenant_info.base_currency),
        company_name = COALESCE(EXCLUDED.company_name, cms_tenant_info.company_name),
        logo = COALESCE(EXCLUDED.logo, cms_tenant_info.logo),
        updated_at = CURRENT_TIMESTAMP
    `, [
      tenant_domain,
      tenant_api_key,
      customer_id,
      plan_id,
      plan_name,
      billing_status,
      next_payment_date ? next_payment_date.substring(0, 10) : null,
      super_admin_email,
      subscription_start_date ? subscription_start_date.substring(0, 10) : null,
      subscription_status,
      last_billing_amount,
      signature,
      parseInt(timestamp),
      user_limit !== undefined && user_limit !== null ? parseInt(user_limit, 10) : null,
      typeof features === 'string' ? features : JSON.stringify(features || {}),
      base_currency || null,
      company_name || null,
      logo || null
    ]);

    // ENFORCE SINGLE RECORD ISOLATION: delete all other tenant domains
    await pool.query('DELETE FROM "cms_tenant_info" WHERE tenant_domain <> $1', [tenant_domain]);

    res.json({ success: true, message: 'Tenant sync completed' });
  } catch (err) {
    console.error('Tenant sync database error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// ─── POST /init-tenant ────────────────────────────────────────────────────────
// Called by CMS after deploying a new CRC instance.
// Whitelists the super_admin credentials and synchronizes company branding & base currency.
router.post('/init-tenant', async (req, res) => {
  const signature = req.headers['x-cms-signature'];
  const timestamp = req.headers['x-cms-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing sync headers' });
  }

  const diff = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp));
  if (isNaN(diff) || diff > 300) {
    return res.status(401).json({ error: 'Timestamp expired or invalid' });
  }

  const strPayload = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', CMS_HMAC_SECRET).update(strPayload).digest('hex');

  try {
    const isMatched = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
    if (!isMatched) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const {
    super_admin_email,
    temp_password,
    username,
    company_name,
    company_shortname,
    logo,
    base_currency
  } = req.body;

  if (!super_admin_email && !username) {
    return res.status(400).json({ error: 'super_admin_email or username is required' });
  }

  const adminUsername = username || (super_admin_email ? super_admin_email.split('@')[0] : 'admin');
  const adminEmail = super_admin_email || `${adminUsername}@tenant.local`;
  const hashedPassword = temp_password ? await bcrypt.hash(temp_password, 10) : null;
  const compFullName = company_name || 'My Company';
  const compShortName = company_shortname || company_name || 'My Company';
  const compLogo = logo || null;
  const compCurrency = base_currency || 'VND';

  try {
    // 1. Ensure MY_COMPANY table exists & has necessary columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.my_company (
        my_company_id TEXT PRIMARY KEY,
        company_shortname TEXT,
        company_fullname TEXT,
        tax_code TEXT,
        website TEXT,
        address TEXT,
        country TEXT,
        province TEXT,
        city TEXT,
        state TEXT,
        base_currency TEXT,
        currency_list TEXT
      );
      ALTER TABLE public.my_company ADD COLUMN IF NOT EXISTS base_currency TEXT;
      ALTER TABLE public.my_company ADD COLUMN IF NOT EXISTS company_shortname TEXT;
      ALTER TABLE public.my_company ADD COLUMN IF NOT EXISTS company_fullname TEXT;
      ALTER TABLE public.my_company ADD COLUMN IF NOT EXISTS logo TEXT;
    `);

    // 2. Upsert primary company record with signup branding & base currency
    const existingComp = await pool.query('SELECT my_company_id FROM public.my_company ORDER BY my_company_id ASC LIMIT 1');
    let primaryCompanyId = '1';

    if (existingComp.rows.length > 0) {
      primaryCompanyId = existingComp.rows[0].my_company_id;
      await pool.query(`
        UPDATE public.my_company 
        SET company_fullname = $1,
            company_shortname = $2,
            base_currency = $3,
            logo = COALESCE($4, logo),
            status = COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67)
        WHERE my_company_id = $5
      `, [compFullName, compShortName, compCurrency, compLogo, primaryCompanyId]);
    } else {
      await pool.query(`
        INSERT INTO public.my_company (my_company_id, company_shortname, company_fullname, base_currency, logo, status)
        VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67))
      `, [primaryCompanyId, compShortName, compFullName, compCurrency, compLogo]);
    }


    // 3. Ensure EMPLOYEE table has required columns
    await pool.query(`
      ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
      ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
      ALTER TABLE public.employee ALTER COLUMN email DROP NOT NULL;
    `);

    // 4. Delete existing admin records first to prevent conflicts
    await pool.query('DELETE FROM "employee" WHERE email = $1 OR employee_id = \'EMP-001\'', [adminEmail]);

    // 5. Insert super admin record linked to primary company
    const { rows } = await pool.query(`
      INSERT INTO "employee" (employee_id, username, full_name, email, role, password, status, company_id)
      VALUES ('EMP-001', $1, 'Super Admin', $2, 'Super Admin', $3, (SELECT COALESCE((SELECT id FROM status_catalog WHERE table_name='employee' AND status_key='active' LIMIT 1), 17)), $4)
      RETURNING employee_id, username, email, role, status, company_id
    `, [adminUsername, adminEmail, hashedPassword, primaryCompanyId]);

    // 6. Ensure cms_tenant_info has company metadata
    try {
      await ensureCmsTenantTable();
      await pool.query(`
        UPDATE "cms_tenant_info"
        SET base_currency = COALESCE($1, base_currency),
            company_name = COALESCE($2, company_name),
            logo = COALESCE($3, logo)
      `, [compCurrency, compFullName, compLogo]);
    } catch (e) {
      console.warn('[CmsSync] Non-fatal cms_tenant_info update notice:', e.message);
    }

    console.log(`[CmsSync] ✅ init-tenant: Company "${compShortName}" (${compCurrency}) & Super admin initialized for ${adminUsername} / ${adminEmail}`);
    res.json({
      success: true,
      message: `Tenant initialized successfully with company ${compShortName} (${compCurrency}) and admin ${adminUsername}`,
      company: { id: primaryCompanyId, name: compFullName, base_currency: compCurrency, logo: compLogo },
      employee: rows[0]
    });

  } catch (err) {
    console.error('init-tenant error:', err);
    res.status(500).json({ error: 'Failed to initialize tenant admin & company data' });
  }
});

module.exports = router;
