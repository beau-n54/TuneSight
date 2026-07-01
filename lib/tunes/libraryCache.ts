import { RomLibraryEntry } from "./romLibrary";

let library: RomLibraryEntry[] = [];
let loaded = false;

export function setLibrary(entries: RomLibraryEntry[]) {
  library = entries;
  loaded = true;
}

export function getLibrary(): RomLibraryEntry[] {
  return library;
}

export function hasLibrary(): boolean {
  return loaded;
}

export function clearLibrary() {
  library = [];
  loaded = false;
}