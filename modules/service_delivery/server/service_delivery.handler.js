const { SDC_STATUS, isLockedStatus, isEditableStatus } = require('./service_delivery.constants');

const isSuperAdmin = (req) => !!(req && req.user && String(req.user.role || '').toUpperCase() === 'SUPER ADMIN');

/** Fiscal year ("yyyy") from a start date (calendar year); null when the date is missing/invalid. */
function fyFromStartDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const m = String(value).match(/^(\d{4})-\d{2}-\d{2}/);
  let year = m ? Number(m[1]) : (value instanceof Date || !isNaN(Date.parse(value)) ? new Date(value).getFullYear() : NaN);
  if (!Number.isFinite(year)) return null;
  return String(year);
}

class ServiceDeliveryHandler {
  async beforeInsert(req, data, client) {
    // Table is resolved from the data shape: STR has `service_delivery`, SDC has `service_scope`.
    if (data && Object.prototype.hasOwnProperty.call(data, 'service_delivery') && !Object.prototype.hasOwnProperty.call(data, 'service_scope')) {
      return this.beforeInsertTask(data, client);
    }
    // SDC: always starts as Draft and has to be submitted for approval.
    data.status = SDC_STATUS.DRAFT;
    data.id__approval_request = null;
    return data;
  }

  async beforeInsertTask(data, client) {
    // Task FY always follows its start date.
    const fy = fyFromStartDate(data.started_date);
    if (fy) data.fy = fy;
    const sdId = data.service_delivery;
    if (!sdId) return data;
    const res = await client.query(
      `SELECT status FROM service_delivery_contract WHERE id::text = $1 AND deleted_at IS NULL`,
      [String(sdId)]
    );
    if (res.rows.length > 0 && isLockedStatus(res.rows[0].status)) {
      throw new Error('Service Delivery Contract phải được duyệt trước khi thêm Service Task Request.');
    }
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord) {
    // Task: keep FY in sync with the start date.
    if (oldRecord && Object.prototype.hasOwnProperty.call(oldRecord, 'service_delivery') && !Object.prototype.hasOwnProperty.call(oldRecord, 'service_scope')) {
      if (data && Object.prototype.hasOwnProperty.call(data, 'started_date')) {
        const fy = fyFromStartDate(data.started_date);
        if (fy) data.fy = fy;
      }
      return data;
    }
    // Only SDC records carry `service_scope` / `id__approval_request`
    if (!oldRecord || !Object.prototype.hasOwnProperty.call(oldRecord, 'service_scope')) return data;
    if (isSuperAdmin(req)) return data;
    if (!isEditableStatus(oldRecord.status)) {
      throw new Error('Chỉ được sửa Service Delivery Contract khi ở trạng thái Draft.');
    }
    if (data && data.status !== undefined && data.status !== null && Number(data.status) !== Number(oldRecord.status)) {
      throw new Error('Trạng thái Service Delivery Contract được hệ thống quản lý theo luồng duyệt.');
    }
    return data;
  }
}

module.exports = new ServiceDeliveryHandler();
