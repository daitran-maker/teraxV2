const pool = require('../db');

class TicketModel {
  /**
   * My Processing Tasks (previously My Approval Slice):
   * Shows tickets where the user is the engineer for the CURRENT active processing tier.
   */
  static async getMyApprovals(userEmpId) {
    const query = `
      SELECT * FROM ticket
      WHERE
        (tier_1_approval = $1 AND COALESCE((processing_flow->>'current_level')::int, 1) = 1)
        OR (tier_2_approval = $1 AND COALESCE((processing_flow->>'current_level')::int, 1) = 2)
        OR (tier_3_approval = $1 AND COALESCE((processing_flow->>'current_level')::int, 1) = 3)
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * My Request Slice:
   * Only shows if the user is the creator, requester, or tagged in comments.
   */
  static async getMyRequests(userEmpId) {
    const query = `
      SELECT r.* FROM ticket r
      WHERE r.sr_creater = $1
         OR r.requester = $1
         OR EXISTS (
             SELECT 1 FROM "comment" rd
             WHERE rd.ticket = r.ticket_id 
               AND (rd.tag LIKE '%' || $1 || '%')
         )
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * resolveApprovals (resolveProcessingTiers):
   * Resolves the engineers for Tiers 1, 2, 3 and Coordinator based on the Ticket Type,
   * and initializes the JSONB processing flow.
   */
  static async resolveApprovals(data, client = pool) {
    if (!data.ticket_type || !data.requester) return;

    try {
      // 1. Find the matching Policy/Ticket Type
      const policyRes = await client.query(
        'SELECT tier_1_engineer, tier_2_engineer, tier_3_engineer, ticket_lead, sr_coordinator, processing_tier FROM ticket_type WHERE ticket_type_id = $1 OR ticket_name = $1',
        [data.ticket_type]
      );

      if (policyRes.rows.length === 0) return;
      const policy = policyRes.rows[0];
      const t1Config = policy.tier_1_engineer;

      // Map tier 2, 3, policy_lead, sr_coordinator directly
      if (policy.tier_2_engineer) data.tier_2_approval = policy.tier_2_engineer;
      if (policy.tier_3_engineer) data.tier_3_approval = policy.tier_3_engineer;
      if (policy.ticket_lead) data.policy_lead = policy.ticket_lead;
      if (policy.sr_coordinator) {
        data.sr_coordinator = policy.sr_coordinator;
      }

      if (t1Config) {
        if (t1Config.toLowerCase() === 'direct manager') {
          // Direct Manager => find manager of requester
          const empRes = await client.query(
            'SELECT direct_manager FROM employee WHERE email = $1',
            [data.requester]
          );
          if (empRes.rows.length > 0 && empRes.rows[0].direct_manager) {
            data.tier_1_approval = empRes.rows[0].direct_manager;
          }
        } else {
          data.tier_1_approval = t1Config;
        }
      }

      data.approval_level = 'Standard';
      data.sr_status = 12; // in_progress
      data.process_status = 15; // processing

      // --- SETUP JSONB PROCESSING FLOW ---
      const max_tiers = parseInt(policy.processing_tier, 10) || 3; 

      const steps = [];
      const tzTimeStr = new Date().toISOString();
      for (let i = 1; i <= max_tiers; i++) {
        const engineer = i === 1 ? data.tier_1_approval : (i === 2 ? data.tier_2_approval : data.tier_3_approval);
        steps.push({
          level: i,
          status: i === 1 ? 'Pending' : 'Not started yet',
          assigned_engineer: engineer || null,
          history: i === 1 ? [{ status: 'Pending', timestamp: tzTimeStr, by: 'system' }] : []
        });
      }

      data.processing_flow = JSON.stringify({
        total_levels: max_tiers,
        current_level: max_tiers > 0 ? 1 : 0,
        steps: steps
      });

    } catch (err) {
      console.error('Error resolving approvals:', err);
      throw err;
    }
  }

  /**
   * Request Owner Slice:
   * Filter tickets where the user is policy lead or coordinator.
   */
  static async getRequestOwnerSlice(userEmpId) {
    const query = `
      SELECT * FROM ticket
      WHERE policy_lead = $1 OR $1 = ANY(sr_coordinator)
    `;
    const result = await pool.query(query, [userEmpId]);
    return result.rows;
  }

  /**
   * enrichTicket:
   * Derives virtual tier_N_status and tier_N_update_date fields from processing_flow JSONB,
   * so the rest of the app (frontend, notifications, etc.) can still access them
   * without flat DB columns.
   */
  static enrichTicket(record) {
    if (!record) return record;
    record.approval_status = record.process_status || 'Submitted';
    if (record.policy_approval_level && !record.approval_level) {
      record.approval_level = record.policy_approval_level;
    }

    // Derive tier statuses from processing_flow JSONB
    let flow = record.processing_flow;
    if (typeof flow === 'string') {
      try { flow = JSON.parse(flow); } catch (e) { flow = null; }
    }
    const steps = (flow && Array.isArray(flow.steps)) ? flow.steps : [];

    const getLastTimestamp = (step) => {
      if (!step || !Array.isArray(step.history) || step.history.length === 0) return null;
      const last = step.history[step.history.length - 1];
      return last && last.timestamp ? new Date(last.timestamp) : null;
    };

    record.tier_1_status = (steps[0] && steps[0].status) || 'Not started yet';
    record.tier_2_status = (steps[1] && steps[1].status) || 'Not started yet';
    record.tier_3_status = (steps[2] && steps[2].status) || 'Not started yet';
    record.tier_1_update_date = getLastTimestamp(steps[0]);
    record.tier_2_update_date = getLastTimestamp(steps[1]);
    record.tier_3_update_date = getLastTimestamp(steps[2]);

    return record;
  }
}

module.exports = TicketModel;
