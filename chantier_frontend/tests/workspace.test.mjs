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
  const error = new axios.AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, null, { status: 409 });
  assert.match(errorMessage(error), /Actualisez/);
});
