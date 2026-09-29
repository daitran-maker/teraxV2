const Hashids = require('hashids/cjs');

const salt = process.env.HASHIDS_SALT || 'crc_default_secret_salt_12345';
const minLength = 10;
const hashids = new Hashids(salt, minLength);

// Check if a string is a valid UUID to avoid attempting to decode it
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encode(val) {
  // If already a string or undefined/null
  if (val === null || val === undefined) return val;
  
  // Try to parse to int
  const num = Number(val);
  if (Number.isInteger(num) && num >= 0) {
    return hashids.encode(num);
  }
  return val;
}

function decode(hash) {
  if (typeof hash !== 'string' && typeof hash !== 'number') return hash;
  if (typeof hash === 'number') return hash;
  if (hash.includes('@') || uuidRegex.test(hash) || hash.trim() === '') {
    return hash;
  }
  if (/^\d+$/.test(hash)) {
    return parseInt(hash, 10);
  }
  try {
    const decoded = hashids.decode(hash);
    if (decoded && decoded.length > 0) {
      return decoded[0];
    }
  } catch (err) {
    // Ignore and return original hash if decoding fails
  }
  return hash;
}

module.exports = {
  encode,
  decode
};
