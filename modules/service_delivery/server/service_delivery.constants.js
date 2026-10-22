// Constants & pure helpers for the Service Delivery Contract (SDC) approval flow.

// Policy / request_type used for the SDC approval request (no elements, summary comment only).
const SDC_APPROVAL_PROCESS_ID = 'RSDC_service_delivery';

const SDC_STATUS = {
  NOT_STARTED: 1,
  ON_GOING: 2,
  GOING_TO_EXPIRE: 3,
  COMPLETED: 4,
  EXPIRED: 5,
  NO_TASK_CREATED: 6,
  CANCELED: 7,
  DRAFT: 10,
  WAITING_FOR_APPROVAL: 11,
  ON_HOLD: 22
};

// Contract is flagged "Going to expire" when this many days (or fewer) remain until end_date.
const GOING_TO_EXPIRE_DAYS = 30;

// Statuses that are managed automatically from start_date / end_date after approval.
const AUTO_RUNNING_STATUSES = [
  SDC_STATUS.NOT_STARTED,
  SDC_STATUS.ON_GOING,
  SDC_STATUS.GOING_TO_EXPIRE,
  SDC_STATUS.EXPIRED
];

// SDC is "locked" (no Service Task Request may be added) until it is approved.
function isLockedStatus(status) {
  const s = Number(status);
  return s === SDC_STATUS.DRAFT || s === SDC_STATUS.WAITING_FOR_APPROVAL;
}

// SDC can only be edited / deleted while Draft.
function isEditableStatus(status) {
  return Number(status) === SDC_STATUS.DRAFT;
}

function toUtcDay(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    // pg returns DATE as local-midnight Date objects: use local Y/M/D
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Running status derived from the contract period.
 * today < start -> Not started yet; today > end -> Expired;
 * remaining <= GOING_TO_EXPIRE_DAYS -> Going to expire; otherwise On going.
 */
function computeRunningStatus(startDate, endDate, today = new Date()) {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (start === null || end === null) return SDC_STATUS.NOT_STARTED;
  if (now < start) return SDC_STATUS.NOT_STARTED;
  if (now > end) return SDC_STATUS.EXPIRED;
  const remainingDays = Math.round((end - now) / 86400000);
  if (remainingDays <= GOING_TO_EXPIRE_DAYS) return SDC_STATUS.GOING_TO_EXPIRE;
  return SDC_STATUS.ON_GOING;
}

module.exports = {
  SDC_APPROVAL_PROCESS_ID,
  SDC_STATUS,
  GOING_TO_EXPIRE_DAYS,
  AUTO_RUNNING_STATUSES,
  isLockedStatus,
  isEditableStatus,
  computeRunningStatus
};
