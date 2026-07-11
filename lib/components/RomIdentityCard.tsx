import type {
  RomIdentity,
  RomDetectionLevel,
  RomVerificationStatus,
} from "../intelligence/romIdentityAdapter";

type RomIdentityCardProps = {
  identity: RomIdentity;
};

type IdentityRowProps = {
  label: string;
  value: string | null;
};

type StatusRowProps = {
  label: string;
  value: string;
};

function formatDetectionLevel(
  level: RomDetectionLevel
): string {
  switch (level) {
    case "platform_detected":
      return "Platform Detected";

    case "ecu_detected":
      return "ECU Detected";

    case "rom_family_detected":
      return "ROM Family Detected";

    case "confirmed_rom_signature":
      return "Confirmed ROM Signature";

    case "exact_binary_match":
      return "Exact Binary Match";

    case "checksum_verified":
      return "Checksum Verified";

    default:
      return "Unknown";
  }
}

function formatVerificationStatus(
  status: RomVerificationStatus
): string {
  switch (status) {
    case "verified":
      return "Verified";

    case "valid":
      return "Valid";

    case "invalid":
      return "Invalid";

    case "matched":
      return "Matched";

    case "not_matched":
      return "Not Matched";

    case "not_available":
      return "Not Available";

    default:
      return "Awaiting Verification";
  }
}

function formatBinaryType(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case "stock":
      return "Stock Reference";

    case "mapswitch":
      return "Map-Switch Binary";

    case "modified":
      return "Modified Binary";

    default:
      return value;
  }
}

function IdentityRow({
  label,
  value,
}: IdentityRowProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-2 break-words font-medium text-white">
        {value ?? "Not yet identified"}
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
}: StatusRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-400">
        {label}
      </p>

      <p className="font-medium text-white">
        {value}
      </p>
    </div>
  );
}

export default function RomIdentityCard({
  identity,
}: RomIdentityCardProps) {
  const binarySize =
    typeof identity.binarySizeBytes === "number"
      ? `${(identity.binarySizeBytes / 1024 / 1024).toFixed(2)} MB`
      : null;

  const confidencePercent = Math.max(
    0,
    Math.min(100, Math.round(identity.confidence * 100))
  );

  const evidence =
    identity.evidence.length > 0
      ? identity.evidence
      : ["No detection evidence is currently available."];

  const warnings =
    identity.warnings.length > 0
      ? identity.warnings
      : ["No ROM identification warnings detected."];

  return (
    <div className="bmw-border space-y-8 rounded-2xl bg-zinc-900 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          ROM Identity
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          TuneSight has analysed the uploaded binary and identified its ROM,
          ECU platform and supporting calibration evidence.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Identity
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <IdentityRow
            label="Detected Platform"
            value={identity.detectedPlatform}
          />

          <IdentityRow
            label="Detected ECU"
            value={identity.detectedEcu}
          />

          <IdentityRow
            label="DME Variant"
            value={identity.dmeVariant}
          />

          <IdentityRow
            label="Confirmed ROM Signature"
            value={identity.romSignature}
          />

          <IdentityRow
            label="ROM Family"
            value={identity.romFamily}
          />

          <IdentityRow
            label="Software Version"
            value={identity.softwareVersion}
          />

          <IdentityRow
            label="Calibration ID"
            value={identity.calibrationId}
          />

          <IdentityRow
            label="Binary Type"
            value={formatBinaryType(identity.binaryType)}
          />

          <IdentityRow
            label="Binary Size"
            value={binarySize}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          ROM Library
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <IdentityRow
            label="Matching XDF"
            value={identity.matchingXdf}
          />

          <IdentityRow
            label="Stock Reference"
            value={identity.stockReference}
          />

          <IdentityRow
            label="Map-Switch Reference"
            value={identity.mapSwitchReference}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Confidence
        </h3>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                ROM Confidence
              </p>

              <p className="mt-2 text-2xl font-semibold text-white">
                {confidencePercent}%
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Detection Level
              </p>

              <p className="mt-2 font-medium text-white">
                {formatDetectionLevel(identity.detectionLevel)}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Detection Evidence
        </h3>

        <div className="space-y-2">
          {evidence.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex gap-3 rounded-xl border border-white/10 bg-black/30 p-4"
            >
              <span className="mt-0.5 text-green-400">
                ✓
              </span>

              <p className="text-sm leading-6 text-zinc-300">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Verification Status
        </h3>

        <div className="space-y-3">
          <StatusRow
            label="Checksum Family"
            value={identity.checksumFamily ?? "Not yet identified"}
          />

          <StatusRow
            label="Checksum Verification"
            value={formatVerificationStatus(
              identity.checksumVerification
            )}
          />

          <StatusRow
            label="Calibration Verification"
            value={formatVerificationStatus(
              identity.calibrationVerification
            )}
          />

          <StatusRow
            label="Exact Binary Match"
            value={formatVerificationStatus(
              identity.exactBinaryMatch
            )}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Warnings
        </h3>

        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <div
              key={`${warning}-${index}`}
              className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
            >
              <p className="text-sm leading-6 text-amber-200">
                {warning}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}