import type { ParsedTuneFile } from "./types";

import { enrichMsd80TuneProfile } from "./platforms/msd80";
import { enrichMsd81TuneProfile } from "./platforms/msd81";

export function routePlatformParser(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  switch (parsed.detectedPlatform) {
    case "MSD80":
      return enrichMsd80TuneProfile(parsed);

    case "MSD81":
      return enrichMsd81TuneProfile(parsed);

    default:
      return parsed;
  }
}