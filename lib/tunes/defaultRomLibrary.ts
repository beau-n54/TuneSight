import { ROM_LIBRARY } from "./romLibrary";
import { RomLibraryEntry } from "./romLibrary";

let cachedLibrary: RomLibraryEntry[] | null = null;

export function getRomLibrary(): RomLibraryEntry[] {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  cachedLibrary = ROM_LIBRARY;

  return cachedLibrary;
}

export function setRomLibrary(library: RomLibraryEntry[]) {
  cachedLibrary = library;
}