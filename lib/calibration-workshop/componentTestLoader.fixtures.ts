import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import ts from "typescript";
// Test-only TSX loader uses the existing TypeScript/React dependencies. No production loader/config changes.
const root = path.resolve(".");
// Node 24 supplies synchronous hooks; the repository's older Node type package predates them.
type ResolveContext = { parentURL?: string };
type ResolveResult = { url: string };
type LoadContext = Readonly<Record<string, unknown>>;
type LoadResult = { format?: string | null; source?: string | ArrayBufferView | ArrayBuffer | null; shortCircuit?: boolean };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult): ResolveResult;
  load(url: string, context: LoadContext, next: (url: string, context: LoadContext) => LoadResult): LoadResult;
}): unknown };
registerHooks({
  resolve(specifier, context, next) {
    const local = specifier.startsWith("@/") ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (local && !path.extname(local)) {
      const match = [".ts", ".tsx", ".js"].map(extension => local + extension).find(file => fs.existsSync(file));
      if (match) return next(pathToFileURL(match).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".tsx")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
