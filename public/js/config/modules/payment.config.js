/**
 * payment.config.js - Modular Config for CRC / TeraX v2
 * Domain: payment
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  payment: {
    label: 'Payments',
    subtitle: 'Manage scheduled payments',
    endpoint: '/table/payment',
    pk: 'payment_id',
    icon: '💳',
    columns: [
      { key: 'payment_description', label: 'Payment Description' },
      { key: 'payment_type', label: 'Payment Type', badge: true },
      { key: 'value', label: 'Value', labelKey: 'col.value', type: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'exchange_rate', label: 'Exchange Rate' },
      { key: 'value_in_base_currency', label: 'Value in Base Currency', labelKey: 'col.value_in_base_currency', type: 'number' },
      { key: 'payment_status', label: 'Payment Status', badge: true },
      { key: 'due_date', label: 'Due Date' },
      { key: 'payment_date', label: 'Payment Date' },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'my_company', label: 'My Company', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'counter_party', label: 'Pay to / Pay from', labelKey: 'col.pay_to_from' },
      { key: 'transaction_id', label: 'Transaction ID' },
      { key: 'request', label: 'Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
      { key: 'payment_period', label: 'Payment Period' },
      { key: 'payment_request', label: 'Payment Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' }
    ],
    fields: [
      { section: 'payment summary' },
      {
        key: 'my_company',
        label: 'MY COMPANY',
        labelKey: 'col.my_company',
        type: 'select',
        optionsFrom: 'my_company',
        optionValue: 'my_company_id',
        optionLabel: 'company_shortname',
        onchange: 'handlePaymentCompanyChange()',
        required: true,
        defaultValue: () => {
          if (typeof authUser !== 'undefined' && authUser && authUser.company_id && typeof selectCache !== 'undefined' && selectCache['my_company']) {
            const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id));
            if (comp) return comp.my_company_id;
          }
          return '';
        }
      },
      { key: 'currency', label: 'CURRENCY', type: 'select', optionsFrom: 'account_currency', optionValue: 'code', optionLabel: 'label', onchange: 'handlePaymentValueChange()', required: true },
      { key: 'exchange_rate', label: 'EXCHANGE RATE', type: 'text', onchange: 'handlePaymentValueChange()', required: true },
      { key: 'value', label: 'VALUE', labelKey: 'col.value', type: 'text', onchange: 'handlePaymentValueChange()', required: true },
      { key: 'value_in_base_currency', label: 'VALUE IN BASE CURRENCY', labelKey: 'col.value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'payment_method', label: 'PAYMENT METHOD', type: 'segmented', options: ['Bank TT', 'Cash', 'Other'], defaultValue: 'Bank TT', required: true },
      { key: 'due_date', label: 'DUE DATE', type: 'date', minDate: 'today', required: true },
      { section: 'payment information' },
      { key: 'payment_type', label: 'PAYMENT TYPE', type: 'segmented', options: [{ value: 61, label: 'Outgoing' }, { value: 60, label: 'Incoming' }], defaultValue: 61, onchange: 'handlePaymentTypeChange()', required: true },
      { key: 'payment_description', label: 'PAYMENT DESCRIPTION', type: 'textarea', full: true, required: true },
      { key: 'payment_term', label: 'PAYMENT CONDITION', type: 'textarea', full: true, required: true },
      { key: 'payment_period', label: 'PAYMENT PERIOD', type: 'number', required: true, min: 1, step: 1, placeholder: 'Enter whole number (e.g. 30)' },
      { section: 'parties' },
      { key: 'counter_party', label: 'COUNTER PARTY', type: 'counter_party', full: true },
      { key: 'bank_info', label: 'BANK INFO', type: 'textarea', full: true },
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
      { key: 'contract_id', label: 'CONTRACT ID', type: 'select', optionsFrom: 'contract', optionValue: 'contract_id', optionLabel: 'contract_name_or_description', hidden: true },
      { key: 'source', label: 'SOURCE', type: 'select', options: ['Contract', 'Request'], defaultValue: 'Request', hidden: true },
      { key: 'payment_request', label: 'PAYMENT REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
      { key: 'transaction_id', label: 'TRANSACTION ID', labelKey: 'col.transaction_id', type: 'select', optionsFrom: 'mtr', optionValue: 'transaction_id', optionLabel: 'description', hidden: true }
    ],
    detailFields: [
      { section: 'payment summary' },
      { key: 'due_date', label: 'DUE DATE' },
      { key: 'payment_date', label: 'PAYMENT DATE' },
      { key: 'currency', label: 'CURRENCY' },
      { key: 'exchange_rate', label: 'EXCHANGE RATE' },
      { key: 'value', label: 'VALUE', labelKey: 'col.value' },
      { key: 'value_in_base_currency', label: 'VALUE IN BASE CURRENCY', labelKey: 'col.value_in_base_currency' },
      { section: 'payment information' },
      { key: 'payment_id', label: 'PAYMENT ID' },
      { key: 'contract_id', label: 'CONTRACT ID', optionsFrom: 'contract', full: true },
      { key: 'payment_description', label: 'PAYMENT DESCRIPTION' },
      { key: 'payment_term', label: 'PAYMENT CONDITION', full: true },
      { key: 'payment_period', label: 'PAYMENT PERIOD' },
      { key: 'payment_method', label: 'PAYMENT METHOD' },
      { section: 'parties' },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', full: true },
      { key: 'counter_party', label: 'PAY TO', full: true },
      { section: 'request information' },
      { key: 'request', label: 'REQUEST', optionsFrom: 'request', full: true },
      { key: 'payment_request', label: 'PAYMENT REQUEST', optionsFrom: 'request', full: true },
      { key: 'transaction_id', label: 'TRANSACTION ID', labelKey: 'col.transaction_id', optionsFrom: 'mtr', full: true }
    ],
    displayName: (r) => (window.formatPaymentLabel ? window.formatPaymentLabel(r) : [r.payment_type, r.payment_description].filter(Boolean).join(' | ') || r.payment_id),
    children: ['mtr'],
  }
  });
})();
