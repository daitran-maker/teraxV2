// Request actions (ACT-REQUEST-01..04) used by POST /api/actions/execute.
// MOVED verbatim from server/routes/actions.js (no logic change); `req.body.data` is passed in as `data`.
const { resolveStatusId } = require('../../../server/helpers/statuses');
const { ratingsDataSchema } = require('../../workflow/server/actions.helpers');

async function changeSrOwner({ client, record, record_id, user, action_id, data }) {
    const { sr_owner } = data || {};
    if (!sr_owner) throw new Error("Vui lòng cung cấp SR Owner mới");
    // sr_owner from frontend is an array of emails
    const newOwnerArr = Array.isArray(sr_owner) ? sr_owner : [sr_owner];
    const oldOwnerArr = Array.isArray(record.sr_owner) ? record.sr_owner : (record.sr_owner ? [record.sr_owner] : []);
    const tzTimeStr = new Date().toISOString();
    const logEntry = {
      timestamp: tzTimeStr,
      user: user.employee_id,
      action: `changed SR Owner from [${oldOwnerArr.join(', ')}] to [${newOwnerArr.join(', ')}]`,
      old_owner: oldOwnerArr,
      new_owner: newOwnerArr,
      changes: { sr_owner: { old: oldOwnerArr, new: newOwnerArr } }
    };
    await client.query(
      `UPDATE request SET sr_owner = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
      [record_id, newOwnerArr, JSON.stringify([logEntry])]
    );
}

async function updateElements({ client, record, record_id, user, action_id, data }) {
    const { elements } = data || {};
    if (!elements) throw new Error("Vui lòng cung cấp thành phần mới");
    let elementArr = [];
    if (Array.isArray(elements)) {
      elementArr = elements;
    } else if (typeof elements === 'string') {
      elementArr = elements.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
    }
    const tzTimeStr = new Date().toISOString();
    const logEntry = {
      timestamp: tzTimeStr,
      user: user.employee_id,
      action: 'updated elements',
      changes: { elements: { old: record.elements, new: elementArr } }
    };
    await client.query(
      `UPDATE request SET elements = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
      [record_id, elementArr, JSON.stringify([logEntry])]
    );
}

async function rateRequest({ client, record, record_id, user, action_id, data }) {
    const dataParse = ratingsDataSchema.safeParse(data);
    if (!dataParse.success) {
      const issues = dataParse.error.issues || dataParse.error.errors || [];
      throw new Error("Dữ liệu đánh giá không hợp lệ: " + issues.map(e => e.message).join(', '));
    }
    const ratings = dataParse.data.ratings;

    for (const r of ratings) {
      if (r.point <= 3 && !r.comment.trim()) {
        throw new Error(`Vui lòng nhập lý do đánh giá thấp cho nhân viên ${r.to_user}`);
      }
    }

    if (action_id === 'ACT-REQUEST-03-RE') {
      await client.query(
        `DELETE FROM request_rating WHERE request_id = $1 AND from_user = $2`,
        [record_id, user.employee_id]
      );
    }

    for (const r of ratings) {
      await client.query(
        `INSERT INTO request_rating (request_id, from_user, to_user, point, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [record_id, user.employee_id, r.to_user, r.point, r.comment]
      );
    }

    const avgRes = await client.query(
      `SELECT AVG(point)::numeric(3,2) as avg_point, COUNT(*)::int as cnt 
       FROM request_rating 
       WHERE request_id = $1 AND deleted_at IS NULL`,
      [record_id]
    );
    const avgPoint = avgRes.rows[0]?.avg_point ? parseFloat(avgRes.rows[0].avg_point) : 5.0;
    const count = avgRes.rows[0]?.cnt || 0;

    const ratingSummary = {
      point: avgPoint,
      count: count,
      last_updated: new Date().toISOString()
    };

    await client.query(
      `UPDATE request 
       SET rating = $2::jsonb, 
           sr_status = 5, 
           process_status = 9,
           sr_close_date = COALESCE(sr_close_date, CURRENT_TIMESTAMP)
       WHERE request_id = $1`,
      [record_id, JSON.stringify(ratingSummary)]
    );
}

async function updateProcessStatus({ client, record, record_id, user, action_id, data }) {
    const { process_status: processStatusStr } = data || {};
    const allowedProcessStatuses = ['Not started yet', 'Processing', 'Completed'];
    if (processStatusStr && !allowedProcessStatuses.includes(processStatusStr)) {
      throw new Error("Process Status không hợp lệ");
    }
    if (!processStatusStr) throw new Error("Vui lòng cung cấp Process Status");
    const process_status = resolveStatusId('request', 'process_status', processStatusStr);
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `updated process status to ${processStatusStr}` };
    await client.query(`UPDATE request SET process_status = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`, [record_id, process_status, JSON.stringify([logEntry])]);
}

module.exports = { changeSrOwner, updateElements, rateRequest, updateProcessStatus };
