import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { buildAnalysisResult } from "@/lib/analysis/engine";
import {
  createSupabaseEvidencePersistenceDatabase,
  persistCandidateEvidenceSummary,
} from "@/lib/analysis/evidenceCandidatePersistence";
import { runDurableEvidenceProcessingAttempt } from "@/lib/analysis/durableEvidenceProcessingIntegration";
import {
  createSupabaseEvidenceLifecycleDatabase,
  EvidenceLifecycleWriteError,
  recordEvidenceProcessingFailure,
} from "@/lib/analysis/evidenceLifecyclePersistence";
import { qualifyEvidenceSource } from "@/lib/analysis/evidenceSourceQualification";
import type { TranslatedLog } from "@/lib/logging/types";
import { buildQualifiedParsedLog } from "@/lib/analysis/qualifiedAnalysisInput";
import { parseBoundedLogCsv } from "@/lib/logging/boundedCsv";
import { maximumObserved as maximum, minimumObserved as minimum } from "@/lib/logging/numericSummary";
import { validLogUpload, UUID_PATTERN } from "@/lib/security/uploadPolicy";
import { claimUpload, finishUpload } from "@/lib/security/uploadAttempts.server";
import { createHash } from "node:crypto";
import type {
  ParsedLog,
  TuneProfile,
  VehicleSetup,
} from "@/lib/analysis/types";

type NumericRow = Record<string, unknown>;
const parseCSV = parseBoundedLogCsv;
type ExtractedChannels = Record<"boostValues" | "boostTargetValues" | "iatValues" | "afrValues" | "railPressureValues" | "lpfpValues" | "wgdcValues" | "ethanolValues" | "throttleValues" | "cyl1Vals" | "cyl2Vals" | "cyl3Vals" | "cyl4Vals" | "cyl5Vals" | "cyl6Vals", number[]>;

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildParsedLogFromTranslatedLog(translatedLog: TranslatedLog): { parsedLog: ParsedLog; extracted: ExtractedChannels } {
  const parsedLog = buildQualifiedParsedLog(translatedLog);
  const c = parsedLog.channels;
  return { parsedLog, extracted: { boostValues: c.boost, boostTargetValues: c.boost_target, iatValues: c.iat, afrValues: c.afr, railPressureValues: c.rail_pressure, lpfpValues: c.lpfp, wgdcValues: c.wgdc, ethanolValues: c.ethanol, throttleValues: c.throttle, cyl1Vals: c.timing_correction_cyl_1, cyl2Vals: c.timing_correction_cyl_2, cyl3Vals: c.timing_correction_cyl_3, cyl4Vals: c.timing_correction_cyl_4, cyl5Vals: c.timing_correction_cyl_5, cyl6Vals: c.timing_correction_cyl_6 } };
}

type VehicleRow = { id: string; make?: string; model?: string; year?: number; engine_code?: string; fuel_type?: string; turbo_setup?: string; turbos?: string; fueling_setup?: string; fuel_system?: string; intercooler?: string; map_sensor?: number; transmission?: string; horsepower_goal?: number; port_injection?: boolean };
type TuneRow = { tune_id: string; tune_name?: string; file_name?: string; detected_platform?: TuneProfile["detectedPlatform"]; detected_strategy?: string; detected_rom?: string; parsing_status?: TuneProfile["parsingStatus"]; confidence?: number; boost_intent?: TuneProfile["boostIntent"]; ignition_intent?: TuneProfile["ignitionIntent"]; fueling_intent?: TuneProfile["fuelingIntent"]; categories?: string[]; notes?: string[] };

function mapVehicleSetup(vehicleRow: VehicleRow | null): VehicleSetup | null {
  if (!vehicleRow) return null;

  return {
    vehicleId: vehicleRow.id,

    make: vehicleRow.make ?? null,
    model: vehicleRow.model ?? null,
    year: vehicleRow.year ?? null,
    engineCode: vehicleRow.engine_code ?? null,

    fuelType: vehicleRow.fuel_type ?? null,

    turboSetup: vehicleRow.turbo_setup ?? vehicleRow.turbos ?? null,

    fuelingSetup: vehicleRow.fueling_setup ?? vehicleRow.fuel_system ?? null,

    intercooler: vehicleRow.intercooler ?? null,
    mapSensorBar: vehicleRow.map_sensor ?? null,
    transmissionTune: vehicleRow.transmission ?? null,
    horsepowerGoal: vehicleRow.horsepower_goal ?? null,
    portInjection: vehicleRow.port_injection ?? null,

    fuelBlend: null,
    hpfpSetup: null,
    lpfpSetup: null,
    injectorSizeCc: null,
    useCase: null,
  };
}

