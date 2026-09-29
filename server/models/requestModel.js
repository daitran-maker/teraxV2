const pool = require('../db');

class RequestModel {
  /**
   * My Approval Slice:
   * Hiển thị request nếu user nằm trong 1 trong 3 tier.
   * Nếu user là tier 2 => tier 1 phải approved rồi.
   * Nếu user là tier 3 => tier 2 phải approved rồi.
   */
  static async getMyApprovals(userEmpId) {
    const query = `
      SELECT * FROM request
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(approval_flow->'steps') AS step
        WHERE LOWER(step->>'approver') = LOWER($1)
          AND step->>'status' = '2'
      )
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * My Request Slice:
   * Chỉ hiển thị nếu user là SR creater, requester, 
   * hoặc nằm trong list 'tag' của bảng "comment" thuộc request đó.
   */
  static async getMyRequests(userEmpId) {
    const query = `
      SELECT r.* FROM request r
      WHERE r.sr_creater = $1
         OR r.requester = $1
         OR EXISTS (
             SELECT 1 FROM "comment" rd
             WHERE rd.request = r.request_id 
               AND (rd.tag LIKE '%' || $1 || '%')
         )
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * resolveApprovals:
   * Xác định tier_1_approval dựa trên Policy và Requester.
   */
  static async resolveApprovals(data, client = pool) {
    if (!data.request_type || !data.requester) return;

    try {
      const policyRes = await client.query(
        'SELECT tier1_approval, tier2_approval, tier3_approval, policy_lead, sr_owner, approval_level, elements FROM policy_and_program WHERE policy_id = $1 OR policy_name = $1',
        [data.request_type]
      );

      if (policyRes.rows.length === 0) return;
      const policy = policyRes.rows[0];
      let t1Config = policy.tier1_approval;
      if (!t1Config || !t1Config.trim()) {
        const pLvl = (policy.approval_level || '').toLowerCase();
        if (!pLvl.includes('tier 0')) {
          t1Config = 'Direct manager';
        }
      }

      // Map policy_lead, sr_owner directly
      if (policy.policy_lead) data.policy_lead = policy.policy_lead;
      if (policy.sr_owner) {
        if (Array.isArray(policy.sr_owner)) {
          data.sr_owner = policy.sr_owner.map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        } else if (typeof policy.sr_owner === 'string') {
          data.sr_owner = policy.sr_owner.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        }
      }
      if (policy.elements) {
        data.elements = policy.elements;
      } else {
        data.elements = null;
      }

      let resolvedT1 = null;
      if (t1Config) {
        if (t1Config.toLowerCase() === 'direct manager') {
          const empRes = await client.query(
            'SELECT direct_manager FROM employee WHERE LOWER(email) = LOWER($1) OR LOWER(employee_id) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(full_name) = LOWER($1)',
            [data.requester]
          );
          if (empRes.rows.length > 0 && empRes.rows[0].direct_manager) {
            resolvedT1 = empRes.rows[0].direct_manager;
          }
        } else {
          resolvedT1 = t1Config;
        }
      }

      const t1Approval = resolvedT1 || policy.tier1_approval || null;
      const t2Approval = policy.tier2_approval || null;
      const t3Approval = policy.tier3_approval || null;

      // Determine if Non-Standard option is applicable
      let isNonStandardApplicable = false;
      let processTierLevel = 0;
      const pLevel = policy.approval_level || '';
      if (pLevel) {
        const lvlStr = pLevel.toLowerCase();
        if (lvlStr.includes('tier 3')) {
          processTierLevel = 3;
        } else if (lvlStr.includes('tier 2')) {
          processTierLevel = 2;
        } else if (lvlStr.includes('tier 1')) {
          processTierLevel = 1;
        } else if (lvlStr.includes('tier 0')) {
          processTierLevel = 0;
        }
      }
      
      let totalConfiguredTiers = 0;
      if (policy.tier3_approval && policy.tier3_approval.trim()) {
        totalConfiguredTiers = 3;
      } else if (policy.tier2_approval && policy.tier2_approval.trim()) {
        totalConfiguredTiers = 2;
      } else if (policy.tier1_approval && policy.tier1_approval.trim()) {
        totalConfiguredTiers = 1;
      }

      if (pLevel && !pLevel.toLowerCase().includes('tier 0') && processTierLevel < totalConfiguredTiers) {
        isNonStandardApplicable = true;
      }

      if (isNonStandardApplicable) {
        data.approval_level = data.approval_level || 'Standard';
      } else {
        data.approval_level = 'Standard';
      }

      // --- SETUP JSONB APPROVAL FLOW ---
      let max_tiers = 3; 
      
      const reqApprovalLevel = (data.approval_level || 'Standard').toLowerCase();
      
      if (reqApprovalLevel === 'standard') {
        if (policy.approval_level && policy.approval_level.toLowerCase().includes('tier 1')) {
           max_tiers = 1;
        } else if (policy.approval_level && policy.approval_level.toLowerCase().includes('tier 2')) {
           max_tiers = 2;
        } else if (policy.approval_level && policy.approval_level.toLowerCase().includes('tier 3')) {
           max_tiers = 3;
        } else if (policy.approval_level && policy.approval_level.toLowerCase().includes('tier 0')) {
           max_tiers = 0;
        }
      } else {
        max_tiers = 3;
      }

      const isSubmitted = Number(data.sr_status) === 2 || String(data.sr_status || '').toLowerCase().includes('submit') || String(data.sr_status || '').toLowerCase() === 'pending approval';

      const approverMap = {
        1: t1Approval,
        2: t2Approval,
        3: t3Approval
      };

      // Check if existing approval_flow exists to preserve progress
      let existingFlow = data.approval_flow;
      if (typeof existingFlow === 'string') {
        try { existingFlow = JSON.parse(existingFlow); } catch (e) { existingFlow = null; }
      }

      const steps = [];
      for (let i = 1; i <= max_tiers; i++) {
        const existingStep = (existingFlow && Array.isArray(existingFlow.steps)) ? existingFlow.steps.find(s => s.level === i) : null;
        let stepStatus = 7; // 7 = not_started

        if (existingStep && [3, '3', 'Approved', 'approved'].includes(existingStep.status)) {
          stepStatus = 3; // preserve approved
        } else if (existingStep && [4, '4', 'Rejected', 'rejected'].includes(existingStep.status)) {
          stepStatus = 4; // preserve rejected
        } else if (i === 1 && isSubmitted) {
          stepStatus = 2; // 2 = pending_approval
        } else if (existingStep && [2, '2', 'Pending Approval', 'pending_approval', 'pending'].includes(existingStep.status)) {
          stepStatus = 2;
        }

        steps.push({
          level: i,
          approver: approverMap[i] || (existingStep ? existingStep.approver : null),
          status: stepStatus,
          action_by: existingStep ? existingStep.action_by : null,
          action_date: existingStep ? existingStep.action_date : null
        });
      }

      // Calculate current_level based on step statuses
      let currentLevel = 1;
      if (max_tiers === 0) {
        currentLevel = 0;
        if (isSubmitted || Number(data.sr_status) === 2 || Number(data.sr_status) === 3) {
          data.sr_status = 3; // Auto-approved (Tier 0)
          if (!data.process_status || Number(data.process_status) === 0) {
            data.process_status = 7; // Not started yet
          }
        }
      } else {
        const nextPendingIdx = steps.findIndex(s => s.status === 2);
        if (nextPendingIdx >= 0) {
          currentLevel = steps[nextPendingIdx].level;
        } else {
          const nextNotStartedIdx = steps.findIndex(s => s.status === 7);
          if (nextNotStartedIdx >= 0) {
            currentLevel = steps[nextNotStartedIdx].level;
          } else if (steps.every(s => s.status === 3)) {
            currentLevel = max_tiers + 1;
          }
        }
      }

      data.approval_flow = JSON.stringify({
        total_levels: max_tiers,
        current_level: currentLevel,
        steps: steps
      });

    } catch (err) {
      console.error('Error resolving approvals:', err);
    }
  }

  /**
   * Request Owner Slice:
   * Lọc các request mà user là SR owner hoặc policy lead.
   */
  static async getRequestOwnerSlice(userEmpId) {
    const query = `
      SELECT * FROM request
      WHERE policy_lead = $1 OR sr_owner = $1
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * enrichRequest:
   * Calculates approval_status on the fly for a request record.
   */
  static enrichRequest(record) {
    if (!record) return record;
    let approval_status = 'Pending Approval';
    const statusNum = Number(record.sr_status);

    if (statusNum === 1) {
      approval_status = 'Draft';
    } else if (statusNum === 3) {
      approval_status = 'Approved';
    } else if (statusNum === 4) {
      approval_status = 'Rejected';
    } else if (statusNum === 5) {
      approval_status = 'Closed';
    } else if (statusNum === 6) {
      approval_status = 'Cancelled';
    } else if (statusNum === 2) {
      approval_status = 'Pending Approval';
    } else {
      approval_status = 'Pending Approval';
    }

    record.approval_status = approval_status;
    if (record.policy_approval_level && !record.approval_level) {
      record.approval_level = record.policy_approval_level;
    }
    // Default process_status to 7 (Not started) if null/empty
    if (record.process_status === null || record.process_status === undefined) {
      record.process_status = 7;
    }
    return record;
  }
}

module.exports = RequestModel;
