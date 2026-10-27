import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import axios from "axios";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadClient() {
  const values = new Map([
    ["chantier.accessToken", "expired"],
    ["chantier.refreshToken", "refresh"],
    ["chantier.tenantId", "tenant"],
  ]);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const source = readFileSync(new URL("../src/api/client.ts", import.meta.url), "utf8")
    .replace("import.meta.env.VITE_API_BASE_URL", '"http://test/api/v1"');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const testRequire = (name) => name === "axios" ? axios : require(name);
  vm.runInNewContext(compiled, { exports, require: testRequire, localStorage, window: new EventTarget(), Event });
  return { ...exports, localStorage };
}

function unauthorized(config) {
  return Promise.reject(new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
    status: 401, statusText: "Unauthorized", headers: {}, config, data: {},
  }));
}

function response(config, data) {
  return { status: 200, statusText: "OK", headers: {}, config, data };
}

test("parallel 401 responses share one refresh and retry with the new token", async () => {
  const original = axios.defaults.adapter;
  const { api, localStorage } = loadClient();
  let refreshes = 0;
  axios.defaults.adapter = async (config) => {
    refreshes += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response(config, { access: "renewed" });
  };
  api.defaults.adapter = (config) => config.headers.Authorization === "Bearer renewed"
    ? Promise.resolve(response(config, { ok: true })) : unauthorized(config);
  try {
    const results = await Promise.all([api.get("/projects/"), api.get("/planning/tasks/")]);
    assert.equal(refreshes, 1);
    assert.ok(results.every((result) => result.data.ok));
    assert.equal(localStorage.getItem("chantier.accessToken"), "renewed");
  } finally {
    axios.defaults.adapter = original;
  }
});

test("failed refresh clears the entire session", async () => {
  const original = axios.defaults.adapter;
  const { api, localStorage } = loadClient();
  api.defaults.adapter = unauthorized;
  axios.defaults.adapter = unauthorized;
  try {
    await assert.rejects(api.get("/projects/"));
    for (const name of ["accessToken", "refreshToken", "tenantId"]) {
      assert.equal(localStorage.getItem(`chantier.${name}`), null);
    }
  } finally {
    axios.defaults.adapter = original;
  }
});

test("logout during a refresh cannot restore the old session", async () => {
  const original = axios.defaults.adapter;
  const { api, clearSession, localStorage } = loadClient();
  let finish;
  let started;
  const refreshing = new Promise((resolve) => { started = resolve; });
  axios.defaults.adapter = (config) => new Promise((resolve) => {
    finish = () => resolve(response(config, { access: "old-session-token" }));
    started();
  });
  api.defaults.adapter = unauthorized;
  try {
    const request = api.get("/projects/");
    const rejection = assert.rejects(request);
    await refreshing;
    clearSession();
    finish();
    await rejection;
    assert.equal(localStorage.getItem("chantier.accessToken"), null);
  } finally {
    axios.defaults.adapter = original;
  }
});
