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
import { compareBinaryRegions } from "@/lib/tunes/compareBinaryRegions";

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
  const formData = await request.formData();
  console.log("REFERENCE FIELD RAW:", formData.get("reference_tune_id"));
  
  const tuneNameRaw = formData.get("tune_name");
const fileNameRaw = formData.get("file_name");

const tuneNameForStockCheck =
  typeof tuneNameRaw === "string" ? tuneNameRaw.toLowerCase() : "";

const fileNameForStockCheck =
  typeof fileNameRaw === "string" ? fileNameRaw.toLowerCase() : "";

const isStockReference =

  formData.get("is_stock_reference") === "on" ||
  tuneNameForStockCheck.includes("stock") ||
  tuneNameForStockCheck.includes("original") ||
  fileNameForStockCheck.includes("stock") ||
  fileNameForStockCheck.includes("original");

 console.log("isStockReference:", isStockReference);
console.log("fileNameRaw:", fileNameRaw);
console.log("tuneNameRaw:", tuneNameRaw);

  const referenceTuneIdRaw =
  formData.get("reference_tune_id");

const referenceTuneId =
   typeof referenceTuneIdRaw === "string" &&
  referenceTuneIdRaw.length > 0
    ? referenceTuneIdRaw
    : null;

const supabase = await getSupabase();

const vehicleId = formData.get("vehicleId") as string;

let activeReferenceTuneId = referenceTuneId;

