import fs from "fs";
import path from "path";
import { calculateBinaryHash } from "./calculateBinaryHash";

export type LibraryFile = {
  fileName: string;
  fullPath: string;
  extension: string;
  category:
    | "xdf"
    | "stockBin"
    | "mapSwitch"
    | "bin"
    | "unknown";

  /**
   * Exact file metadata.
   *
   * Binary hashes and sizes are calculated from the file contents,
   * allowing TuneSight to verify exact reference matches later.
   */
  binaryHash: string | null;
  binarySizeBytes: number | null;
};

const IGNORED_FOLDERS = [
  "FLEXFUEL",
  "LOGGING",
  "REAL TIME TUNING",
  "REAL-TIME TUNING",
  "REAL_TIME_TUNING",
];

function shouldIgnoreFolder(
  folderName: string
): boolean {
  return IGNORED_FOLDERS.includes(
    folderName.toUpperCase()
  );
}

function classify(
  fileName: string,
  fullPath: string
): LibraryFile["category"] {
  const upperName =
    fileName.toUpperCase();

  const upperPath =
    fullPath.toUpperCase();

  if (upperName.endsWith(".XDF")) {
    return "xdf";
  }

  if (!upperName.endsWith(".BIN")) {
    return "unknown";
  }

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
    upperPath.includes("STOCK") ||
    upperPath.includes("ORIGINAL") ||
    /(^|[\s_.-])ORI([\s_.-]|$)/.test(
      upperName
    )
  ) {
    return "stockBin";
  }

  return "bin";
}

function calculateBinaryMetadata(
  fullPath: string
): {
  binaryHash: string | null;
  binarySizeBytes: number | null;
} {
  try {
    const fileBuffer =
      fs.readFileSync(fullPath);

    return {
      binaryHash:
        calculateBinaryHash(fileBuffer),

      binarySizeBytes:
        fileBuffer.length,
    };
  } catch (error) {
    console.error(
      `ROM LIBRARY FILE READ FAILED: ${fullPath}`,
      error
    );

    return {
      binaryHash: null,
      binarySizeBytes: null,
    };
  }
}

export function scanLibrary(
  root: string
): LibraryFile[] {
  const files: LibraryFile[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(
      dir,
      {
        withFileTypes: true,
      }
    );

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        shouldIgnoreFolder(entry.name)
      ) {
        continue;
      }

      const fullPath = path.join(
        dir,
        entry.name
      );

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const extension = path
        .extname(entry.name)
        .toLowerCase();

      const category = classify(
        entry.name,
        fullPath
      );

      const isBinaryFile =
        extension === ".bin";

      const binaryMetadata =
        isBinaryFile
          ? calculateBinaryMetadata(
              fullPath
            )
          : {
              binaryHash: null,
              binarySizeBytes: null,
            };

      files.push({
        fileName: entry.name,
        fullPath,
        extension,
        category,
        binaryHash:
          binaryMetadata.binaryHash,
        binarySizeBytes:
          binaryMetadata.binarySizeBytes,
      });
    }
  }

  walk(root);

  return files;
}