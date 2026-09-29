const service = require('./asset.service');
const repo = require('./asset.repository');

class AssetHandler {
  async beforeInsert(req, data) {
    return data;
  }

  async beforeUpdate(req, id, data) {
    return data;
  }
}

module.exports = new AssetHandler();
