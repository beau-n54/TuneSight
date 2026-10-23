import type {DetectedEvent, ParsedLog, PullWindow} from "./types";

/** Availability of existing detectEvents checks, not new rules or thresholds.
 * Called only by the qualified engine after evaluation. No event is invented. */
export function diagnosticCheckAvailability(log: ParsedLog, windows: readonly PullWindow[], events: readonly DetectedEvent[], fuelQualified: boolean) {
  const checks = [
    {id: "heat_soak", channels: ["iat"]},
    {id: "wgdc_saturation", channels: ["wgdc", "boost", "boost_target"]},
    {id: "throttle_closure", channels: ["throttle", "boost", "boost_target"]},
    {id: "boost_overshoot", channels: ["boost", "boost_target", "throttle"]},
    {id: "boost_undershoot", channels: ["boost", "boost_target", "throttle", "wgdc"]},
    {id: "top_end_taper", channels: ["boost", "boost_target", "wgdc"]},
    {id: "rail_pressure_drop", channels: ["rail_pressure", "throttle", "boost"], fuel: true},
    {id: "lpfp_drop", channels: ["lpfp", "throttle", "boost"], fuel: true},
    {id: "lean_under_load", channels: ["afr", "throttle", "boost"], fuel: true},
  ];
  const hasWindow = windows.length ? windows.some(w => w.endIndex > w.startIndex) : log.sampleCount > 1;
  return checks.map(check => {
    const missing = check.channels.filter(key => log.channels[key]?.length !== log.sampleCount || !log.channels[key]?.every(Number.isFinite));
    const reason = !hasWindow ? "Requires at least two aligned source samples in an evaluation window."
      : missing.length ? `Requires fully observed, aligned, qualified channels: ${missing.join(", ")}.`
      : check.fuel && !fuelQualified ? "Requires qualified measured fuel evidence for the existing fuel-pressure rule contract."
      : ["heat_soak", "wgdc_saturation", "throttle_closure"].includes(check.id) && !log.channels[check.channels[0]].some(v => v !== 0)
        ? "The existing detector requires non-zero observations for this check." : null;
    const count = events.filter(event => event.type === check.id).length;
    return {id: check.id, channels: check.channels, state: reason ? "blocked" as const : count ? "event_detected" as const : "evaluated_no_event" as const, reason, eventCount: count};
  });
}
export type DiagnosticCheck = ReturnType<typeof diagnosticCheckAvailability>[number];
