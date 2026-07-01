import { loadRomLibrary } from "../lib/tunes/loadRomLibrary";

const root = process.env.ROM_LIBRARY_ROOT;

if (!root) {
  console.error("Missing ROM_LIBRARY_ROOT environment variable.");
  process.exit(1);
}

const result = loadRomLibrary(root);

console.log("ROM Library Summary");
console.log("===================");
console.log(JSON.stringify(result.summary, null, 2));