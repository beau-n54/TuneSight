/** Reproducible, isolated browser UI validation using installed Next/React/TypeScript only.
 * Run: node scripts/verifyBridgePairingUi.mjs; open the printed loopback URL; expect seven PASS lines.
 * No vehicle, subscriber account, dependency installation or application configuration changes.
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import webpackBundle from "next/dist/compiled/webpack/webpack.js";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { webpack } = webpackBundle;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "tunesight-pairing-ui-"));
const entry = path.join(output, "entry.tsx"), loader = path.join(output, "loader.cjs");
fs.writeFileSync(entry, `import {runLocalBridgePairingUiTests} from ${JSON.stringify(path.join(repo, "lib/vehicle-interface/localBridgePairing.browser.test").replaceAll("\\", "/"))};
const results=document.getElementById('results')!;
void runLocalBridgePairingUiTests(document.getElementById('workspace')!,message=>{const p=document.createElement('p');p.textContent=message;results.append(p)}).then(()=>{results.append('COMPLETE: 7 browser assertions passed')}).catch(error=>{results.append('FAILED: '+error.message)});`, "utf8");
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;};`, "utf8");
const fallback = Object.fromEntries(Object.entries({ crypto: "crypto-browserify", buffer: "buffer", events: "events", stream: "stream-browserify", string_decoder: "string_decoder", util: "util", vm: "vm-browserify" }).map(([key, value]) => [key, require.resolve("next/dist/compiled/" + value)]));
// Match Next's existing browser polyfills for the unchanged vehicle-definition dependencies.
const compiler = webpack({ mode: "development", target: "web", entry, output: { path: output, filename: "pairing-ui.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": repo }, modules: [path.join(repo, "node_modules")], fallback },
  module: { rules: [{ test: /\.tsx?$/, use: loader }] },
  plugins: [new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, fallback.crypto), new webpack.ProvidePlugin({ Buffer: [fallback.buffer, "Buffer"], process: require.resolve("next/dist/build/polyfills/process") })],
  optimization: { minimize: false },
});
let server;
function cleanup() {
  const resolved = path.resolve(output);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("tunesight-pairing-ui-")) throw new Error("unexpected_test_output_path");
  fs.rmSync(resolved, { recursive: true, force: true });
}
compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); cleanup(); process.exitCode = 1; return; }
  server = http.createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/pairing-ui.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(fs.readFileSync(path.join(output, "pairing-ui.js"))); return; }
    if (req.url !== "/") { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html><head><meta charset="utf-8"><title>Controlled bridge pairing UI validation</title><style>body{background:#151515;color:#ddd;font:16px sans-serif}button{margin:6px;padding:10px}</style></head><body><h1>Controlled bridge pairing UI validation</h1><p>No vehicle or subscriber data. Mock HTTP and permission outcomes.</p><div id="results"></div><div id="workspace"></div><script src="/pairing-ui.js"></script></body></html>');
  });
  server.listen(0, "127.0.0.1", () => console.log(`Controlled StrictMode UI test: http://127.0.0.1:${server.address().port}`));
});
process.on("SIGINT", () => { if (server) { server.closeAllConnections(); server.close(cleanup); } else cleanup(); });
