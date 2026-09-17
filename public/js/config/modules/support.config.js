/**
 * support.config.js - Modular Config for CRC / TeraX v2
 * Domain: support
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  support: {
    label: 'Support',
    subtitle: 'Submit support tickets',
    endpoint: '/table/ticket',
    pk: 'ticket_id',
    icon: 'support_agent',
    children: ['ticket_comment'],
    columns: [
      { key: 'ticket_id', label: 'ID', hidden: true },
      { key: 'subdomain', label: 'Subdomain' },
      { key: 'ticket_type', label: 'Support Type', optionsFrom: 'helpdesk_policy', optionValue: 'policy_id', optionLabel: 'policy_name' },
      { key: 'requester', label: 'Requester', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'description', label: 'Description' },
      { key: 'sr_coordinator', label: 'SR Coordinator', labelKey: 'col.sr_coordinator', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'process_status', label: 'Status', badge: true },
      { key: 'rating', label: 'Rating' }
    ],
    fields: [
      { key: 'subdomain', label: 'SUBDOMAIN', type: 'text', createReadonly: true, editReadonly: true, defaultValue: () => window.location.host },
      { key: 'ticket_type', label: 'SUPPORT TYPE', type: 'select', optionsFrom: 'helpdesk_policy', optionValue: 'policy_id', optionLabel: 'policy_name' },
      { key: 'description', label: 'DESCRIPTION', type: 'textarea', full: true, required: true },
      { key: 'comment', label: 'COMMENT', type: 'textarea', full: true },
      { key: 'file', label: 'FILE', type: 'file', full: true }
    ],
    detailFields: [
      { section: 'ticket information' },
      { key: 'ticket_id', label: 'Ticket ID' },
      { key: 'ticket_type', label: 'Support Type', optionsFrom: 'helpdesk_policy', optionValue: 'policy_id', optionLabel: 'policy_name' },
      { key: 'description', label: 'Description', full: true },
      { key: 'process_status', label: 'Status', badge: true },
      { key: 'rating', label: 'Rating' },
      { key: 'subdomain', label: 'Subdomain' },
      { section: 'assignment & requester' },
      { key: 'sr_coordinator', label: 'SR Coordinator', labelKey: 'col.sr_coordinator', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'requester', label: 'Requester', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'processing_flow', label: 'Processing Flow', hidden: true }
    ],
    displayName: (r) => {
      let pName = r.ticket_type;
      try {
        if (typeof selectCache !== 'undefined' && selectCache['helpdesk_policy']) {
          const p = selectCache['helpdesk_policy'].find(x => x.policy_id === r.ticket_type);
          if (p) pName = p.policy_name;
        }
      } catch (e) { }
      return `${pName || 'Support'} | ${r.description || ''} (${r.ticket_id})`;
    }
  },

  helpdesk_policy: {
    label: 'Ticket Type',
    icon: 'label',
    endpoint: '/support/ticket-types',
    pk: 'policy_id',
    columns: [],
    fields: []
  },

  ticket_comment: {
    label: 'Chat',
    subtitle: 'Comments and attachments for tickets',
    endpoint: '/table/ticket_comment',
    pk: 'comment_id',
    icon: 'chat',
    columns: [
      { key: 'comment_id', label: 'ID', hidden: true },
      { key: 'ticket', label: 'Ticket ID' },
      { key: 'comment', label: 'Comment' },
      { key: 'tag', label: 'Tag' },
      { key: 'link', label: 'Link' },
      { key: 'comment_date', label: 'Comment Date' }
    ],
    fields: [
      { key: 'ticket', label: 'Ticket ID', type: 'select', optionsFrom: 'support', optionValue: 'ticket_id', optionLabel: 'ticket_id', createReadonly: true, editReadonly: true },
      { key: 'comment', label: 'Comment', type: 'textarea', full: true },
      { key: 'file', label: 'File', type: 'file', full: true },
      { key: 'link', label: 'Link', type: 'text', full: true },
      { key: 'reply_to', label: 'Reply To', type: 'text', hidden: true },
      { key: 'tag', label: 'Tag', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', full: true }
    ],
    displayName: (r) => r.comment_id || r.comment || 'Comment'
  }
  });
})();
