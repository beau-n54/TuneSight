import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { buildTuneProfile } from "@/lib/analysis/tuneProfile";
import { parseBinaryTuneFile } from "@/lib/tunes/parseBinaryTune";
import { detectBinaryDifferences } from "@/lib/tunes/detectBinaryDifferences";
import {
  fingerprintRom,
  type RomFingerprintResult,
} from "@/lib/tunes/romFingerprint";
import type {
  BinaryConfidence,
  VerificationStatus,
} from "@/lib/tunes/types";
import path from "path";
import { buildRuntimeRomLibrary } from "@/lib/tunes/buildRunTimeRomLibrary";
import { getLibrary, hasLibrary } from "@/lib/tunes/libraryCache";

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

  const binarySummary = await parseBinaryTuneFile(currentFile as File);

  let activeReferenceTuneId =
    isStockReference
      ? null
      : referenceTuneId || null;

  let activeReferenceTuneProfileId: string | null = null;

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
      .select("id")
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

    const referencePath = referenceTune?.file_path || referenceTune?.storage_path;

    if (referencePath) {
      const { data: referenceFile } = await supabase.storage
        .from("tunes")
        .download(referencePath);

      if (referenceFile) {
        const referenceArrayBuffer = await referenceFile.arrayBuffer();
        const referenceBuffer = Buffer.from(referenceArrayBuffer);

        const diffResult = detectBinaryDifferences(
          currentBuffer,
          referenceBuffer
        );

        binaryDiffSummary = diffResult;
        binaryChangedBytes = diffResult.totalChangedBytes ?? 0;
        binaryChangedRegions = diffResult.changedRegions ?? [];
      }
    }
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
      fileBuffer: arrayBuffer,
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

  if (!hasLibrary()) {
    const root = path.join(process.cwd(), "BMW-XDFs-master");
    buildRuntimeRomLibrary(root);
  }

  const romFingerprint = fingerprintRom({
      fileName,

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
  });

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
          romFingerprint.exactBinaryMatch
            ? "matched"
            : binarySummary?.metadata?.exactBinaryMatchStatus ?? "not_matched",
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
        binary_type: romFingerprint.binaryType,
        xdf_suggested: romFingerprint.xdfSuggested,
        stock_bin_suggested: romFingerprint.stockBinSuggested,
        map_switch_bin_suggested: romFingerprint.mapSwitchBinSuggested,
        rom_confidence: romFingerprint.confidence,
        rom_evidence: romFingerprint.evidence,
        rom_warnings: romFingerprint.warnings,

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
