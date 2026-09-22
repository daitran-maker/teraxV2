const repo = require('./contract.repository');

class ContractService {
  /**
   * Validate business rules for contract payload
   */
  validateContractData(data, isEdit = false) {
    const hasSignedDate = (data.contract_signed_date && String(data.contract_signed_date).trim() !== '') || (data.signed_date && String(data.signed_date).trim() !== '');
    const hasContractNo = (data.contractspood_no && String(data.contractspood_no).trim() !== '') || (data.contract_no && String(data.contract_no).trim() !== '');
    if (hasSignedDate && !hasContractNo) {
      throw new Error('Contract No (contractspood_no) is required when Signed Date is set.');
    }
    if (Number(data.type) === 71) {
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
