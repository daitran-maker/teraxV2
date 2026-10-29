# Service Delivery extension – install notes

Everything lives in `modules/service_delivery/` (client config, server metrics/handler, `install.js`, `patch_core.js`).

## Install

```
node modules/service_delivery/install.js
```

(also runs with the app migrations on server start). It is idempotent and does everything:

- DB: tables / catalogs / extra columns / indexes (`contract.sc_*`, `service_delivery_contract.id__contract`, ...), FY backfill.
- Core wiring through `patch_core.js` – small generic seams, applied only when missing and only if every anchor
  matches exactly once (otherwise nothing is written for that file and a warning is printed):

| File | Seam |
|------|------|
| `server/core/tableRegistry.js` | `registerListExtension` / `applyListExtension` / `getListExtensionColumns` |
| `server/routes/dynamic_crud.js` | `registerMetrics(tableRegistry)`, `applyListExtension(...)` before `countTarget`, extension columns in sortable `customCols` |
| `public/js/views/tableView.js` | `col.renderCell` cell hook + status-card hook (`statusCards:false` / `buildStatusCards`) at the top of `buildTableStatusCards` |
| `public/js/views/childTableView.js` | `c.renderCell` cell hook (2 places) |
| `public/index.html` | menu entry `#service_contract` |

If a warning says an anchor did not match (the core file was changed a lot), apply the seam by hand using
the table above as the list of places.
