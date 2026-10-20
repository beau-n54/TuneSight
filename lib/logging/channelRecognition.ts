import { MHD_ALIASES } from "./mhd.ts";
import { BM3_ALIASES } from "./bm3.ts";
import { TEMPERATURE_ALIASES, additionalCylinderAliases } from "./helpers.ts";

/** Metadata only, from the same exact alias owners used to translate values.
 * Unknown headers stay unassigned; casing and unit resemblance confer no authority. */
export function channelRecognition(headers: readonly string[], format: string, fields: readonly string[]) {
  const aliases: Record<string, string[]> = format === "mhd"
    ? {...MHD_ALIASES, boostPsi: MHD_ALIASES.boost, boostTargetPsi: MHD_ALIASES.boostTarget, throttlePlate: MHD_ALIASES.throttle}
    : format === "bm3" ? {...BM3_ALIASES} : {};
  if (format === "mhd" || format === "bm3") Object.assign(aliases, {
    iat: TEMPERATURE_ALIASES, timingCyl7: additionalCylinderAliases(7), timingCyl8: additionalCylinderAliases(8),
  });
  const known = new Set(Object.values(aliases).flat());
  return {
    fields: Object.fromEntries(fields.map(field => [field, headers.filter(header => aliases[field]?.includes(header))])),
    unassigned: headers.filter(header => !known.has(header)),
  };
}
