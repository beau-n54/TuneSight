import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { buildTuneProfile } from "@/lib/analysis/tuneProfile";
import { parseEngineeringBinary } from "@/lib/tunes/parseBinaryTune";
import { detectBinaryDifferences } from "@/lib/tunes/detectBinaryDifferences";
import {
  fingerprintRom,
  type RomFingerprintResult,
} from "@/lib/tunes/romFingerprint";
import type {
  BinaryConfidence,
  VerificationStatus,
} from "@/lib/tunes/types";
import type { BinaryComparisonEvidence } from "@/lib/tunes/binaryClassification";
import path from "path";
import { buildRuntimeRomLibrary } from "@/lib/tunes/buildRunTimeRomLibrary";
import {
  getLibrary,
  hasLibrary,
  lookupRuntimeStockVariantKnowledge,
} from "@/lib/tunes/libraryCache";
import { interpretRuntimeStockVariantKnowledge } from "@/lib/tunes/vehicleIdentityKnowledgeInterpretation";
import { calculateBinaryHash } from "@/lib/tunes/calculateBinaryHash";
import { qualifyComparisonReference } from "@/lib/tunes/comparisonReferenceQualification";
import { resolveBinaryContainer } from "@/lib/tunes/binaryContainer";

type TuneProfileInsertPayload =
  ReturnType<typeof buildTuneProfile> & {
    vehicle_id: string;
    user_id: string;

    binary_size_bytes: number | null;
    binary_confidence: BinaryConfidence | null;
    parser_notes: string[];
    printable_strings: string[];

    software_version: string | null;
    calibration_id: string | null;
    checksum_family: string | null;
    checksum_status: VerificationStatus;
    checksum_verification_status: VerificationStatus;
    calibration_verification_status: VerificationStatus;
    exact_binary_match_status: VerificationStatus;
    map_scan_status: "pending";

    rom_platform: string | null;
    ecu_family: string | null;
    dme_variant: string | null;
    rom_family: string | null;
    binary_type: RomFingerprintResult["binaryType"];
    xdf_suggested: string | null;
    stock_bin_suggested: string | null;
    map_switch_bin_suggested: string | null;
    rom_confidence: number;
    rom_evidence: string[];
    rom_warnings: string[];

    reference_tune_id: string | null;
    is_stock_reference: boolean;
    comparison_ready: boolean;

    binary_diff_summary: ReturnType<typeof detectBinaryDifferences> | null;
    binary_changed_bytes: number;
    binary_changed_regions: unknown[];
    binary_signature: string | null;
  };

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(request: Request) {
  const supabase = await getSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const {
    vehicleId,
    tuneName,
    fileName,
    fileSize,
    fileType,
    storageBucket,
    storagePath,
    isStockReference,
    referenceTuneId,
  } = body;

  if (!vehicleId || !storagePath || !fileName) {
    return NextResponse.json(
      { error: "Missing tune upload metadata" },
      { status: 400 }
    );
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const { data: currentFile, error: downloadError } = await supabase.storage
    .from(storageBucket || "tunes")
    .download(storagePath);

  if (downloadError || !currentFile) {
    console.error("CURRENT TUNE DOWNLOAD ERROR:", downloadError?.message);

    return NextResponse.json(
      { error: "Could not download uploaded tune file" },
      { status: 500 }
    );
  }

  const arrayBuffer = await currentFile.arrayBuffer();
  const currentBuffer = Buffer.from(arrayBuffer);

  async function cleanupUploadedStorageObject() {
    const { error: storageCleanupError } = await supabase.storage
      .from(storageBucket || "tunes")
      .remove([storagePath]);

    if (storageCleanupError) {
      console.error("PARTIAL TUNE CLEANUP FAILED", {
        stage: "storage_object",
        message: storageCleanupError.message,
      });
    }
  }

  const currentResolution =
    resolveBinaryContainer({
      bytes: currentBuffer,
      fileName,
      mimeType: fileType,
    });

  if (currentResolution.status === "unresolved") {
    await cleanupUploadedStorageObject();

    return NextResponse.json(
      {
        error: currentResolution.message,
        code: currentResolution.errorCode,
      },
      {
        status:
          currentResolution.errorCode ===
          "unsupported_container"
            ? 415
            : 422,
      }
    );
  }

  const currentEngineeringBinary =
    currentResolution.engineeringBinary;
  const binarySummary =
    await parseEngineeringBinary(
      currentEngineeringBinary
    );

  if (!hasLibrary()) {
    const root = path.join(process.cwd(), "BMW-XDFs-master");
    buildRuntimeRomLibrary(root);
  }

  let activeReferenceTuneId =
    isStockReference
      ? null
      : referenceTuneId || null;

  let activeReferenceTuneProfileId: string | null = null;

  if (!activeReferenceTuneId && !isStockReference) {
    const { data: latestStockTune } = await supabase
      .from("tunes")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .eq("is_stock_reference", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    activeReferenceTuneId = latestStockTune?.id ?? null;
  }

  let binaryDiffSummary = null;
  let binaryChangedBytes = 0;
  let binaryChangedRegions: unknown[] = [];
  let binaryComparisonEvidence: BinaryComparisonEvidence | null = null;

  if (activeReferenceTuneId && !isStockReference) {
    const {
      data: referenceTune,
      error: referenceTuneError,
    } = await supabase
      .from("tunes")
      .select("*")
      .eq("id", activeReferenceTuneId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .eq("is_stock_reference", true)
      .maybeSingle();

    if (referenceTuneError || !referenceTune) {
      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The selected stock reference tune is unavailable or invalid for this vehicle.",
        },
        { status: 400 }
      );
    }

    const {
      data: referenceTuneProfile,
      error: referenceTuneProfileError,
    } = await supabase
      .from("tune_profiles")
      .select("id, rom_family")
      .eq("tune_id", referenceTune.id)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .eq("is_stock_reference", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (referenceTuneProfileError || !referenceTuneProfile) {
      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The selected stock reference has no valid identity profile.",
        },
        { status: 422 }
      );
    }

    activeReferenceTuneProfileId = referenceTuneProfile.id;

    const referencePath = referenceTune.storage_path;

    if (!referencePath) {
      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The selected stock reference has no stored binary object path. Re-upload the stock reference before comparing tunes.",
          code: "REFERENCE_STORAGE_PATH_MISSING",
        },
        { status: 422 }
      );
    }

    const {
      data: referenceFile,
      error: referenceDownloadError,
    } = await supabase.storage
      .from("tunes")
      .download(referencePath);

    if (referenceDownloadError || !referenceFile) {
      console.error("REFERENCE TUNE DOWNLOAD FAILED", {
        code: referenceDownloadError?.name ?? null,
        message: referenceDownloadError?.message ?? "Reference file unavailable",
      });

      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The selected stock reference binary could not be downloaded.",
          code: "REFERENCE_BINARY_UNAVAILABLE",
        },
        { status: 422 }
      );
    }

    const referenceArrayBuffer = await referenceFile.arrayBuffer();
    const referenceBuffer = Buffer.from(referenceArrayBuffer);
    const referenceResolution =
      resolveBinaryContainer({
        bytes: referenceBuffer,
        fileName:
          referenceTune.file_name ??
          "",
        mimeType: null,
      });

    if (
      referenceResolution.status ===
      "unresolved"
    ) {
      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The selected comparison reference could not be resolved to an Engineering Binary.",
          code:
            referenceResolution.errorCode,
        },
        { status: 422 }
      );
    }

    const referenceEngineeringBinary =
      referenceResolution.engineeringBinary;
    const referenceKnowledge =
      lookupRuntimeStockVariantKnowledge({
        sha256:
          calculateBinaryHash(
            referenceEngineeringBinary
              .bytes
          ),
        binarySizeBytes:
          referenceEngineeringBinary
            .byteLength,
        romFamily:
          referenceTuneProfile.rom_family,
      });
    const referenceQualification =
      qualifyComparisonReference(
        referenceKnowledge
      );

    let diffResult: ReturnType<typeof detectBinaryDifferences>;

    try {
      diffResult = detectBinaryDifferences(
        currentEngineeringBinary,
        referenceEngineeringBinary
      );
    } catch (comparisonError) {
      console.error("BINARY COMPARISON FAILED", {
        message:
          comparisonError instanceof Error
            ? comparisonError.message
            : "Unknown binary comparison error",
      });

      await cleanupUploadedStorageObject();

      return NextResponse.json(
        {
          error:
            "The uploaded binary could not be compared with the selected stock reference.",
          code: "BINARY_COMPARISON_FAILED",
        },
        { status: 422 }
      );
    }

    binaryDiffSummary = diffResult;
    binaryChangedBytes = diffResult.totalChangedBytes ?? 0;
    binaryChangedRegions = diffResult.changedRegions ?? [];
    binaryComparisonEvidence = {
      referenceClassification:
        referenceQualification
          .referenceClassification,
      referenceQualification,
      totalChangedBytes: binaryChangedBytes,
      uploadedSizeBytes:
        currentEngineeringBinary
          .byteLength,
      referenceSizeBytes:
        referenceEngineeringBinary
          .byteLength,
    };
  }

  const initialTuneName = tuneName || fileName || "Unnamed Tune";

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(storageBucket || "tunes")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedUrlError) {
    console.error("SIGNED URL ERROR:", signedUrlError.message);
  }

  const { data: insertedTune, error: tuneInsertError } = await supabase
    .from("tunes")
    .insert({
      vehicle_id: vehicleId,
      user_id: user.id,
      tune_name: initialTuneName,
      file_name: fileName,
      file_url: signedUrlData?.signedUrl || null,
      storage_path: storagePath,
      reference_tune_id: activeReferenceTuneId,
      is_stock_reference: !!isStockReference,
      comparison_ready: !isStockReference && !!activeReferenceTuneId,
      binary_diff_summary: binaryDiffSummary,
      binary_changed_bytes: binaryChangedBytes,
      binary_changed_regions: binaryChangedRegions,
    })
    .select()
    .single();

  if (tuneInsertError || !insertedTune) {
  console.error("TUNE INSERT ERROR:", tuneInsertError?.message);

  return NextResponse.json(
    {
      error: "Tune database insert failed",
      details: tuneInsertError?.message ?? null,
      hint: tuneInsertError?.hint ?? null,
      code: tuneInsertError?.code ?? null,
    },
    { status: 500 }
  );
}

  const authenticatedUserId = user.id;

  async function cleanupPartialTune(tuneId: string) {
    const { error: tuneCleanupError } = await supabase
      .from("tunes")
      .delete()
      .eq("id", tuneId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", authenticatedUserId);

    if (tuneCleanupError) {
      console.error("PARTIAL TUNE CLEANUP FAILED", {
        stage: "tune_row",
        code: tuneCleanupError.code ?? null,
        message: tuneCleanupError.message,
      });
    }

    await cleanupUploadedStorageObject();
  }

  let profile: ReturnType<typeof buildTuneProfile>;

  try {
    profile = buildTuneProfile({
      tuneId: insertedTune.id,
      tuneName: initialTuneName,
      fileName,
      fileBuffer:
        currentEngineeringBinary.bytes,
    });
  } catch (profileBuildError) {
    console.error("PROFILE BUILD FAILED", {
      message:
        profileBuildError instanceof Error
          ? profileBuildError.message
          : "Unknown profile construction error",
    });

    await cleanupPartialTune(insertedTune.id);

    return NextResponse.json(
      { error: "Tune identity profile construction failed" },
      { status: 500 }
    );
  }

  const legacyRomFingerprint = fingerprintRom({
      binaryBytes:
        currentEngineeringBinary.bytes,
      binarySizeBytes:
        binarySummary?.fileSize ??
        fileSize ??
        null,

      binaryHash:
        binarySummary?.metadata?.binaryHash ??
        null,

      printableStrings:
        binarySummary?.printableStrings ??
        [],

      library: getLibrary(),

      comparison: binaryComparisonEvidence,
  });

  const runtimeStockVariantKnowledge =
    lookupRuntimeStockVariantKnowledge({
      sha256:
        binarySummary?.metadata?.binaryHash ??
        null,
      binarySizeBytes:
        binarySummary?.fileSize ??
        fileSize ??
        null,
      romFamily:
        legacyRomFingerprint.romFamily,
    });

  const vehicleIdentityKnowledgeInterpretation =
    interpretRuntimeStockVariantKnowledge({
      knowledge: runtimeStockVariantKnowledge,
      legacyFingerprint: legacyRomFingerprint,
    });

  const romFingerprint =
    legacyRomFingerprint;

  const profilePayload: TuneProfileInsertPayload = {
        ...profile,

        vehicle_id: vehicleId,
        user_id: user.id,

        binary_size_bytes: binarySummary?.fileSize ?? fileSize ?? null,
        binary_confidence: binarySummary?.confidence ?? null,
        parser_notes: binarySummary?.parserNotes ?? [],
        printable_strings: binarySummary?.printableStrings ?? [],
        software_version:
          binarySummary?.metadata?.softwareVersion ?? null,
        calibration_id:
          binarySummary?.metadata?.calibrationVerificationStatus ===
            "verified" ||
          binarySummary?.metadata?.calibrationVerificationStatus ===
            "matched"
            ? binarySummary.metadata.calibrationId ?? null
            : null,
        checksum_family:
          binarySummary?.metadata?.checksumFamily ?? null,
        checksum_status:
          binarySummary?.metadata?.checksumVerificationStatus ?? "pending",
        checksum_verification_status:
          binarySummary?.metadata?.checksumVerificationStatus ?? "pending",
        calibration_verification_status:
          binarySummary?.metadata?.calibrationVerificationStatus ?? "pending",
        exact_binary_match_status:
          vehicleIdentityKnowledgeInterpretation
            .exactBinaryMatch
            ? "matched"
            : vehicleIdentityKnowledgeInterpretation
                  .binaryType === "modified"
              ? "not_matched"
              : binarySummary?.metadata?.exactBinaryMatchStatus ?? "pending",
        map_scan_status: "pending",

        rom_platform: romFingerprint.platform,
        ecu_family:
          binarySummary?.detectedPlatform === "MSD80" ||
          binarySummary?.detectedPlatform === "MSD81"
            ? binarySummary.detectedPlatform
            : romFingerprint.ecu ??
              (binarySummary?.detectedPlatform !== "UNKNOWN"
                ? binarySummary.detectedPlatform
                : null),
        dme_variant:
          binarySummary?.detectedPlatform === "MSD80" ||
          binarySummary?.detectedPlatform === "MSD81"
            ? binarySummary.detectedPlatform
            : romFingerprint.ecu ??
              (binarySummary?.detectedPlatform !== "UNKNOWN"
                ? binarySummary.detectedPlatform
                : null),
        rom_family: romFingerprint.romFamily,
        binary_type:
          vehicleIdentityKnowledgeInterpretation
            .binaryType,
        xdf_suggested: romFingerprint.xdfSuggested,
        stock_bin_suggested: romFingerprint.stockBinSuggested,
        map_switch_bin_suggested: romFingerprint.mapSwitchBinSuggested,
        rom_confidence: romFingerprint.confidence,
        rom_evidence: [
          ...vehicleIdentityKnowledgeInterpretation
            .evidence,
        ],
        rom_warnings: [
          ...vehicleIdentityKnowledgeInterpretation
            .warnings,
        ],

        reference_tune_id: activeReferenceTuneProfileId,
        is_stock_reference: !!isStockReference,
        comparison_ready: !isStockReference && !!activeReferenceTuneId,

        binary_diff_summary: binaryDiffSummary,
        binary_changed_bytes: binaryChangedBytes,
        binary_changed_regions: binaryChangedRegions,

        binary_signature:
          binarySummary?.binarySignature ??
          binarySummary?.detectedRom ??
          binarySummary?.detectedPlatform ??
          null,
  };

  const {
    data: insertedProfile,
    error: profileInsertError,
  } = await supabase
    .from("tune_profiles")
    .insert(profilePayload)
    .select("*")
    .single();

  if (profileInsertError || !insertedProfile) {
    console.error("TUNE PROFILE INSERT FAILED", {
      code: profileInsertError?.code ?? null,
      message:
        profileInsertError?.message ??
        "No tune profile row returned",
    });

    await cleanupPartialTune(insertedTune.id);

    return NextResponse.json(
      {
        error: "Tune identity profile persistence failed",
        code: profileInsertError?.code ?? null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    tuneId: insertedTune.id,
    tuneProfileId: insertedProfile.id,
  });
}
