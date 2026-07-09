import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { buildTuneProfile } from "@/lib/analysis/tuneProfile";
import { parseBinaryTuneFile } from "@/lib/tunes/parseBinaryTune";
import { detectBinaryDifferences } from "@/lib/tunes/detectBinaryDifferences";
import { fingerprintRom } from "@/lib/tunes/romFingerprint";
import path from "path";
import { buildRuntimeRomLibrary } from "@/lib/tunes/buildRunTimeRomLibrary";
import { getLibrary, hasLibrary } from "@/lib/tunes/libraryCache";

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

  let activeReferenceTuneId = referenceTuneId || null;

  if (!activeReferenceTuneId && !isStockReference) {
    const { data: latestStockTune } = await supabase
      .from("tunes")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .eq("is_stock_reference", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    activeReferenceTuneId = latestStockTune?.id ?? null;
  }

  let binaryDiffSummary = null;
  let binaryChangedBytes = 0;
  let binaryChangedRegions: unknown[] = [];

  if (activeReferenceTuneId && !isStockReference) {
    const { data: referenceTune } = await supabase
      .from("tunes")
      .select("*")
      .eq("id", activeReferenceTuneId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .single();

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
      file_path: storagePath,
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
      { error: "Tune database insert failed" },
      { status: 500 }
    );
  }

  let profile: ReturnType<typeof buildTuneProfile> | null = null;

  try {
    profile = buildTuneProfile({
      tuneId: insertedTune.id,
      tuneName: initialTuneName,
      fileName,
      fileBuffer: arrayBuffer,
    });
  } catch (profileBuildError) {
    console.error("PROFILE BUILD FAILED:", profileBuildError);
  }

  if (profile) {
    if (!hasLibrary()) {
      const root = path.join(process.cwd(), "BMW-XDFs-master");
      buildRuntimeRomLibrary(root);
    }

    const romFingerprint = fingerprintRom({
      fileName,
      binarySizeBytes: binarySummary?.fileSize ?? fileSize ?? null,
      printableStrings: binarySummary?.printableStrings ?? [],
      library: getLibrary(),
    });

    const { error: profileInsertError } = await supabase
      .from("tune_profiles")
      .insert({
        vehicle_id: vehicleId,
        user_id: user.id,

        binary_size_bytes: binarySummary?.fileSize ?? fileSize ?? null,
        binary_confidence: binarySummary?.confidence ?? null,
        parser_notes: binarySummary?.parserNotes ?? [],
        printable_strings: binarySummary?.printableStrings ?? [],
        checksum_status: "pending",
        map_scan_status: "pending",

        rom_platform: romFingerprint.platform,
        ecu_family: romFingerprint.ecu,
        rom_family: romFingerprint.romFamily,
        binary_type: romFingerprint.binaryType,
        xdf_suggested: romFingerprint.xdfSuggested,
        rom_confidence: romFingerprint.confidence,
        rom_evidence: romFingerprint.evidence,
        rom_warnings: romFingerprint.warnings,

        reference_tune_id: activeReferenceTuneId,
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

        ...profile,
      });

    if (profileInsertError) {
      console.error("TUNE PROFILE INSERT FAILED:", profileInsertError.message);
    }
  }

  return NextResponse.json({
    success: true,
    tuneId: insertedTune.id,
  });
}