export type StockVariantVerificationStatus =
  | "unknown"
  | "observed"
  | "candidate"
  | "provisional"
  | "verified"
  | "founder_verified"
  | "authoritatively_verified"
  | "disputed"
  | "rejected"
  | "superseded"
  | "deprecated";

export type KnowledgeConfidenceState =
  | "unknown"
  | "low"
  | "medium"
  | "high";

export type StockVariantLifecycleStatus =
  | "active"
  | "superseded"
  | "deprecated"
  | "rejected";

export type StockVariantConflictState =
  | "none"
  | "unresolved"
  | "resolved";

export type StockVariantProvenance = Readonly<{
  sourceType: string;
  sourceIdentifier: string;
  sourceLocation?: string;
  discoveryMethod?: string;
  validationMethod?: string;
  validationAuthority?: string;
  validationDate?: string;
  importedDatasetVersion?: string;
  transformationHistory?: readonly string[];
  founderValidationReference?: string;
  engineeringNotes?: string;
}>;

export type StockVariantKnowledge = Readonly<{
  id: string;
  sha256: string;
  binarySizeBytes: number;
  romFamily: string;
  ecu?: string;
  dmeVariant?: string;
  platform?: string;
  productionILevel?: string;
  bmwSoftwareVersion?: string;
  calibrationId?: string;
  manufacturingRevision?: string;
  region?: string;
  emissionsSpecification?: string;
  transmission?: string;
  fuelSystem?: string;
  verificationStatus: StockVariantVerificationStatus;
  confidence: KnowledgeConfidenceState;
  provenance: readonly StockVariantProvenance[];
  supportingEvidence: readonly string[];
  engineeringNotes?: string;
  checksumInformation?: readonly string[];
  xdfRelationships?: readonly string[];
  calibrationRelationships?: readonly string[];
  factoryReleaseInformation?: string;
  supersedesVariantIds?: readonly string[];
  lifecycleStatus: StockVariantLifecycleStatus;
  discoveredAt?: string;
  verifiedAt?: string;
  conflictState: StockVariantConflictState;
}>;

export type StockVariantLookupStatus =
  | "exact_verified"
  | "exact_candidate"
  | "family_only"
  | "conflict"
  | "unknown"
  | "invalid";

export type StockVariantLookupResult = Readonly<{
  status: StockVariantLookupStatus;
  variant: StockVariantKnowledge | null;
  romFamily: string | null;
  verificationStatus: StockVariantVerificationStatus | null;
  confidence: KnowledgeConfidenceState;
  provenanceSummary: readonly StockVariantProvenance[];
  supportingEvidence: readonly string[];
  exactMatchEvidence: Readonly<{
    sha256Matched: boolean;
    binarySizeMatched: boolean;
  }>;
  conflictState: StockVariantConflictState;
  unresolvedReason: string | null;
  candidateVariants: readonly StockVariantKnowledge[];
  explanation: string;
}>;

export type StockVariantLookupInput = Readonly<{
  sha256?: string | null;
  binarySizeBytes?: number | null;
  romFamily?: string | null;
}>;

export type StockVariantRegistry = Readonly<{
  variants: readonly StockVariantKnowledge[];
  register: (variant: StockVariantKnowledge) => StockVariantRegistry;
  lookup: (input: StockVariantLookupInput) => StockVariantLookupResult;
  variantsForRomFamily: (romFamily: string) => readonly StockVariantKnowledge[];
}>;

const AUTHORITATIVE_STATUSES = new Set<StockVariantVerificationStatus>([
  "verified",
  "founder_verified",
  "authoritatively_verified",
]);

export function isAuthoritativeStockVariantStatus(
  status: StockVariantVerificationStatus
): boolean {
  return AUTHORITATIVE_STATUSES.has(status);
}

function normaliseHash(value: string): string {
  return value.trim().toLowerCase();
}

function normaliseFamily(value: string): string {
  return value.trim().toUpperCase();
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(normaliseHash(value));
}

function isIsoDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value.trim()
    );

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function freezeVariant(variant: StockVariantKnowledge): StockVariantKnowledge {
  return Object.freeze({
    ...variant,
    sha256: normaliseHash(variant.sha256),
    provenance: Object.freeze(
      variant.provenance.map((item) =>
        Object.freeze({
          ...item,
          transformationHistory: item.transformationHistory
            ? Object.freeze([...item.transformationHistory])
            : undefined,
        })
      )
    ),
    supportingEvidence: Object.freeze([...variant.supportingEvidence]),
    checksumInformation: variant.checksumInformation
      ? Object.freeze([...variant.checksumInformation])
      : undefined,
    xdfRelationships: variant.xdfRelationships
      ? Object.freeze([...variant.xdfRelationships])
      : undefined,
    calibrationRelationships: variant.calibrationRelationships
      ? Object.freeze([...variant.calibrationRelationships])
      : undefined,
    supersedesVariantIds: variant.supersedesVariantIds
      ? Object.freeze([...variant.supersedesVariantIds])
      : undefined,
  });
}

