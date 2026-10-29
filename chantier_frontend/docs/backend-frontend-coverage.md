# Backend / frontend coverage — 29 October 2026

## UI reference alignment

The local reference project is `C:\Users\HP\Music\smartfarmingfront-v2`.
The implementation follows its sales page, activity logs, inventory page,
`ListTable` presentation and stock-entry modals: dark green table headers,
compact alternating rows, pale green selected-tab containers, white list surfaces,
dark modal title bars, blurred backdrops and fixed action footers.

Business and platform DataGrids share French table labels and a common compact
presentation. Business grids provide column visibility, density and CSV export
of the loaded server page, with formula escaping enabled. Server cursor
pagination remains unchanged, and exports explicitly identify their page scope.
Row actions open a read-only detail modal or the authorized edit form. Complex
workflows remain accessible through the complete record page.

Editor modals include Information/Summary tabs, a close button and a scrollable
body. Required-field validation returns to the Information tab. The existing
MUI focus trap, Escape handling and focus restoration are retained.

Full detail pages follow the reference employee/inventory detail conventions:
a compact identity header, status, authorized edit/refresh controls and dedicated
Overview, Related records and Tracking tabs. Information is grouped into general
details, relations, amounts/quantities, dates and notes. Tracking shows the actual
record timestamps, authors and version, rather than an invented activity history.
The existing order lines, stock, checklist, budget summary and photo views remain
in the overview. Related records use a compact paginated DataGrid on desktop and
cards on mobile; destructive management is separated in the Tracking tab.

The audit compared the Django routers, custom actions, serializer metadata and
permissions with the active React routes. `src/App.tsx` uses the shared
`ResourcePage` and `RecordDetailPage`; the older files under `pages/modules/`
are not the active routes.

## Gaps addressed

| Area | Workspace coverage |
| --- | --- |
| Projects and planning | Projects, lots, stakeholders, tasks and dependencies; project transitions and task progress; contextual prerequisites and following tasks. |
| Budget | Budgets and server-calculated summary, lines, expenses, invoices, amendments and exchange rates; expense validation and invoice validation/payment. |
| Procurement and stock | Materials, suppliers, orders, order lines, depots and immutable movements; stock balances on material detail. |
| Workforce | Workers, time entries, assignments, certification catalogue and worker certifications; time-entry validation. |
| Equipment | Equipment, assignments, maintenance plans, maintenance records and usage logs; state changes. |
| Site progress | Daily reports, photos, progress updates and snags; submission, validation, snag resolution and authenticated photo preview/download. |
| QHSE | Incidents, corrective actions, inspections, templates, embedded inspection checklist and PPSPS; closure and completion actions. |
| Documents | Folders, documents, versions, sharing ACLs and approval workflows; uploads, current version, downloads and reviewer decisions with comments. |
| Collaboration | Personal notifications, messages, channels and notification preferences; mark-read action. |
| Reports | Templates, generated reports and KPI snapshots; generation for the selected project and authenticated downloads. |
| Sync | Mutation history, application and failure reporting with a reason. Mutation payloads remain immutable. |
| Administration | Tenant administrators can manage roles and memberships and inspect accounts/audit. Global account changes are restricted to platform administrators. Device operations remain subject to backend account permissions. |

## Purchase-order experience

1. Open **Ressources → Commandes**, then create an order with its project,
   supplier, order number, date and status.
2. Saving opens the order detail. Add lines there; the order relation is fixed.
3. Selecting a material prefills its catalogue price and currency for a new line.
   Both remain editable. Quantity and price constraints are enforced by the API.
4. Preview each line total and see order totals grouped by currency. Computation
   uses integer decimal arithmetic and totals unrounded products before rounding
   each currency total to two decimal places.
5. Edit or delete a line from the order. Version headers protect stale changes.
6. On narrow screens, lines become cards with visible quantities, prices, totals
   and actions. Desktop retains a table.

Changing an order's status does **not** create a stock receipt. The backend has
no receipt-to-order-line association or automatic receipt service. Inventory
entries must be recorded separately under stock movements; the UI links there
and states this limitation.

## Shared UX behavior

- Parent detail pages provide related records and creation forms prefilled for
  that parent. The parent relation cannot accidentally be changed in those forms.
- Collection OPTIONS metadata advertises actual search and filter capabilities.
  Lists hide unsupported search and provide relationship, date, boolean and
  choice filters. Status filters use available serializer choices.
- JSON fields are explicitly typed in OPTIONS metadata so checklist definitions,
  role permissions and structured parameters are submitted as objects/arrays
  instead of JSON-encoded strings. Role permission values are validated by the API.
- Forms use French labels, relevant field ordering, inline API validation and
  relation selectors constrained by selected project/equipment where applicable.
  Stock forms reveal only the depots needed by the selected movement type.
- Role permissions use a module/action matrix, including separate validation
  and shared-document permissions. Approval dialogs accept reviewer comments.
  A tenant-scoped role-name directory supports document sharing without granting
  access to the administrative role definitions or permission data.
- Approved financial records and validated time entries have matching edit and
  deletion restrictions in the UI. Backend checks remain authoritative, including
  protection when deleting their parents.
- File access uses authenticated APIs. Photos now have a tenant-scoped download
  endpoint, and browser previews use revocable blob URLs.
- Dev/build/preview commands explicitly select `vite.config.ts`; an old emitted
  `vite.config.js` previously targeted port 8000 instead of the documented 8005.

## Verification

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Run from `chantier_frontend`:

```powershell
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

The optional browser integration suite is `npm run test:browser`. It requires the
seeded local backend at port 8005, the dev frontend at port 5175 and headless
Chrome launched with `--remote-debugging-port=9222` in a separate QA profile.
It writes desktop/mobile screenshots under the root `.local-run/` directory.

Tests cover collection-route parity against backend router declarations, decimal
order totals, conditional forms, relation constraints, UI locks, API filter
metadata, order-line validation and authenticated photo access. Browser QA also
creates an order through the UI, adds and edits lines, checks separate currencies,
tests the supplier filter and opens the newly exposed sections at desktop and
mobile sizes. It also saves a role through the permission matrix and uploads and
previews a photo. QA orders and photos are soft-deleted afterward; the unassigned
QA role is deleted.

WebSockets/live chat, outbound email/push delivery, automatic stock receipt,
currency conversion and SaaS billing are not supplied by these frontend changes.
PostgreSQL concurrency behavior has not been tested in this SQLite environment.