function mapTuneProfile(tuneProfileRow: TuneRow | null): TuneProfile | null {
  if (!tuneProfileRow) return null;

  return {
    tuneId: tuneProfileRow.tune_id,
    tuneName: tuneProfileRow.tune_name ?? null,
    fileName: tuneProfileRow.file_name ?? null,
    detectedPlatform: tuneProfileRow.detected_platform ?? "unknown",
    detectedStrategy: tuneProfileRow.detected_strategy ?? null,
    detectedRom: tuneProfileRow.detected_rom ?? null,
    parsingStatus: tuneProfileRow.parsing_status ?? "raw",
    confidence:
      typeof tuneProfileRow.confidence === "number" ? tuneProfileRow.confidence : 0,
    boostIntent: tuneProfileRow.boost_intent ?? null,
    ignitionIntent: tuneProfileRow.ignition_intent ?? null,
    fuelingIntent: tuneProfileRow.fueling_intent ?? null,
    categories: Array.isArray(tuneProfileRow.categories)
      ? tuneProfileRow.categories
      : [],
    notes: Array.isArray(tuneProfileRow.notes) ? tuneProfileRow.notes : [],
  };
}

function buildSummaryPayload(args: {
  headers: string[];
  rows: NumericRow[];
  extracted: ExtractedChannels;
  analysis: ReturnType<typeof buildAnalysisResult>;
}) {
  const {
    headers,
    rows,
    extracted: {
      boostValues,
      boostTargetValues,
      iatValues,
      afrValues,
      railPressureValues,
      lpfpValues,
      wgdcValues,
      ethanolValues,
      throttleValues,
      cyl1Vals,
      cyl2Vals,
      cyl3Vals,
      cyl4Vals,
      cyl5Vals,
      cyl6Vals,
    },
    analysis,
  } = args;

  const maxThrottle = maximum(throttleValues);
  const throttleClosureDetected = analysis.summary.throttleClosureDetected;

  return {
    avg_boost: average(boostValues),
    max_boost: maximum(boostValues),

    avg_boost_target: average(boostTargetValues),
    max_boost_target: maximum(boostTargetValues),

    avg_timing: null,
    max_iat: maximum(iatValues),
    min_afr: minimum(afrValues),

    max_timing_correction: minimum([
      ...cyl1Vals,
      ...cyl2Vals,
      ...cyl3Vals,
      ...cyl4Vals,
      ...cyl5Vals,
      ...cyl6Vals,
    ]),

    cyl1_max_timing_correction: minimum(cyl1Vals),
    cyl2_max_timing_correction: minimum(cyl2Vals),
    cyl3_max_timing_correction: minimum(cyl3Vals),
    cyl4_max_timing_correction: minimum(cyl4Vals),
    cyl5_max_timing_correction: minimum(cyl5Vals),
    cyl6_max_timing_correction: minimum(cyl6Vals),

    min_rail_pressure: minimum(railPressureValues),
    min_lpfp: minimum(lpfpValues),
    max_wgdc: maximum(wgdcValues),
    ethanol_content: average(ethanolValues),

    max_throttle_closure: maxThrottle,
    throttle_closure_detected: throttleClosureDetected,

    summary: {
      rows_parsed: rows.length,
      headers_detected: headers,
      boost_samples: boostValues.length,
      boost_target_samples: boostTargetValues.length,
      iat_samples: iatValues.length,
      afr_samples: afrValues.length,
      rail_pressure_samples: railPressureValues.length,
      lpfp_samples: lpfpValues.length,
      wgdc_samples: wgdcValues.length,
      ethanol_samples: ethanolValues.length,
      throttle_samples: throttleValues.length,
      cyl1_samples: cyl1Vals.length,
      cyl2_samples: cyl2Vals.length,
      cyl3_samples: cyl3Vals.length,
      cyl4_samples: cyl4Vals.length,
      cyl5_samples: cyl5Vals.length,
      cyl6_samples: cyl6Vals.length,

      engine_v2: {
        inputQualification: analysis.inputQualification,
        fuelValidation: analysis.fuelValidation,
        fuelPressureThresholds: analysis.fuelPressureThresholds,
        pipelineWarnings: analysis.pipelineWarnings,
        routedEvents: analysis.routedEvents,
        quickVerdict: analysis.quickVerdict,
        pullWindows: analysis.pullWindows,
        events: analysis.events,
        warnings: analysis.warnings,
        suggestedFixes: analysis.suggestedFixes,
        crossReferences: analysis.crossReferences,

        telemetry: analysis.telemetry,
        worstCylinder: analysis.worstCylinder,
        diagnosticTimeline: analysis.diagnosticTimeline,
      },
    },
  };
}