function validateVariant(variant: StockVariantKnowledge): void {
  if (!variant.id.trim()) {
    throw new Error("Stock Variant identity is required.");
  }

  if (!isSha256(variant.sha256)) {
    throw new Error(`Stock Variant ${variant.id} has an invalid SHA-256.`);
  }

  if (!Number.isSafeInteger(variant.binarySizeBytes) || variant.binarySizeBytes <= 0) {
    throw new Error(`Stock Variant ${variant.id} has an invalid binary size.`);
  }

  if (!variant.romFamily.trim()) {
    throw new Error(`Stock Variant ${variant.id} requires a ROM Family.`);
  }

  if (variant.provenance.length === 0) {
    throw new Error(`Stock Variant ${variant.id} requires provenance.`);
  }

  if (
    isAuthoritativeStockVariantStatus(
      variant.verificationStatus
    )
  ) {
    const hasInvalidValidationDate =
      variant.provenance.some(
        (item) =>
          !!item.validationDate?.trim() &&
          !isIsoDate(item.validationDate)
      );

    if (hasInvalidValidationDate) {
      throw new Error(
        `Authoritative Stock Variant ${variant.id} has an invalid validation date.`
      );
    }

    const verifiedProvenance =
      variant.provenance.find(
        (item) =>
          !!item.validationMethod?.trim() &&
          !!item.validationAuthority?.trim() &&
          !!item.validationDate?.trim()
      );

    if (!verifiedProvenance) {
      throw new Error(
        `Authoritative Stock Variant ${variant.id} requires verified provenance.`
      );
    }

    if (
      !variant.supportingEvidence.some(
        (item) => item.trim()
      )
    ) {
      throw new Error(
        `Authoritative Stock Variant ${variant.id} requires supporting evidence.`
      );
    }
  }
}

function makeResult(
  input: Omit<StockVariantLookupResult, "exactMatchEvidence"> & {
    exactMatchEvidence?: StockVariantLookupResult["exactMatchEvidence"];
  }
): StockVariantLookupResult {
  return Object.freeze({
    ...input,
    provenanceSummary: Object.freeze([...input.provenanceSummary]),
    supportingEvidence: Object.freeze([...input.supportingEvidence]),
    candidateVariants: Object.freeze([...input.candidateVariants]),
    exactMatchEvidence: Object.freeze(
      input.exactMatchEvidence ?? {
        sha256Matched: false,
        binarySizeMatched: false,
      }
    ),
  });
}

