const repo = require('./contract.repository');

class ContractService {
  /**
   * Validate business rules for contract payload
   */
  validateContractData(data, isEdit = false, oldRecord = null) {
    const effectiveSignedDate = data.contract_signed_date !== undefined ? data.contract_signed_date : (oldRecord && oldRecord.contract_signed_date);
    const effectiveContractNo = data.contractspood_no !== undefined ? data.contractspood_no : (oldRecord && oldRecord.contractspood_no);
    const hasSignedDate = effectiveSignedDate && String(effectiveSignedDate).trim() !== '';
    const hasContractNo = effectiveContractNo && String(effectiveContractNo).trim() !== '';
    if (hasSignedDate && !hasContractNo) {
      throw new Error('Contract No (contractspood_no) is required when Signed Date is set.');
    }
    const effType = data.type !== undefined ? data.type : (oldRecord && oldRecord.type);
    if (effType !== undefined && Number(effType) === 71) {
      throw new Error('Contract type "Internal" is no longer supported. Please select Selling or Buying.');
    }
  }

  async getContract(id) {
    return await repo.findById(id);
  }

  async getContractsForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new ContractService();
