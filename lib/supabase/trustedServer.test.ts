import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: object, next: (specifier: string, context: object) => object): object;
}): unknown };
type Options = { global: { fetch: typeof fetch }; auth: { persistSession: boolean; autoRefreshToken: boolean } };
let options: Options;
const state = globalThis as typeof globalThis & { captureTrustedOptions: (url: string, key: string, value: Options) => object };
state.captureTrustedOptions = (url, key, value) => {
  assert.equal(url, "https://controlled.invalid"); assert.equal(key, "synthetic-server-key"); options = value; return {};
};
registerHooks({ resolve(specifier, context, next) {
  const source = specifier === "server-only" ? "export {};" : specifier === "@supabase/supabase-js"
    ? "export const createClient=(...args)=>globalThis.captureTrustedOptions(...args);" : null;
  return next(source === null ? specifier : "data:text/javascript," + encodeURIComponent(source), context);
} });
const { createTrustedServerClient } = await import("./trustedServer.ts");
const { fetchWithTimeout } = await import("../security/networkTimeout.ts");

test("trusted response observation preserves timeout, no-store transport, request options and response body", async () => {
  const priorFetch = globalThis.fetch, priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://controlled.invalid"; process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-server-key";
  try {
    createTrustedServerClient(); assert.equal(options.global.fetch, fetchWithTimeout);
    let observations = 0;
    const response = new Response("controlled body", { headers: { etag: '"controlled-version"' } });
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.cache, "no-store"); assert.ok(init?.signal);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-test-only"); return response;
    };
    createTrustedServerClient((url, observed) => {
      observations++; assert.equal(url, "https://controlled.invalid/object");
      assert.equal(observed, response); assert.equal(observed.bodyUsed, false);
    });
    assert.deepEqual(options.auth, { persistSession: false, autoRefreshToken: false });
    const returned = await options.global.fetch(new URL("https://controlled.invalid/object"), { cache: "no-store", headers: { Authorization: "Bearer synthetic-test-only" } });
    assert.equal(returned, response); assert.equal(await returned.text(), "controlled body"); assert.equal(observations, 1);
    globalThis.fetch = async () => { throw Error("controlled network failure"); };
    await assert.rejects(options.global.fetch("https://controlled.invalid/object")); assert.equal(observations, 1);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey;
  }
});
