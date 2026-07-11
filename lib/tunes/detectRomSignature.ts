import type {
  BinaryConfidence,
  TunePlatform,
} from "./types";

type RomSignatureDetection = {
  detectedPlatform: TunePlatform;
  detectedRom: string | null;
  binarySignature: string | null;
  confidence: BinaryConfidence;
  parserNotes: string[];
};

type KnownRomSignature = {
  signature: string;
  platform: TunePlatform;
  description: string;
};

const KNOWN_ROM_SIGNATURES: KnownRomSignature[] = [
  {
    signature: "I8A0S",
    platform: "MSD80",
    description: "BMW N54 MSD80",
  },
  {
    signature: "IJE0S",
    platform: "MSD81",
    description: "BMW N54 MSD81",
  },
  {
    signature: "INA0S",
    platform: "MSD81",
    description: "BMW N54 MSD81",
  },
  {
    signature: "IKM0S",
    platform: "MSD81",
    description: "BMW N54 MSD81",
  },
];

function normalisePrintableStrings(
  printableStrings: string[]
): string[] {
  return printableStrings
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function detectPlatformFromText(
  joined: string
): TunePlatform {
  if (
    joined.includes("MG1CS201") ||
    joined.includes("DME_86T0") ||
    joined.includes("86T0") ||
    joined.includes("86T1") ||
    joined.includes("98G0B")
  ) {
    return "MG1CS201";
  }

  if (
    joined.includes("MG1CS003") ||
    joined.includes("MG1CS024") ||
    joined.includes("MG1CS011") ||
    joined.includes("MG1CS002") ||
    joined.includes("MG1")
  ) {
    return "MG1";
  }

  if (
    joined.includes("MEVD17") ||
    joined.includes("MEVD172") ||
    joined.includes("MEVD17.2")
  ) {
    return "MEVD17";
  }

  if (joined.includes("MSD81")) {
    return "MSD81";
  }

  if (joined.includes("MSD80")) {
    return "MSD80";
  }

  if (joined.includes("S58")) {
    return "S58";
  }

  return "UNKNOWN";
}

function findKnownRomSignature(
  joined: string
): KnownRomSignature | null {
  return (
    KNOWN_ROM_SIGNATURES.find((entry) =>
      joined.includes(entry.signature)
    ) ?? null
  );
}

function findNumericRomSignature(
  printableStrings: string[]
): string | null {
  const candidates = new Set<string>();

  for (const value of printableStrings) {
    const matches =
      value.match(/\b[0-9]{11,16}\b/g) ?? [];

    for (const match of matches) {
      if (/^0+$/.test(match)) {
        continue;
      }

      /*
       * Long zero-prefixed identifiers are commonly used by
       * BMW Bosch MG1 software and ROM families.
       */
      if (/^0{3,}[0-9]{8,13}$/.test(match)) {
        candidates.add(match);
      }
    }
  }

  const orderedCandidates = [...candidates].sort(
    (a, b) => {
      const leadingZerosA =
        a.match(/^0+/)?.[0].length ?? 0;

      const leadingZerosB =
        b.match(/^0+/)?.[0].length ?? 0;

      if (leadingZerosA !== leadingZerosB) {
        return leadingZerosB - leadingZerosA;
      }

      return b.length - a.length;
    }
  );

  return orderedCandidates[0] ?? null;
}

export function detectRomSignature(
  printableStrings: string[]
): RomSignatureDetection {
  const normalisedStrings =
    normalisePrintableStrings(printableStrings);

  const joined = normalisedStrings.join(" ");

  const parserNotes: string[] = [];

  const knownRom = findKnownRomSignature(joined);

  if (knownRom) {
    parserNotes.push(
      `Confirmed ROM signature detected: ${knownRom.signature}.`
    );

    parserNotes.push(
      `Detected ${knownRom.description} binary identity.`
    );

    return {
      detectedPlatform: knownRom.platform,
      detectedRom: knownRom.signature,
      binarySignature: knownRom.signature,
      confidence: "high",
      parserNotes,
    };
  }

  const detectedPlatform =
    detectPlatformFromText(joined);

  const numericRomSignature =
    findNumericRomSignature(normalisedStrings);

  if (numericRomSignature) {
    const resolvedPlatform: TunePlatform =
      detectedPlatform === "UNKNOWN"
        ? "MG1"
        : detectedPlatform;

    parserNotes.push(
      `Confirmed numeric ROM signature detected: ${numericRomSignature}.`
    );

    parserNotes.push(
      `Numeric signature format is consistent with a BMW Bosch ${resolvedPlatform} binary.`
    );

    if (detectedPlatform === "UNKNOWN") {
      parserNotes.push(
        "MG1 platform family inferred from the numeric BMW ROM signature format."
      );
    } else {
      parserNotes.push(
        `Platform marker detected: ${detectedPlatform}.`
      );
    }

    return {
      detectedPlatform: resolvedPlatform,
      detectedRom: numericRomSignature,
      binarySignature: numericRomSignature,
      confidence:
        detectedPlatform === "UNKNOWN"
          ? "medium"
          : "high",
      parserNotes,
    };
  }

  if (detectedPlatform !== "UNKNOWN") {
    parserNotes.push(
      `ECU platform detected: ${detectedPlatform}.`
    );

    parserNotes.push(
      "No reliable ROM signature was detected from printable binary strings."
    );

    return {
      detectedPlatform,
      detectedRom: null,
      binarySignature: null,
      confidence: "medium",
      parserNotes,
    };
  }

  parserNotes.push(
    "No recognised ECU platform or ROM signature was detected from printable binary strings."
  );

  return {
    detectedPlatform: "UNKNOWN",
    detectedRom: null,
    binarySignature: null,
    confidence: "low",
    parserNotes,
  };
}