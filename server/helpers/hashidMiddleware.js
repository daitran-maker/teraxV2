const hashidHelper = require('./hashidHelper');

function decodeObj(obj) {
  if (!obj || typeof obj !== 'object' || obj instanceof Date || Buffer.isBuffer(obj)) return obj;
  if (Array.isArray(obj)) {
    return obj.map(decodeObj);
  }
  const newObj = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && (key === 'id' || key.endsWith('_id') || key.endsWith('Id') || key === 'recordId' || key === 'record_id' || key === 'pkVal')) {
      newObj[key] = hashidHelper.decode(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      newObj[key] = decodeObj(val);
    } else {
      newObj[key] = val;
    }
  }
  return newObj;
}

function encodeObj(obj) {
  if (!obj || typeof obj !== 'object' || obj instanceof Date || Buffer.isBuffer(obj)) return obj;
  if (Array.isArray(obj)) {
    return obj.map(encodeObj);
  }
  const newObj = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'number' && (key === 'id' || key.endsWith('_id') || key.endsWith('Id') || key === 'recordId' || key === 'record_id')) {
      newObj[key] = hashidHelper.encode(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      newObj[key] = encodeObj(val);
    } else {
      newObj[key] = val;
    }
  }
  return newObj;
}

module.exports = (req, res, next) => {
  // Decode inputs
  if (req.params) {
    req.params = decodeObj(req.params);
  }
  if (req.query) {
    req.query = decodeObj(req.query);
  }
  if (req.body) {
    req.body = decodeObj(req.body);
  }

  // Intercept response json method to auto-encode IDs
  const originalJson = res.json;
  res.json = function(data) {
    if (data) {
      data = encodeObj(data);
    }
    return originalJson.call(this, data);
  };

  next();
};
