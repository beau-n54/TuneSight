import fs from "fs";
import path from "path";

export type LibraryFile = {
  fileName: string;
  fullPath: string;
  extension: string;
  category: "xdf" | "stockBin" | "mapSwitch" | "bin" | "unknown";
};

const IGNORED_FOLDERS = [
  "FLEXFUEL",
  "LOGGING",
  "REAL TIME TUNING",
  "REAL-TIME TUNING",
  "REAL_TIME_TUNING",
];

function shouldIgnoreFolder(folderName: string): boolean {
  return IGNORED_FOLDERS.includes(folderName.toUpperCase());
}

export function scanLibrary(root: string): LibraryFile[] {
  const files: LibraryFile[] = [];

  function classify(fileName: string, fullPath: string): LibraryFile["category"] {
    const upperName = fileName.toUpperCase();
    const upperPath = fullPath.toUpperCase();

    if (upperName.endsWith(".XDF")) return "xdf";

    if (!upperName.endsWith(".BIN")) return "unknown";

    if (
      upperName.includes("MAPSWITCH") ||
      upperName.includes("MAP_SWITCH") ||
      upperName.includes("MAP SWITCH") ||
      upperPath.includes("MAPSWITCH") ||
      upperPath.includes("MAP_SWITCH") ||
      upperPath.includes("MAP SWITCH")
    ) {
      return "mapSwitch";
    }

    if (
      upperName.includes("STOCK") ||
      upperName.includes("ORIGINAL") ||
      upperName.includes("ORI") ||
      upperPath.includes("STOCK") ||
      upperPath.includes("ORIGINAL")
    ) {
      return "stockBin";
    }

    return "bin";
  }

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && shouldIgnoreFolder(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      files.push({
        fileName: entry.name,
        fullPath,
        extension: path.extname(entry.name).toLowerCase(),
        category: classify(entry.name, fullPath),
      });
    }
  }

  walk(root);

  return files;
}