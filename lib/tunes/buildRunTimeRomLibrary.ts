import { scanLibrary } from "./libraryScanner";
import { buildRomLibrary } from "./libraryBuilder";
import { setLibrary } from "./libraryCache";
import { summariseRomLibrary } from "./librarySummary";

export function buildRuntimeRomLibrary(root: string) {
  const files = scanLibrary(root);
  const library = buildRomLibrary(files);

  setLibrary(library);

  return summariseRomLibrary(library);
}