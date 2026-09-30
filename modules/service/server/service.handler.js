const service = require('./service.service');
const repo = require('./service.repository');

class ServiceHandler {
  async beforeInsert(req, data) {
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      if (end <= start) {
        throw new Error('End date must be greater than Start date (End Date phải sau Start Date).');
      }
    }
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord) {
    const startVal = data.start_date !== undefined ? data.start_date : (oldRecord ? oldRecord.start_date : null);
    const endVal = data.end_date !== undefined ? data.end_date : (oldRecord ? oldRecord.end_date : null);
    if (startVal && endVal) {
      const start = new Date(startVal);
      const end = new Date(endVal);
      if (end <= start) {
        throw new Error('End date must be greater than Start date (End Date phải sau Start Date).');
      }
    }
    return data;
  }
}

module.exports = new ServiceHandler();
