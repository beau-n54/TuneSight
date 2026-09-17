export const TUNING_ESSENTIAL_SYSTEMS = Object.freeze([
  "Boost & Air Control",
  "WGDC / Turbo Control",
  "Load & Torque",
  "Fueling / Lambda",
  "Ignition / Timing",
  "IAT / Temperature Compensation",
  "Protection / Safety / Limiters",
] as const);

export type TuningEssentialSystem = typeof TUNING_ESSENTIAL_SYSTEMS[number];
const aliases: Readonly<Record<string, TuningEssentialSystem>> = Object.freeze({
  "boost & air control": "Boost & Air Control",
  "wastegate / wgdc": "WGDC / Turbo Control",
  "wgdc / turbo control": "WGDC / Turbo Control",
  "load & torque": "Load & Torque",
  "fueling / lambda": "Fueling / Lambda",
  "ignition / timing": "Ignition / Timing",
  "iat / temperature compensation": "IAT / Temperature Compensation",
  "temperature & protection": "IAT / Temperature Compensation",
  "limiters & safety": "Protection / Safety / Limiters",
  "protection / safety / limiters": "Protection / Safety / Limiters",
});

export function tuningEssentialSystem(value: string): TuningEssentialSystem | null { return aliases[value.trim().toLocaleLowerCase()] ?? null; }
