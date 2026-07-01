import { loadRomLibrary } from "./loadRomLibrary";

const TEST_LIBRARY_ROOT = process.env.ROM_LIBRARY_ROOT;

if (!TEST_LIBRARY_ROOT) {
  console.log("ROM_LIBRARY_ROOT not set. Skipping ROM library test.");
} else {
  const result = loadRomLibrary(TEST_LIBRARY_ROOT);

  console.log("ROM Library Summary:");
  console.log(result.summary);
}