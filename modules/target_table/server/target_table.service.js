const repo = require('./target_table.repository');
const { broadcastSSE } = require('../../../server/helpers/sseHelper');

class TargetTableService {
  async getTargetTable(id) {
    return await repo.findById(id);
  }

  async getTargetTablesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }

  isUserAuthorizedOnRequest(requestRow, user) {
    if (!requestRow || !user) return false;
    const uId = (user.employee_id || '').toLowerCase();
    const uEmail = (user.email || '').toLowerCase();
    const requester = (requestRow.requester || '').toLowerCase();
    const srCreater = (requestRow.sr_creater || '').toLowerCase();
    const policyLead = (requestRow.policy_lead || '').toLowerCase();
    const srOwnerArr = Array.isArray(requestRow.sr_owner)
      ? requestRow.sr_owner.map(s => String(s).toLowerCase())
      : (requestRow.sr_owner ? [String(requestRow.sr_owner).toLowerCase()] : []);

    return (
      (uId && (requester === uId || srCreater === uId || policyLead === uId || srOwnerArr.includes(uId))) ||
      (uEmail && (requester === uEmail || srCreater === uEmail || policyLead === uEmail || srOwnerArr.includes(uEmail)))
    );
  }

  async canUserAddTargetRecord(user, tableName, requestId = null, targetTableId = null) {
    const targetTablesToCheck = ['employee', 'my_company', 'company', 'asset', 'service', 'contact', 'policy', 'policy_and_program'];
    const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
    if (!targetTablesToCheck.includes(checkTable)) return { allowed: false };

    try {
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Add',
        requestId,
        targetTableId
      });

      for (const config of activeConfigs) {
        if (this.isUserAuthorizedOnRequest(config, user)) {
          return {
            allowed: true,
            targetTableId: config.target_table_id,
            requestId: config.request
          };
        }
      }
    } catch (err) {
      console.error('[TargetTableService.canUserAddTargetRecord error]', err);
    }
    return { allowed: false };
  }

  async canUserEditTargetRecord(user, tableName, recordId) {
    const targetTablesToCheck = ['employee', 'my_company', 'company', 'asset', 'service', 'contact', 'policy', 'policy_and_program'];
    const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
    if (!targetTablesToCheck.includes(checkTable)) return { allowed: false };

    try {
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Edit',
        recordId: String(recordId)
      });

      for (const config of activeConfigs) {
        if (this.isUserAuthorizedOnRequest(config, user)) {
          return {
            allowed: true,
            targetTableId: config.target_table_id,
            requestId: config.request
          };
        }
      }
    } catch (err) {
      console.error('[TargetTableService.canUserEditTargetRecord error]', err);
    }
    return { allowed: false };
  }

  async canUserDeleteTargetRecord(user, tableName, recordId) {
    const targetTablesToCheck = ['employee', 'my_company', 'company', 'asset', 'service', 'contact', 'policy', 'policy_and_program'];
    const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
    if (!targetTablesToCheck.includes(checkTable)) return { allowed: false };

    try {
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Delete',
        recordId: String(recordId)
      });

      for (const config of activeConfigs) {
        if (this.isUserAuthorizedOnRequest(config, user)) {
          return {
            allowed: true,
            targetTableId: config.target_table_id,
            requestId: config.request
          };
        }
      }
    } catch (err) {
      console.error('[TargetTableService.canUserDeleteTargetRecord error]', err);
    }
    return { allowed: false };
  }

  async onRecordAdded(tableName, recordId, userEmployeeId, requestId = null, targetTableId = null) {
    try {
      const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Add',
        requestId,
        targetTableId
      });

      for (const config of activeConfigs) {
        const updated = await repo.appendRecordAndLog(config.target_table_id, recordId, 'Add', userEmployeeId);
        if (updated) {
          try {
            broadcastSSE('db_change', {
              action: 'update',
              table: 'target_table',
              id: config.target_table_id,
              record: updated
            });
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[TargetTableService.onRecordAdded error]', err);
    }
  }

  async onRecordEdited(tableName, recordId, userEmployeeId) {
    try {
      const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Edit',
        recordId: String(recordId)
      });

      for (const config of activeConfigs) {
        const updated = await repo.updateLogOnly(config.target_table_id, recordId, 'Edit', userEmployeeId);
        if (updated) {
          try {
            broadcastSSE('db_change', {
              action: 'update',
              table: 'target_table',
              id: config.target_table_id,
              record: updated
            });
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[TargetTableService.onRecordEdited error]', err);
    }
  }

  async onRecordDeleted(tableName, recordId, userEmployeeId) {
    try {
      const checkTable = tableName === 'policy_and_program' ? 'policy' : tableName;
      const activeConfigs = await repo.findActiveConfigs({
        tableName: checkTable,
        actionType: 'Delete',
        recordId: String(recordId)
      });

      for (const config of activeConfigs) {
        const updated = await repo.updateLogOnly(config.target_table_id, recordId, 'Delete', userEmployeeId);
        if (updated) {
          try {
            broadcastSSE('db_change', {
              action: 'update',
              table: 'target_table',
              id: config.target_table_id,
              record: updated
            });
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[TargetTableService.onRecordDeleted error]', err);
    }
  }
}

module.exports = new TargetTableService();