if (!activeReferenceTuneId && !isStockReference) {
  const { data: latestStockTune } = await supabase
    .from("tunes")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("is_stock_reference", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  activeReferenceTuneId = latestStockTune?.id ?? null;
}

console.log("ACTIVE REFERENCE AFTER FALLBACK:", activeReferenceTuneId);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("NO AUTH USER FOUND:", userError?.message || "No user");
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const tuneFile = formData.get("tuneFile") as File | null;
  let binarySummary = null;
  let binaryDiffSummary: any = null;
  let binaryChangedBytes = 0;
  let binaryChangedRegions: any[] = [];

if (tuneFile) {
  binarySummary = await parseBinaryTuneFile(tuneFile);
  if (!isStockReference) {
    console.log("DIFF CHECK STARTED");
    console.log("referenceTuneId:", referenceTuneId);
  const { data: stockReference } = await supabase
    .from("tunes")
    .select("*")
    .eq("id", referenceTuneId)
    .eq("vehicle_id", vehicleId)
    .single();

  if (stockReference?.storage_path) {
    console.log("STOCK REFERENCE FOUND:", stockReference);
    const { data: referenceFile } = await supabase.storage
      .from("tunes")
      .download(stockReference.storage_path);

    if (referenceFile) {
      console.log("REFERENCE FILE DOWNLOADED");
      const currentBuffer = Buffer.from(await tuneFile.arrayBuffer());
      const referenceBuffer = Buffer.from(
        await referenceFile.arrayBuffer()
      );

      const comparisonResult = compareBinaryRegions(
        binarySummary,
        currentBuffer,
        referenceBuffer
      );

      console.log("COMPARISON RESULT:", comparisonResult.metadata?.binaryComparison);

      binarySummary = comparisonResult;

      binaryDiffSummary =
        comparisonResult.metadata?.binaryComparison ?? null;

      binaryChangedBytes =
        comparisonResult.metadata?.binaryComparison
          ?.totalChangedBytes ?? 0;

      binaryChangedRegions =
        comparisonResult.metadata?.binaryComparison
          ?.changedRegions ?? [];
    }
  }
}

  console.log("BINARY PARSE RESULT:");
  console.log(binarySummary);
}
  const tuneName = (formData.get("tune_name") as string) || "";

  if (!vehicleId) {
    return NextResponse.redirect(new URL("/garage", request.url), {
      status: 303,
    });
  }

  if (!tuneFile || tuneFile.size === 0) {
    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}`, request.url),
      { status: 303 }
    );
  }

  const initialTuneName = tuneName || tuneFile.name || "Unnamed Tune";

  const { data: insertedTune, error: tuneInsertError } = await supabase
    .from("tunes")
    .insert({
      vehicle_id: vehicleId,
      user_id: user.id,
      tune_name: initialTuneName,
      file_name: null,
      file_url: null,
      reference_tune_id: referenceTuneId,
      is_stock_reference: isStockReference,
      comparison_ready: !isStockReference && !!referenceTuneId,
      binary_diff_summary: binaryDiffSummary,
      binary_changed_bytes: binaryChangedBytes,
      binary_changed_regions: binaryChangedRegions,
    })
    .select()
    .single();

  if (tuneInsertError || !insertedTune) {
    console.error(
      "INITIAL TUNE INSERT ERROR:",
      tuneInsertError?.message || "No tune inserted"
    );

    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}`, request.url),
      { status: 303 }
    );
  }

  try {
    const arrayBuffer = await tuneFile.arrayBuffer();

    const uploadBlob = new Blob([arrayBuffer], {
      type: tuneFile.type || "application/octet-stream",
    });

    const fileExt = tuneFile.name.split(".").pop() || "bin";
    const filePath = `${user.id}/${vehicleId}/${insertedTune.id}.${fileExt}`;
    let binaryDiffSummary = null;

    let binaryChangedBytes = 0;

    let binaryChangedRegions: unknown[] = [];

if (activeReferenceTuneId) {
  console.log("REFERENCE TUNE ID:", activeReferenceTuneId);
  const { data: referenceTune } = await supabase
    .from("tunes")
    .select("*")
    .eq("id", activeReferenceTuneId)
    .single();

  if (referenceTune?.file_path) {
    console.log(
      "REFERENCE FILE PATH:",
       referenceTune.file_path
    );

    const { data: referenceFileData } = await supabase.storage
      .from("tunes")
      .download(referenceTune.file_path);

    if (referenceFileData) {
      console.log("REFERENCE FILE DOWNLOADED");
      const modifiedBuffer = Buffer.from(arrayBuffer);

      const referenceArrayBuffer =
        await referenceFileData.arrayBuffer();

      const referenceBuffer = Buffer.from(referenceArrayBuffer);
      console.log("MODIFIED FILE SIZE:", modifiedBuffer.length);
      console.log("REFERENCE FILE SIZE:", referenceBuffer.length);

      console.log(
        "FIRST 20 MODIFIED BYTES:",
         modifiedBuffer.subarray(0, 20).toString("hex")
      );

      console.log(
        "FIRST 20 REFERENCE BYTES:",
        referenceBuffer.subarray(0, 20).toString("hex")
      );
      console.log("RUNNING BINARY DIFF ENGINE");

      const diffResult = detectBinaryDifferences(
        modifiedBuffer,
        referenceBuffer
     );

     console.log("DIFF RESULT:", diffResult);

     binaryDiffSummary = diffResult;

     binaryChangedBytes =
     diffResult.totalChangedBytes ?? 0;

     binaryChangedRegions =
     diffResult.changedRegions ?? [];
    
    }
  }
}
    const { error: uploadError } = await supabase.storage
      .from("tunes")
      .upload(filePath, uploadBlob, {
        upsert: false,
      });

    if (uploadError) {
      console.error("TUNE UPLOAD ERROR:", uploadError.message);

      return NextResponse.redirect(
        new URL(`/dashboard/vehicles/${vehicleId}`, request.url),
        { status: 303 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("tunes")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    if (signedUrlError) {
      console.error("SIGNED URL ERROR:", signedUrlError.message);
    }

    const { error: tuneUpdateError } = await supabase
      .from("tunes")
      .update({
        file_name: tuneFile.name,
        file_url: signedUrlData?.signedUrl || null,
      })
      .eq("id", insertedTune.id)
      .eq("user_id", user.id);

    if (tuneUpdateError) {
      console.error("TUNE ROW UPDATE ERROR:", tuneUpdateError.message);
    }

    console.log("STEP 1: Starting tune profile build");

    let profile: ReturnType<typeof buildTuneProfile> | null = null;
    
    
    try {
      profile = buildTuneProfile({
        tuneId: insertedTune.id,
        tuneName: initialTuneName,
        fileName: tuneFile.name,
        fileBuffer: arrayBuffer,
      });

      console.log("STEP 2: Profile built:", profile);
    } catch (profileBuildError) {
      console.error("PROFILE BUILD FAILED:", profileBuildError);
    }

    console.log("PROFILE RESULT:", profile);

    if (profile) {
      console.log("STEP 3: Inserting profile into DB");

     if (!hasLibrary()) {
      const root = path.join(process.cwd(), "BMW-XDFs-master");
      buildRuntimeRomLibrary(root);
    } 
    const romFingerprint = fingerprintRom({
      fileName: tuneFile?.name ?? null,
      binarySizeBytes: binarySummary?.fileSize ?? null,
      printableStrings: binarySummary?.printableStrings ?? [],
      library: getLibrary(),
    });

      const { data: insertedProfile, error: profileInsertError } = await supabase
        .from("tune_profiles")
        .insert({
  vehicle_id: vehicleId,
  user_id: user.id,

  binary_size_bytes: binarySummary?.fileSize ?? null,

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

  reference_tune_id: null,
  is_stock_reference: isStockReference,
  comparison_ready: !isStockReference,

  
  binary_diff_summary: binaryDiffSummary,

  binary_changed_bytes: binaryChangedBytes,

  binary_changed_regions: binaryChangedRegions,
  
  binary_signature:
  binarySummary?.binarySignature ??
  binarySummary?.detectedRom ??
  binarySummary?.detectedPlatform ??
  null,

  ...profile,
})
        .select()
        .single();

      if (profileInsertError) {
        console.error(
          "TUNE PROFILE INSERT FAILED:",
          profileInsertError.message
        );
      } else {
        console.log("TUNE PROFILE INSERTED:", insertedProfile);
      }
    } else {
      console.warn(
        "Profile was null, so nothing was inserted into tune_profiles"
      );
    }
  } catch (error) {
    console.error("TUNE PROCESSING ERROR:", error);
  }

  return NextResponse.redirect(
    new URL(`/dashboard/vehicles/${vehicleId}`, request.url),
    { status: 303 }
  );
}