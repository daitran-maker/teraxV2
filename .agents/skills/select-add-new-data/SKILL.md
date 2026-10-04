---
name: select-add-new-data
description: Guide to configuring and implementing a custom 'select_with_add' search-select dropdown field. This field type displays unique values fetched from the database, allows typing to search/filter, and displays a '+ Add new data' inline option that selects the typed value without dialog prompts.
---

# Select Add New Data (select_with_add)

This skill describes how to configure, render, and handle a custom search-and-add select dropdown field (`select_with_add`) in this application.

Use this custom field type whenever the user requests a form input that behaves like a select dropdown containing existing unique database values, but allows adding custom new values in-place (inline) without opening dialog prompts.

---

## 1. Field Configuration (public/config.js)

To apply this behavior to a field (for example, the `type` field in the `asset` module), configure it in the module's `fields` array in [config.js](file:///d:/CPI/Terax/public/config.js):

```javascript
{
  key: 'type',
  label: 'TYPE',
  type: 'select_with_add',
  options: ['Accessories', 'Nội thất văn phòng', 'Electronics', 'Khác'], // Static default recommendations
  onchange: 'handleAssetTypeChange()', // Optional change handler
  required: true
}
```

---

## 2. Pre-warming Database Caches (public/app.js)

Since the select dropdown must aggregate all unique existing values of this column from the database, we must ensure that the cache for the module contains all records.

1. **Add the Module to Whitelist:**
   In `getSelectOptions` inside [app.js](file:///d:/CPI/Terax/public/app.js), make sure the module is whitelisted so it fetches with `limit=1000000`:
   ```javascript
   if (['employee', 'my_company', 'department', 'policy', 'company', 'operation_program', 'account', 'v_finance', 'finance', 'cms_country', 'cms_province', 'cms_city', 'cms_currency', 'asset'].includes(moduleKey)) {
     endpointUrl += (endpointUrl.includes('?') ? '&' : '?') + 'limit=1000000';
   }
   ```

2. **Pre-warm Cache on Form Open:**
   Add `await getSelectOptions(moduleKey).catch(() => {});` at the start of `openAddModal` and `openEditModal` inside [app.js](file:///d:/CPI/Terax/public/app.js):
   ```javascript
   async function openAddModal(moduleKey, initialData = null) {
     await getSelectOptions(moduleKey).catch(() => {});
     const mod = MODULES[moduleKey];
     ...
   }
   ```

---

## 3. UI Rendering (public/app.js)

In `renderFieldHTML` inside [app.js](file:///d:/CPI/Terax/public/app.js), render the custom input box and the companion dropdown list:

```javascript
} else if (field.type === 'select_with_add') {
  const uniqueVals = [];
  const seenVals = new Set();
  
  // 1. Static options from config
  if (field.options && Array.isArray(field.options)) {
    field.options.forEach(o => {
      const valStr = String(o).trim();
      const valLower = valStr.toLowerCase();
      if (valStr && !seenVals.has(valLower)) {
        seenVals.add(valLower);
        uniqueVals.push(valStr);
      }
    });
  }

  // 2. Existing unique values from database cache
  const cached = selectCache[moduleKey] || [];
  cached.forEach(r => {
    let val = r[field.key];
    if (val) {
      val = String(val).trim().replace(/^\[|\]$/g, '');
      const valLower = val.toLowerCase();
      if (!seenVals.has(valLower)) {
        seenVals.add(valLower);
        uniqueVals.push(val);
      }
    }
  });

  // 3. Fallback/combine with current table data
  currentData.forEach(r => {
    let val = r[field.key];
    if (val) {
      val = String(val).trim().replace(/^\[|\]$/g, '');
      const valLower = val.toLowerCase();
      if (!seenVals.has(valLower)) {
        seenVals.add(valLower);
        uniqueVals.push(val);
      }
    }
  });

  const onChangeStr = field.onchange ? `data-onchange="${field.onchange}"` : '';
  const onInputStr = field.oninput ? `data-oninput="${field.oninput}"` : '';
  const escVal = val ? escapeHTML(val) : '';

  html += `
    <div class="custom-select-add-container" id="container-${field.key}" style="position: relative; width: 100%;">
      <input class="form-input custom-select-add-input" type="text" id="f-${field.key}" name="${field.key}" value="${escVal}" autocomplete="off" ${onChangeStr} ${onInputStr} ${disabledAttr} placeholder="Select or type..."
        onfocus="openCustomSelectAddDropdown('${field.key}')"
        oninput="filterCustomSelectAddDropdown('${field.key}')"
        onkeydown="handleCustomSelectAddKeydown(event, '${field.key}')"
        style="padding-right: 32px;" />
      <span class="custom-select-add-caret" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #64748B; display: flex; align-items: center; justify-content: center;">
        <span class="material-symbols-rounded" style="font-size: 20px;">arrow_drop_down</span>
      </span>
      <div class="custom-select-add-dropdown" id="dropdown-${field.key}" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 1000; margin-top: 4px;">
        ${uniqueVals.map(v => `
          <div class="custom-select-add-item" style="padding: 8px 12px; cursor: pointer; font-size: 13px; color: #1E293B; transition: background 0.15s ease;"
            onmouseover="this.style.background='#F1F5F9'"
            onmouseout="const input=document.getElementById('f-${field.key}'); const selected=(input && input.value.trim().toLowerCase() === this.textContent.trim().toLowerCase()); this.style.background=selected ? '#E2E8F0' : 'transparent';"
            onmousedown="selectCustomSelectAddValue('${field.key}', '${escapeHTML(v).replace(/'/g, "\\'")}')">
            ${escapeHTML(v)}
          </div>
        `).join('')}
        <div class="custom-select-add-item add-new-item" id="add-new-${field.key}" style="display: none; padding: 8px 12px; cursor: pointer; font-size: 13px; color: #475569; font-weight: 600; border-top: 1px solid #F1F5F9; transition: background 0.15s ease;"
          onmouseover="this.style.background='#F1F5F9'"
          onmouseout="this.style.background='transparent'"
          onmousedown="addNewCustomSelectAddValue('${field.key}')">
          + Add "<span class="new-val-span"></span>"
        </div>
      </div>
    </div>
  `;
}
```

---

## 4. JS Event Handlers (public/app.js)

The following core helper methods handle opening, filtering, selecting, adding, and outside-clicking:

* **`openCustomSelectAddDropdown`**: Displays the full list of options initially and highlights the currently selected option in `#E2E8F0` and bold text.
* **`filterCustomSelectAddDropdown`**: Filters list options by typed value. If the typed value is new, displays the inline `+ Add "[value]"` item at the bottom.
* **`selectCustomSelectAddValue`**: Injects selected value to input, closes dropdown, and fires change events.
* **`addNewCustomSelectAddValue`**: Directly appends the typed new value as a temporary dropdown option, selects it, closes the dropdown, and fires change events.
* **`handleCustomSelectAddKeydown`**: Handles Enter key to trigger `addNewCustomSelectAddValue`, and Escape key to close the dropdown.
* **Document MouseDown handler**: Automatically closes active dropdowns when the user clicks outside the `.custom-select-add-container`.
