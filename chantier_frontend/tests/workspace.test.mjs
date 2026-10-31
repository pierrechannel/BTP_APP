import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import axios from "axios";
import ts from "typescript";

function load(api) {
  const source = readFileSync(new URL("../src/api/workspace.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: (name) => name === "axios" ? axios : { api }, URL,
    window: { location: { origin: "http://127.0.0.1:5175" } },
  });
  return exports;
}

function loadWorkflows() {
  const source = readFileSync(new URL("../src/api/workflows.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports });
  return exports;
}

test("order totals use exact decimal multiplication and separate currencies", () => {
  const { orderLineTotal, orderTotals } = loadWorkflows();
  assert.equal(orderLineTotal({ quantity: "2.500", unit_price: "100.50" }), "251.25");
  assert.equal(orderLineTotal({ quantity: "0.001", unit_price: "5.00" }), "0.01");
  const totals = orderTotals([
    { quantity: "0.001", unit_price: "5.00", currency: "BIF" },
    { quantity: "0.001", unit_price: "5.00", currency: "BIF" },
    { quantity: "3.000", unit_price: "0.10", currency: "USD" },
  ]);
  assert.equal(totals.find((item) => item.currency === "BIF").total, "0.01");
  assert.equal(totals.find((item) => item.currency === "USD").total, "0.30");
  assert.throws(() => orderLineTotal({ quantity: "-1", unit_price: "1.00" }));
  assert.throws(() => orderLineTotal({ quantity: "1.0001", unit_price: "1.00" }));
});

test("stock and sharing forms expose only relevant fields", () => {
  const { visibleFormField, relationMatches } = loadWorkflows();
  assert.equal(visibleFormField("resources.stockmovement", "source_location", { movement_type: "in" }), false);
  assert.equal(visibleFormField("resources.stockmovement", "target_location", { movement_type: "out" }), false);
  assert.equal(visibleFormField("resources.stockmovement", "source_location", { movement_type: "transfer" }), true);
  assert.equal(visibleFormField("documents.documentacl", "user", { role: "role-id" }), false);
  assert.equal(relationMatches("task", { id: "task", project: "other" }, { project: "current" }), false);
  assert.equal(relationMatches("maintenance_plan", { id: "plan", equipment: "A" }, { equipment: "A" }), true);
});

test("approved financial and workforce records have matching UI locks", () => {
  const { isRecordLocked, isDeletionLocked } = loadWorkflows();
  assert.equal(isRecordLocked("budget.invoice", { id: "1", status: "paid" }), true);
  assert.equal(isDeletionLocked("budget.invoice", { id: "1", status: "paid" }), true);
  assert.equal(isDeletionLocked("workforce.timeentry", { id: "1", is_validated: true }), true);
  assert.equal(isDeletionLocked("budget.expense", { id: "1", status: "draft" }), false);
  assert.equal(isRecordLocked("documents.approvalworkflow", { id: "1", status: "approved" }), true);
});

test("every business API collection has a workspace route or an embedded editor", () => {
  const source = readFileSync(new URL("../src/resources.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => name === "react/jsx-runtime" ? { jsx: () => ({}) } : { default: () => null } });
  const endpoints = new Set(exports.allResources.map((item) => item.endpoint));
  for (const group of ["projects", "planning", "budget", "resources", "workforce", "equipment", "progress", "qhse", "documents", "notifications", "reports", "sync"]) {
    const urls = readFileSync(new URL(`../../chantier_backend/apps/${group}/urls.py`, import.meta.url), "utf8");
    for (const match of urls.matchAll(/router\.register\("([^"]*)"/g)) {
      const endpoint = `/${group}/${match[1] ? match[1] + "/" : ""}`;
      if (endpoint === "/qhse/inspection-items/") continue; // InspectionChecklist provides its editor.
      assert.ok(endpoints.has(endpoint), `Missing workspace route: ${endpoint}`);
    }
  }
});

test("collection loader follows backend cursors without duplicating /api/v1", async () => {
  const calls = [];
  const api = { defaults: { baseURL: "/api/v1" }, get: async (endpoint, config) => {
    calls.push({ endpoint, params: config.params });
    return calls.length === 1
      ? { data: { results: [{ id: 1 }], next: "http://127.0.0.1:8005/api/v1/projects/?cursor=abc" } }
      : { data: { results: [{ id: 2 }], next: null } };
  } };
  const rows = await load(api).fetchCollection("/projects/", { search: "school" });
  assert.equal(rows.length, 2);
  assert.equal(calls[1].endpoint, "/projects/?cursor=abc");
  assert.equal(calls[1].params, undefined);
});

test("collection loader rejects circular pagination", async () => {
  const api = { defaults: { baseURL: "/api/v1" }, get: async () => ({ data: {
    results: [{ id: 1 }], next: "http://127.0.0.1:8005/api/v1/projects/",
  } }) };
  await assert.rejects(load(api).fetchCollection("/projects/"), /Pagination circulaire/);
});

test("pagination cannot escape the API path", () => {
  const { pageEndpoint } = load({ defaults: { baseURL: "/api/v1" } });
  assert.throws(() => pageEndpoint("http://127.0.0.1:8005/admin/"), /Pagination invalide/);
});

test("version headers preserve optimistic concurrency and amounts retain currency precision", () => {
  const { versionHeaders, formatValue, errorMessage } = load({ defaults: { baseURL: "/api/v1" } });
  assert.equal(versionHeaders({ id: 1, version: 3 })["If-Match"], '"3"');
  assert.equal(formatValue("1234.50", "amount").replace(/\s/g, ""), "1234,5");
  assert.equal(formatValue("9999999999999999.99", "amount").replace(/\s/g, ""), "9999999999999999,99");
  assert.equal(formatValue("0.00012345", "rate"), "0,00012345");
  const error = new axios.AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, null, { status: 409 });
  assert.match(errorMessage(error), /Actualisez/);
});

test('expense totals sum before rounding and match server half-up rounding', () => {
  const { expenseLinesTotal, financialTotal } = loadWorkflows();
  assert.equal(expenseLinesTotal([{ quantity: '0.001', unit_price: '2.50' }, { quantity: '0.001', unit_price: '2.50' }]), '0.01');
  assert.equal(expenseLinesTotal([]), '0.00');
  assert.equal(financialTotal('0.10', '0.20'), '0.30');
  assert.throws(() => expenseLinesTotal([{ quantity: '-1', unit_price: '2' }]));
});
