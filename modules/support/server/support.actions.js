// Support ticket actions used by POST /api/actions/execute.
// MOVED verbatim from server/routes/actions.js (no logic change); `req.body.data` is passed in as `data`.

async function rateTicket({ client, record, record_id, user, action_id, data }) {
  const { rating } = data || {};
  if (!rating || typeof rating !== 'object' || !rating.point) {
    throw new Error("Vui lòng cung cấp đầy đủ thông tin Rating (điểm)");
  }
  const point = Number(rating.point);
  const comment = rating.comment || '';
  if (point < 3 && !comment.trim()) {
    throw new Error("Vui lòng nhập lý do đánh giá thấp");
  }
  const ratingObj = {
    point,
    comment,
    by: user.employee_id,
    at: new Date().toISOString()
  };
  const tzTimeStr = new Date().toISOString();
  const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `rated request: ${point} stars - ${comment}` };
  await client.query(
    `UPDATE ticket 
     SET rating = $2::jsonb, 
         sr_status = 13, 
         sr_close_date = CURRENT_TIMESTAMP, 
         log = COALESCE(log, '[]'::jsonb) || $3::jsonb 
     WHERE ticket_id = $1`,
    [record_id, JSON.stringify(ratingObj), JSON.stringify([logEntry])]
  );
}

async function cancelTicket({ client, record, record_id, user, action_id, data }) {
  const tzTimeStr = new Date().toISOString();
  const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'cancelled ticket' };
  await client.query(
    `UPDATE ticket SET sr_status = 118, process_status = 119, sr_close_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE ticket_id = $1`,
    [record_id, JSON.stringify([logEntry])]
  );
}

async function withdrawTicket({ client, record, record_id, user, action_id, data }) {
  let flow = null;
  try {
    flow = typeof record.processing_flow === 'string' ? JSON.parse(record.processing_flow) : JSON.parse(JSON.stringify(record.processing_flow || {}));
  } catch (e) {
    console.warn('Error parsing processing_flow:', e);
  }
  let logEntry = null;
  const tzTimeStr = new Date().toISOString();
  if (flow && flow.steps && flow.steps.length > 0) {
    flow.current_level = 1;
    flow.steps.forEach(step => {
      step.status = 'Not started yet';
      step.history = [];
    });
    logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'withdrew request' };
  } else {
    logEntry = { timestamp: new Date().toISOString(), user: user.employee_id, action: 'withdrew request' };
  }
  await client.query(
    `UPDATE ticket SET process_status = 120, processing_flow = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE ticket_id = $1`,
    [record_id, flow ? JSON.stringify(flow) : record.processing_flow, JSON.stringify([logEntry])]
  );
}

module.exports = {
  rateTicket,
  cancelTicket,
  withdrawTicket
};
