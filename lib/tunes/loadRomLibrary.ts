import { scanLibrary } from "./libraryScanner";
import { buildRomLibrary } from "./libraryBuilder";
import { summariseRomLibrary } from "./librarySummary";

export function loadRomLibrary(root: string) {
  const files = scanLibrary(root);
  const library = buildRomLibrary(files);
  const summary = summariseRomLibrary(library);

  return {
    files,
    library,
    summary,
  };
}