export function createStockVariantRegistry(
  sourceVariants: readonly StockVariantKnowledge[] = []
): StockVariantRegistry {
  const byId = new Map<string, StockVariantKnowledge>();

  for (const sourceVariant of sourceVariants) {
    validateVariant(sourceVariant);
    const variant = freezeVariant(sourceVariant);
    const existing = byId.get(variant.id);

    if (existing && JSON.stringify(existing) !== JSON.stringify(variant)) {
      throw new Error(`Stock Variant identity ${variant.id} is already registered with different knowledge.`);
    }

    byId.set(variant.id, existing ?? variant);
  }

  const variants = Object.freeze([...byId.values()]);

  const registry: StockVariantRegistry = Object.freeze({
    variants,

    register(variant) {
      return createStockVariantRegistry([...variants, variant]);
    },

    variantsForRomFamily(romFamily) {
      const family = normaliseFamily(romFamily);
      return Object.freeze(
        variants.filter((variant) => normaliseFamily(variant.romFamily) === family)
      );
    },

    lookup(input) {
      const hash = input.sha256 ? normaliseHash(input.sha256) : null;
      const size = input.binarySizeBytes ?? null;
      const family = input.romFamily?.trim() || null;
      const familyCandidates = family
        ? variants.filter(
            (variant) => normaliseFamily(variant.romFamily) === normaliseFamily(family)
          )
        : [];

      if ((hash && !isSha256(hash)) || (size !== null && (!Number.isSafeInteger(size) || size <= 0))) {
        return makeResult({
          status: "invalid",
          variant: null,
          romFamily: family,
          verificationStatus: null,
          confidence: "unknown",
          provenanceSummary: [],
          supportingEvidence: [],
          conflictState: "none",
          unresolvedReason: "The supplied SHA-256 or binary size is invalid.",
          candidateVariants: familyCandidates,
          explanation: "Exact Stock Variant lookup was not executed because the identity input is invalid.",
        });
      }

      if (hash && size !== null) {
        const exactMatches = variants.filter(
          (variant) => variant.sha256 === hash && variant.binarySizeBytes === size
        );

        const incompatibleFamilyMatch = family
          ? exactMatches.find(
              (variant) =>
                normaliseFamily(variant.romFamily) !== normaliseFamily(family)
            )
          : undefined;

        if (incompatibleFamilyMatch) {
          return makeResult({
            status: "conflict",
            variant: null,
            romFamily: family,
            verificationStatus: null,
            confidence: "unknown",
            provenanceSummary: exactMatches.flatMap((variant) => variant.provenance),
            supportingEvidence: exactMatches.flatMap((variant) => variant.supportingEvidence),
            exactMatchEvidence: { sha256Matched: true, binarySizeMatched: true },
            conflictState: "unresolved",
            unresolvedReason: "Exact binary identity conflicts with the supplied ROM Family.",
            candidateVariants: exactMatches,
            explanation: "The exact bytes are known, but contradictory ROM Family evidence prevents authoritative selection.",
          });
        }

        const authoritativeMatches =
          exactMatches.filter((variant) =>
            isAuthoritativeStockVariantStatus(
              variant.verificationStatus
            )
          );

        const authoritativeMatch =
          authoritativeMatches.length === 1
            ? authoritativeMatches[0]
            : null;

        const hasContradictoryContext =
          authoritativeMatch
            ? exactMatches.some((variant) => {
                const conflicts = (
                  left?: string,
                  right?: string
                ) =>
                  !!left &&
                  !!right &&
                  normaliseFamily(left) !==
                    normaliseFamily(right);

                return (
                  conflicts(
                    authoritativeMatch.romFamily,
                    variant.romFamily
                  ) ||
                  conflicts(
                    authoritativeMatch.platform,
                    variant.platform
                  ) ||
                  conflicts(
                    authoritativeMatch.ecu,
                    variant.ecu
                  ) ||
                  conflicts(
                    authoritativeMatch.dmeVariant,
                    variant.dmeVariant
                  )
                );
              })
            : false;

        if (
          exactMatches.length > 1 &&
          (!authoritativeMatch ||
            hasContradictoryContext)
        ) {
          return makeResult({
            status: "conflict",
            variant: null,
            romFamily: family,
            verificationStatus: null,
            confidence: "unknown",
            provenanceSummary: exactMatches.flatMap((variant) => variant.provenance),
            supportingEvidence: exactMatches.flatMap((variant) => variant.supportingEvidence),
            exactMatchEvidence: { sha256Matched: true, binarySizeMatched: true },
            conflictState: "unresolved",
            unresolvedReason: "Multiple Stock Variant records claim the same exact binary identity.",
            candidateVariants: exactMatches,
            explanation: "The exact binary identity is present, but conflicting Knowledge Objects prevent authoritative selection.",
          });
        }

        const exact =
          authoritativeMatch ??
          exactMatches[0];
        if (exact) {
          const authoritative =
            isAuthoritativeStockVariantStatus(
              exact.verificationStatus
            );
          const corroboratingCandidates =
            authoritative
              ? exactMatches.filter(
                  (variant) =>
                    variant.id !== exact.id
                )
              : [];

          return makeResult({
            status: authoritative ? "exact_verified" : "exact_candidate",
            variant: exact,
            romFamily: exact.romFamily,
            verificationStatus: exact.verificationStatus,
            confidence: exact.confidence,
            provenanceSummary:
              exactMatches.flatMap(
                (variant) =>
                  variant.provenance
              ),
            supportingEvidence:
              exactMatches.flatMap(
                (variant) =>
                  variant.supportingEvidence
              ),
            exactMatchEvidence: { sha256Matched: true, binarySizeMatched: true },
            conflictState: exact.conflictState,
            unresolvedReason: authoritative
              ? null
              : "Exact binary knowledge exists but is not authoritatively verified.",
            candidateVariants: authoritative
              ? corroboratingCandidates
              : [exact],
            explanation: authoritative
              ? corroboratingCandidates.length > 0
                ? "SHA-256 and binary size exactly match an authoritatively qualified Stock Variant with additional qualified candidate provenance."
                : "SHA-256 and binary size exactly match an authoritatively qualified Stock Variant."
              : "SHA-256 and binary size exactly match a qualified candidate Stock Variant.",
          });
        }
      }

      if (familyCandidates.length > 0) {
        return makeResult({
          status: "family_only",
          variant: null,
          romFamily: family,
          verificationStatus: null,
          confidence: "unknown",
          provenanceSummary: [],
          supportingEvidence: [],
          conflictState: "none",
          unresolvedReason: "ROM Family knowledge exists, but no exact SHA-256 and binary-size match exists.",
          candidateVariants: familyCandidates,
          explanation: "ROM Family membership does not establish exact Stock Variant identity.",
        });
      }

      return makeResult({
        status: "unknown",
        variant: null,
        romFamily: family,
        verificationStatus: null,
        confidence: "unknown",
        provenanceSummary: [],
        supportingEvidence: [],
        conflictState: "none",
        unresolvedReason: "No exact Stock Variant knowledge is registered for the supplied identity.",
        candidateVariants: [],
        explanation: "The Stock Variant remains unknown.",
      });
    },
  });

  return registry;
}
