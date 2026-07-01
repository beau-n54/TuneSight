import type { TunePlatform } from "./types";

export function detectRomSignature(
  printableStrings: string[]
): {
  detectedPlatform: TunePlatform;
  detectedRom: string | null;
  binarySignature: string | null;
  confidence: "low" | "medium" | "high";
  parserNotes: string[];
} {
  const joined = printableStrings.join(" ").toUpperCase();
  const notes: string[] = [];

  let detectedPlatform: TunePlatform = "UNKNOWN";
  let detectedRom: string | null = null;
  let binarySignature: string | null = null;
  let confidence: "low" | "medium" | "high" = "low";

  if (joined.includes("I8A0S")) {
    detectedPlatform = "MSD80";
    detectedRom = "I8A0S";
    binarySignature = "I8A0S";
    confidence = "high";
    notes.push("Detected I8A0S ROM signature. Likely BMW N54 MSD80 binary.");
  }

  if (joined.includes("INA0S")) {
    detectedPlatform = "MSD81";
    detectedRom = "INA0S";
    binarySignature = "INA0S";
    confidence = "high";
    notes.push("Detected INA0S ROM signature. Likely BMW N54 MSD81 binary.");
  }

  if (joined.includes("IKM0S")) {
    detectedPlatform = "MSD81";
    detectedRom = "IKM0S";
    binarySignature = "IKM0S";
    confidence = "high";
    notes.push("Detected IKM0S ROM signature. Likely BMW N54 MSD81 binary.");
  }

  if (detectedPlatform === "UNKNOWN") {
    notes.push("No known ROM signature detected from printable strings.");
  }

  return {
    detectedPlatform,
    detectedRom,
    binarySignature,
    confidence,
    parserNotes: notes,
  };
}