async function handlePOST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const vehicleId = formData.get("vehicleId") as string;
  const file = formData.get("logFile") as File | null;
  const logName = (formData.get("log_name") as string) || "";

  if (typeof vehicleId !== "string" || !UUID_PATTERN.test(vehicleId)) {
    return NextResponse.redirect(new URL("/garage", request.url), {
      status: 303,
    });
  }

  if (!(file instanceof File) || !validLogUpload(file) || logName.length > 256) {
    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url),
      { status: 303 }
    );
  }

  const initialLogName = logName || file.name || "Unnamed Log";
  const { data: ownedVehicle, error: ownerError } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", user.id).single();
  if (ownerError || !ownedVehicle) return NextResponse.json({ error: "Vehicle unavailable." }, { status: 404 });
  const arrayBuffer = await file.arrayBuffer();
  let uploadedFileText: string;
  let parsedSource: ReturnType<typeof parseCSV>;
  try { uploadedFileText = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer); parsedSource = parseCSV(uploadedFileText); }
  catch { return NextResponse.json({ error: "A bounded, valid UTF-8 CSV log with unique headers and aligned rows is required." }, { status: 422 }); }
  const digest = createHash("sha256").update(new Uint8Array(arrayBuffer)).digest("hex");
  const reservation = await claimUpload(supabase, vehicleId, "log", digest);
  if (reservation.outcome === "busy") return NextResponse.json({ error: "This upload is already processing. Retry later with the same file." }, { status: 409 });
  if (reservation.outcome === "completed") return NextResponse.redirect(new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url), { status: 303 });

  const trustedClient = createTrustedServerClient();
  let completed = false;
  try {
  const { data: insertedLog, error: insertError } = await trustedClient
    .from("logs")
    .upsert({
      id: reservation.resource_id,
      vehicle_id: vehicleId,
      user_id: user.id,
      log_name: initialLogName,
      file_name: null,
      file_url: null,
    }, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  const existingLog = !insertError && !insertedLog ? (await supabase.from("logs").select("id,authoritative_log_summary_id").eq("id", reservation.resource_id).eq("user_id", user.id).eq("vehicle_id", vehicleId).single()).data : null;
  const registeredLog = insertedLog ?? existingLog;

  if (insertError || !registeredLog) {
    console.error("Evidence source registration failed", {
      failure: "source_registration_failure",
      vehicleId,
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/vehicles/${vehicleId}/logs?evidence_status=registration_failed`,
        request.url
      ),
      { status: 303 }
    );
  }

  if (registeredLog.authoritative_log_summary_id) {
    completed = true;
    return NextResponse.redirect(new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url), { status: 303 });
  }
  const processingStartedAt = new Date().toISOString();
  const lifecycleDatabase = createSupabaseEvidenceLifecycleDatabase(trustedClient);
  const evidenceDatabase = createSupabaseEvidencePersistenceDatabase(trustedClient);
  let durableSourcePath: string | null = null;

  try {
    const uploadBlob = new Blob([arrayBuffer], {
      type: "text/csv",
    });

    const fileExt = "csv";
    const filePath = `${user.id}/${vehicleId}/${registeredLog.id}.${fileExt}`;

    const { error: firstUploadError } = await supabase.storage
      .from("logs")
      .upload(filePath, uploadBlob, {
        upsert: false,
        cacheControl: "0, no-store",
      });

    let uploadError = firstUploadError;
    if (firstUploadError) {
      // A retry may encounter its immutable object after a lost response.
      const retained = await trustedClient.storage.from("logs").download(filePath);
      if (retained.data && retained.data.size === file.size && createHash("sha256").update(new Uint8Array(await retained.data.arrayBuffer())).digest("hex") === digest) uploadError = null;
    }
    if (uploadError) {
      console.error("Raw Evidence source storage failed", {
        failure: "raw_source_storage_failure",
        logId: registeredLog.id,
      });

      let evidenceStatus = "processing_failed";
      try {
        await recordEvidenceProcessingFailure(
          lifecycleDatabase,
          {
            logId: registeredLog.id,
            expectedUserId: user.id,
            processingStartedAt,
            rawSourceStoragePath: null,
            sourceAvailability: "unavailable",
          },
          "raw_source_storage",
          null
        );
      } catch (error) {
        if (error instanceof EvidenceLifecycleWriteError) {
          evidenceStatus = "lifecycle_write_failed";
          console.error("Durable Evidence lifecycle recording failed", {
            failure: error.code,
            logId: registeredLog.id,
          });
        }
      }

      return NextResponse.redirect(
        new URL(
          `/dashboard/vehicles/${vehicleId}/logs?evidence_status=${evidenceStatus}`,
          request.url
        ),
        { status: 303 }
      );
    }
    durableSourcePath = filePath;

    const { error: updateError } = await trustedClient
      .from("logs")
      .update({
        file_name: file.name,
        file_url: null,
      })
      .eq("id", registeredLog.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Log source metadata update failed", {
        failure: "source_metadata_update_failure",
        logId: registeredLog.id,
      });
    }

    const { headers, rows } = parsedSource;
    const lifecycleContext = {
      logId: registeredLog.id,
      expectedUserId: user.id,
      processingStartedAt,
      rawSourceStoragePath: filePath,
      sourceAvailability: "available" as const,
    };

    const attempt = await runDurableEvidenceProcessingAttempt({
      lifecycleDatabase,
      lifecycleContext,
      qualify: () =>
        qualifyEvidenceSource(
          rows,
          {
            sourceLogId: registeredLog.id,
            sourceAvailability: "available",
          },
          headers
        ),
      derive: async (sourceQualification) => {
        const translatedLog = sourceQualification.translatedLog;
        const { parsedLog, extracted } =
          buildParsedLogFromTranslatedLog(translatedLog);

        const { data: vehicleRow } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleId)
          .eq("user_id", user.id)
          .maybeSingle();

        const vehicle = mapVehicleSetup(
          vehicleRow as VehicleRow | null
        );

        const { data: latestTune } = await supabase
          .from("tunes")
          .select("*")
          .eq("vehicle_id", vehicleId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: latestTuneProfileRow } = latestTune
          ? await supabase
              .from("tune_profiles")
              .select("*")
              .eq("tune_id", latestTune.id)
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null };

        const tuneProfile = mapTuneProfile(
          latestTuneProfileRow as TuneRow | null
        );

        const effectiveTuneProfile = tuneProfile;

        const analysis = buildAnalysisResult({
          parsedLog,
          vehicle,
          tuneProfile: effectiveTuneProfile,
        });

        return {
          loggerPlatform: translatedLog.platform,
          summaryPayload: buildSummaryPayload({
            headers,
            rows,
            extracted,
            analysis,
          }),
        };
      },
      persist: (derived) =>
        persistCandidateEvidenceSummary(evidenceDatabase, {
          logId: registeredLog.id,
          vehicleId,
          userId: user.id,
          summaryPayload: derived.summaryPayload,
          processingContractVersion: "1.0",
          loggerPlatform: derived.loggerPlatform,
          sourceAvailability: "available",
          rawSourceStoragePath: durableSourcePath,
          processingStartedAt,
        }),
    });

    if (attempt.status !== "confirmed_established") {
      console.error("Evidence processing did not establish confirmed authority", {
        status: attempt.status,
        resolution: attempt.promotion?.resolution ?? null,
        finding: attempt.promotion?.finding ?? null,
        logId: registeredLog.id,
        candidateSummaryId: attempt.promotion?.candidateSummaryId ?? null,
      });
    }

    completed = attempt.status === "confirmed_established";
    const evidenceStatus =
      attempt.status === "confirmed_established"
        ? "established"
        : attempt.status;
    return NextResponse.redirect(
      new URL(
        `/dashboard/vehicles/${vehicleId}/logs?evidence_status=${evidenceStatus}`,
        request.url
      ),
      { status: 303 }
    );
  } catch {
    const failureStage =
      durableSourcePath === null ? "raw_source_storage" : "source_classification";
    console.error("Evidence source processing failed", {
      failure:
        failureStage === "raw_source_storage"
          ? "raw_source_storage_failure"
          : "source_classification_failure",
      logId: registeredLog.id,
    });

    let evidenceStatus = "processing_failed";
    try {
      await recordEvidenceProcessingFailure(
        lifecycleDatabase,
        {
          logId: registeredLog.id,
          expectedUserId: user.id,
          processingStartedAt,
          rawSourceStoragePath: durableSourcePath,
          sourceAvailability:
            durableSourcePath === null ? "unavailable" : "available",
        },
        failureStage,
        null
      );
    } catch (error) {
      if (error instanceof EvidenceLifecycleWriteError) {
        evidenceStatus = "lifecycle_write_failed";
        console.error("Durable Evidence lifecycle recording failed", {
          failure: error.code,
          logId: registeredLog.id,
        });
      }
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard/vehicles/${vehicleId}/logs?evidence_status=${evidenceStatus}`,
        request.url
      ),
      { status: 303 }
    );
  }
  } finally { await finishUpload(supabase, reservation, completed); }
}

export const POST = protectSubscriberRequest(handlePOST, 4 * 1024 * 1024 + 64 * 1024);
