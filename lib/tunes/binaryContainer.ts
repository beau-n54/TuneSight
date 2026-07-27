export type ContainerType =
  | "bin"
  | "dtf"
  | "unknown";

export type BinaryContainerMetadata =
  Readonly<{
    fileName: string;
    mimeType: string | null;
    containerType: ContainerType;
    containerByteLength: number;
    resolutionMethod:
      | "bin_identity"
      | "dtf_raw_mg1_86t0_full_binary";
    resolutionEvidence: readonly string[];
  }>;

export type EngineeringBinary = Readonly<{
  bytes: Buffer;
  byteLength: number;
  source: BinaryContainerMetadata;
}>;

export type ContainerResolutionFailureCode =
  | "missing_payload"
  | "invalid_container"
  | "unsupported_container"
  | "dtf_extraction_unavailable";

export type ContainerResolutionResult =
  | Readonly<{
      status: "resolved";
      containerType: Exclude<
        ContainerType,
        "unknown"
      >;
      engineeringBinary: EngineeringBinary;
      errorCode: null;
      message: null;
    }>
  | Readonly<{
      status: "unresolved";
      containerType: ContainerType;
      engineeringBinary: null;
      errorCode:
        ContainerResolutionFailureCode;
      message: string;
    }>;

type BinaryContainerInput = Readonly<{
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string | null;
}>;

type BinaryContainerResolver = Readonly<{
  containerType: Exclude<
    ContainerType,
    "unknown"
  >;
  resolve: (
    input: BinaryContainerInput
  ) => ContainerResolutionResult;
}>;

function extensionOf(fileName: string): string {
  const trimmed = fileName.trim();
  const separator = trimmed.lastIndexOf(".");

  return separator >= 0
    ? trimmed.slice(separator).toLowerCase()
    : "";
}

function metadata(
  input: BinaryContainerInput,
  containerType: Exclude<
    ContainerType,
    "unknown"
  >,
  resolutionMethod:
    BinaryContainerMetadata["resolutionMethod"],
  resolutionEvidence: readonly string[]
): BinaryContainerMetadata {
  return Object.freeze({
    fileName: input.fileName,
    mimeType:
      input.mimeType?.trim() || null,
    containerType,
    containerByteLength:
      input.bytes.byteLength,
    resolutionMethod,
    resolutionEvidence:
      Object.freeze([
        ...resolutionEvidence,
      ]),
  });
}

function resolvedEngineeringBinary(
  input: BinaryContainerInput,
  containerType: Exclude<
    ContainerType,
    "unknown"
  >,
  resolutionMethod:
    BinaryContainerMetadata["resolutionMethod"],
  resolutionEvidence: readonly string[]
): ContainerResolutionResult {
  const stableBytes = Buffer.from(
    input.bytes
  );
  const source = metadata(
    input,
    containerType,
    resolutionMethod,
    resolutionEvidence
  );
  const engineeringBinary:
    EngineeringBinary =
    Object.freeze({
      get bytes() {
        return Buffer.from(stableBytes);
      },
      byteLength:
        stableBytes.byteLength,
      source,
    });

  return Object.freeze({
    status: "resolved",
    containerType,
    engineeringBinary,
    errorCode: null,
    message: null,
  });
}

const binResolver: BinaryContainerResolver =
  Object.freeze({
    containerType: "bin",

    resolve(input) {
      return resolvedEngineeringBinary(
        input,
        "bin",
        "bin_identity",
        [
          "The complete BIN payload is the Engineering Binary.",
        ]
      );
    },
  });

const RAW_MG1_86T0_DTF_BYTE_LENGTH =
  0x800000;

const RAW_MG1_86T0_DTF_MARKERS =
  Object.freeze([
    Object.freeze({
      offset: 0x2001a,
      value:
        "#DME_8XT0#C2#HWE#Hardware_DME8XT1_35UP",
    }),
    Object.freeze({
      offset: 0x2020a,
      value:
        "#DME_86Tx#C2#HWA#DME8.6.T_B58TUE_V1",
    }),
    Object.freeze({
      offset: 0x5fe1e,
      value:
        "#DME_86T0#C2#BTL#MDG1G_35up",
    }),
    Object.freeze({
      offset: 0x6a0540,
      value:
        "56/1/MG1CS201/11/MG1CS201_BX8TUE",
    }),
    Object.freeze({
      offset: 0x7ffe36,
      value:
        "#DME_86T0__________#C2#DST",
    }),
  ]);

function matchesRawMg1_86T0Dtf(
  bytes: Uint8Array
): boolean {
  if (
    bytes.byteLength !==
    RAW_MG1_86T0_DTF_BYTE_LENGTH
  ) {
    return false;
  }

  const candidate = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  return RAW_MG1_86T0_DTF_MARKERS.every(
    ({ offset, value }) =>
      candidate
        .subarray(
          offset,
          offset +
            Buffer.byteLength(value)
        )
        .equals(
          Buffer.from(value, "ascii")
        )
  );
}

const dtfResolver: BinaryContainerResolver =
  Object.freeze({
    containerType: "dtf",

    resolve(input) {
      if (
        matchesRawMg1_86T0Dtf(
          input.bytes
        )
      ) {
        return resolvedEngineeringBinary(
          input,
          "dtf",
          "dtf_raw_mg1_86t0_full_binary",
          [
            "The DTF payload is exactly 8,388,608 bytes.",
            "Fixed-offset MG1 86T0 hardware, bootloader, software-family, and dataset markers validate a complete coordinate-aligned Engineering Binary.",
            "No container header, trailer, transformation, or payload extraction is applied.",
          ]
        );
      }

      return Object.freeze({
        status: "unresolved",
        containerType: "dtf",
        engineeringBinary: null,
        errorCode:
          "dtf_extraction_unavailable",
        message:
          "TuneSight recognised this DTF container but could not verify a safe Engineering Binary extraction method for this DTF variant. The file was not analysed or persisted.",
      });
    },
  });

const resolvers =
  Object.freeze<
    readonly BinaryContainerResolver[]
  >([
    binResolver,
    dtfResolver,
  ]);

export function resolveBinaryContainer(
  input: BinaryContainerInput
): ContainerResolutionResult {
  if (!input.fileName.trim()) {
    return Object.freeze({
      status: "unresolved",
      containerType: "unknown",
      engineeringBinary: null,
      errorCode: "invalid_container",
      message:
        "Binary container filename metadata is required.",
    });
  }

  const extension = extensionOf(
    input.fileName
  );
  const resolver = resolvers.find(
    (candidate) =>
      `.${candidate.containerType}` ===
      extension
  );
  const containerType =
    resolver?.containerType ?? "unknown";

  if (input.bytes.byteLength === 0) {
    return Object.freeze({
      status: "unresolved",
      containerType,
      engineeringBinary: null,
      errorCode: "missing_payload",
      message:
        "The uploaded binary container has no payload bytes.",
    });
  }

  if (!resolver) {
    return Object.freeze({
      status: "unresolved",
      containerType: "unknown",
      engineeringBinary: null,
      errorCode: "unsupported_container",
      message:
        "The uploaded binary container format is not supported.",
    });
  }

  return resolver.resolve(input);
}
