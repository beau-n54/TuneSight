import { createHash } from "crypto";
import type { TuneProfile } from "./types";

type BuildTuneProfileInput = {
  tuneId: string;
  tuneName?: string | null;
  fileName?: string | null;
  fileBuffer: ArrayBuffer;
};

function normalizeText(...values: Array<string | null | undefined>): string {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bytesToAsciiStrings(
  buffer: ArrayBuffer,
  minLength = 4,
  maxStrings = 400
): string[] {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < bytes.length; i++) {
    const charCode = bytes[i];
    const isPrintable =
      (charCode >= 32 && charCode <= 126) || charCode === 9;

    if (isPrintable) {
      current += String.fromCharCode(charCode);
    } else {
      const trimmed = current.trim();
      if (trimmed.length >= minLength) {
        strings.push(trimmed);
        if (strings.length >= maxStrings) break;
      }
      current = "";
    }
  }

  if (strings.length < maxStrings) {
    const trimmed = current.trim();
    if (trimmed.length >= minLength) {
      strings.push(trimmed);
    }
  }

  return Array.from(new Set(strings));
}

function joinSearchCorpus(args: {
  tuneName?: string | null;
  fileName?: string | null;
  asciiStrings: string[];
}): string {
  return normalizeText(
    args.tuneName,
    args.fileName,
    ...args.asciiStrings.slice(0, 200)
  );
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function detectPlatform(text: string): TuneProfile["detectedPlatform"] {
  if (
    includesAny(text, [
      "mhd",
      "msd80",
      "msd81",
      "i8a0s",
      "ina0s",
      "n54",
      "mhd flasher",
    ])
  ) {
    return "mhd";
  }

  if (
    includesAny(text, [
      "bm3",
      "bootmod3",
      "boot mod 3",
      "protuning freaks",
    ])
  ) {
    return "bm3";
  }

  if (
    includesAny(text, [
      "custom",
      "protune",
      "pro tune",
      "revision",
      "rev",
      "v1",
      "v2",
      "v3",
    ])
  ) {
    return "custom";
  }

  return "unknown";
}

function detectFuelingIntent(text: string): TuneProfile["fuelingIntent"] {
  if (includesAny(text, ["e85", "full ethanol"])) {
    return "full_ethanol";
  }

  if (
    includesAny(text, [
      "e50",
      "e40",
      "e35",
      "e30",
      "ethanol blend",
      "flex fuel",
    ])
  ) {
    return "ethanol_blend";
  }

  if (
    includesAny(text, [
      "race fuel",
      "race",
      "q16",
      "c16",
      "ms109",
    ])
  ) {
    return "race";
  }

  if (
    includesAny(text, [
      "pump",
      "pump gas",
      "98",
      "93",
      "91",
    ])
  ) {
    return "pump";
  }

  return "unknown";
}

function detectBoostIntent(text: string): TuneProfile["boostIntent"] {
  if (
    includesAny(text, [
      "high boost",
      "aggressive",
      "kill",
      "max effort",
      "race",
      "full send",
      "stage 2+",
      "stage2+",
      "stage 2 plus",
      "e50",
      "e85",
    ])
  ) {
    return "aggressive";
  }

  if (
    includesAny(text, [
      "stage 2",
      "stage2",
      "stage 1",
      "stage1",
      "ots",
      "sport",
    ])
  ) {
    return "moderate";
  }

  return "low";
}

function detectIgnitionIntent(text: string): TuneProfile["ignitionIntent"] {
  if (
    includesAny(text, [
      "high timing",
      "aggressive",
      "race",
      "timing heavy",
    ])
  ) {
    return "aggressive";
  }

  if (
    includesAny(text, [
      "stage 2",
      "stage2",
      "e50",
      "e85",
      "sport",
    ])
  ) {
    return "moderate";
  }

  return "conservative";
}

function detectStage(text: string): string | null {
  if (includesAny(text, ["stage 2+", "stage2+", "stage 2 plus"])) {
    return "stage_2_plus";
  }

  if (includesAny(text, ["stage 3", "stage3"])) {
    return "stage_3";
  }

  if (includesAny(text, ["stage 2", "stage2"])) {
    return "stage_2";
  }

  if (includesAny(text, ["stage 1", "stage1"])) {
    return "stage_1";
  }

  return null;
}

function detectEngineOrRomHints(text: string): {
  detectedStrategy: string | null;
  detectedRom: string | null;
} {
  let detectedStrategy: string | null = null;
  let detectedRom: string | null = null;

  if (text.includes("msd80")) detectedStrategy = "msd80";
  if (text.includes("msd81")) detectedStrategy = "msd81";
  if (text.includes("mevd17")) detectedStrategy = "mevd17";

  if (text.includes("i8a0s")) detectedRom = "i8a0s";
  if (text.includes("ina0s")) detectedRom = "ina0s";

  return { detectedStrategy, detectedRom };
}

function buildCategories(args: {
  text: string;
  fileSizeBytes: number;
  platform: TuneProfile["detectedPlatform"];
}): string[] {
  const categories = new Set<string>();

  categories.add("file_uploaded");
  categories.add("metadata_profiled");
  categories.add("binary_scanned");

  if (args.platform !== "unknown") {
    categories.add(`${args.platform}_platform`);
  }

  const stage = detectStage(args.text);
  if (stage) categories.add(stage);

  if (includesAny(args.text, ["boost", "psi", "high boost"])) {
    categories.add("boost");
  }

  if (includesAny(args.text, ["ign", "timing", "spark"])) {
    categories.add("ignition");
  }

  if (
    includesAny(args.text, [
      "fuel",
      "ethanol",
      "e30",
      "e50",
      "e85",
      "lambda",
    ])
  ) {
    categories.add("fueling");
  }

  if (includesAny(args.text, ["e30", "e50", "e85", "ethanol", "flex fuel"])) {
    categories.add("ethanol");
  }

  if (includesAny(args.text, ["ots", "off the shelf"])) {
    categories.add("ots");
  }

  if (
    includesAny(args.text, [
      "custom",
      "protune",
      "pro tune",
      "revision",
      "rev",
    ])
  ) {
    categories.add("custom_tune");
  }

  if (
    includesAny(args.text, [
      "burble",
      "antilag",
      "anti lag",
      "rolling anti lag",
    ])
  ) {
    categories.add("features");
  }

  if (args.fileSizeBytes > 1024 * 1024) {
    categories.add("full_size_binary");
  } else {
    categories.add("small_binary_or_partial");
  }

  return Array.from(categories);
}

function buildNotes(args: {
  text: string;
  asciiStrings: string[];
  fileSizeBytes: number;
  platform: TuneProfile["detectedPlatform"];
  fuelingIntent: TuneProfile["fuelingIntent"];
  boostIntent: TuneProfile["boostIntent"];
  ignitionIntent: TuneProfile["ignitionIntent"];
  detectedStrategy: string | null;
  detectedRom: string | null;
}): string[] {
  const notes: string[] = [];

  notes.push("Tune Profile Engine V2 used metadata + binary string scanning.");
  notes.push("No deep XDF table parsing has been performed yet.");

  if (args.platform !== "unknown") {
    notes.push(`Detected platform hint: ${args.platform}.`);
  } else {
    notes.push("Platform could not be confidently identified from current signals.");
  }

  if (args.detectedStrategy) {
    notes.push(`Strategy hint detected: ${args.detectedStrategy}.`);
  }

  if (args.detectedRom) {
    notes.push(`ROM hint detected: ${args.detectedRom}.`);
  }

  const stage = detectStage(args.text);
  if (stage === "stage_1") notes.push("Stage hint detected: Stage 1.");
  if (stage === "stage_2") notes.push("Stage hint detected: Stage 2.");
  if (stage === "stage_2_plus") notes.push("Stage hint detected: Stage 2+.");
  if (stage === "stage_3") notes.push("Stage hint detected: Stage 3.");

  if (args.fuelingIntent === "ethanol_blend") {
    notes.push("Signals suggest ethanol blend tune intent.");
  }

  if (args.fuelingIntent === "full_ethanol") {
    notes.push("Signals suggest full ethanol tune intent.");
  }

  if (args.boostIntent === "aggressive") {
    notes.push("Tune appears to target a more aggressive boost posture.");
  }

  if (args.ignitionIntent === "aggressive") {
    notes.push("Tune naming suggests a more aggressive ignition posture.");
  }

  if (includesAny(args.text, ["burble"])) {
    notes.push("Feature hint detected: burble-related content.");
  }

  if (includesAny(args.text, ["antilag", "anti lag"])) {
    notes.push("Feature hint detected: anti-lag-related content.");
  }

  notes.push(`Uploaded file size: ${args.fileSizeBytes} bytes.`);
  notes.push(`Extracted ${args.asciiStrings.length} printable binary strings.`);

  if (args.fileSizeBytes < 200000) {
    notes.push(
      "File size looks smaller than a typical full ROM binary, so this may be partial or unusually compact."
    );
  }

  const interestingStrings = args.asciiStrings
    .filter((s) =>
      includesAny(s.toLowerCase(), [
        "msd80",
        "msd81",
        "i8a0s",
        "bm3",
        "bootmod3",
        "n54",
        "mhd",
      ])
    )
    .slice(0, 5);

  if (interestingStrings.length > 0) {
    notes.push(`Binary hints found: ${interestingStrings.join(", ")}.`);
  }

  return notes;
}

function estimateConfidence(args: {
  platform: TuneProfile["detectedPlatform"];
  fuelingIntent: TuneProfile["fuelingIntent"];
  boostIntent: TuneProfile["boostIntent"];
  ignitionIntent: TuneProfile["ignitionIntent"];
  detectedStrategy: string | null;
  detectedRom: string | null;
  asciiStrings: string[];
}): number {
  let confidence = 0.35;

  if (args.platform !== "unknown") confidence += 0.12;
  if (args.fuelingIntent !== "unknown") confidence += 0.08;
  if (args.boostIntent !== "low") confidence += 0.05;
  if (args.ignitionIntent !== "conservative") confidence += 0.05;
  if (args.detectedStrategy) confidence += 0.1;
  if (args.detectedRom) confidence += 0.1;
  if (args.asciiStrings.length >= 20) confidence += 0.05;

  if (confidence > 0.85) confidence = 0.85;
  return confidence;
}

export function buildTuneProfile(input: BuildTuneProfileInput) {
  const fileSizeBytes = input.fileBuffer.byteLength;
  const fileHash = createHash("sha256")
    .update(Buffer.from(input.fileBuffer))
    .digest("hex");

  const asciiStrings = bytesToAsciiStrings(input.fileBuffer);
  const text = joinSearchCorpus({
    tuneName: input.tuneName,
    fileName: input.fileName,
    asciiStrings,
  });

  const detectedPlatform = detectPlatform(text);
  const fuelingIntent = detectFuelingIntent(text);
  const boostIntent = detectBoostIntent(text);
  const ignitionIntent = detectIgnitionIntent(text);
  const { detectedStrategy, detectedRom } = detectEngineOrRomHints(text);

  const categories = buildCategories({
    text,
    fileSizeBytes,
    platform: detectedPlatform,
  });

  const notes = buildNotes({
    text,
    asciiStrings,
    fileSizeBytes,
    platform: detectedPlatform,
    fuelingIntent,
    boostIntent,
    ignitionIntent,
    detectedStrategy,
    detectedRom,
  });

  const confidence = estimateConfidence({
    platform: detectedPlatform,
    fuelingIntent,
    boostIntent,
    ignitionIntent,
    detectedStrategy,
    detectedRom,
    asciiStrings,
  });

  return {
    tune_id: input.tuneId,
    file_name: input.fileName || null,
    file_size_bytes: fileSizeBytes,
    file_hash: fileHash,

    detected_platform: detectedPlatform,
    detected_strategy: detectedStrategy,
    detected_rom: detectedRom,
    parsing_status: "profiled",
    confidence,

    boost_intent: boostIntent,
    ignition_intent: ignitionIntent,
    fueling_intent: fuelingIntent,

    categories,
    notes,
  };
}