const repo = require('./asset.repository');

class AssetService {
  async getAsset(id) {
    return await repo.findById(id);
  }

  async getAssetsForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new AssetService();
