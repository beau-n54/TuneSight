import type {AnalysisSource} from "./analysisSource";
import type {SourceInvestigation} from "./sourceInvestigation";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const round = (n: number) => Math.round(n * 100) / 100;
const fraction = (a: number, b: number) => b > 0 ? Math.max(0, Math.min(1, a / b)) : 0;

/** Restores the historical additive evidence / bounded score / descending rank /
 * gap-to-leader mechanics without importing diagnostic priors or fault limits.
 * These explicit neutral weights are an inspection heuristic, NOT the historical
 * N54 confidence calibration. Zero causal prior; no platform or table input.
 */
export function sourceEvidenceScoring(source: AnalysisSource | null, investigation: SourceInvestigation) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  if (!m) return [];
  const byKey = new Map(m.channels.map(c => [c.key, c]));
  const elapsed = m.timestamps ? m.timestamps.at(-1)! - m.timestamps[0] : 0;
  const scores = investigation.observations.checks.filter(c => c.events.length).map(check => {
    const events = check.events;
    const rows = new Set<number>();
    for (const e of events) for (let i = e.startRow; i <= e.endRow; i++) rows.add(i);
    const channels = check.channels.map(key => byKey.get(key));
    let valid = 0, context = 0, pairs = 0;
    for (const row of rows) {
      valid += channels.filter(c => finite(c?.values[row])).length;
      context += ["rpm", "accelerator_pedal"].filter(key => finite(byKey.get(key)?.values[row])).length;
      if (row > 0 && rows.has(row - 1) && channels.every(c => finite(c?.values[row]) && finite(c?.values[row - 1]))) pairs++;
    }
    let span = 0;
    for (const c of channels) {
      let low = Infinity, high = -Infinity;
      for (const v of c?.values ?? []) if (finite(v)) { low = Math.min(low, v); high = Math.max(high, v); }
      if (finite(low) && finite(high)) span = Math.max(span, high - low);
    }
    const peak = events.reduce((a, e) => Math.max(a, e.value), 0);
    const duration = events.reduce((a, e) => a + (e.startSeconds !== null && e.endSeconds !== null ? e.endSeconds - e.startSeconds : 0), 0);
    const coverage = fraction(valid, rows.size * channels.length);
    const contextCoverage = fraction(context, rows.size * 2);
    const opposite = check.id === "actual-above-target" ? "actual-below-target" : check.id === "actual-below-target" ? "actual-above-target" : null;
    const oppositeCount = investigation.observations.checks.find(c => c.id === opposite)?.events.length ?? 0;
    const factors = [
      {label: "Magnitude relative to this source's channel span", points: 20 * fraction(peak, span), explanation: `${peak} ${events[0].unit} peak / ${span} ${events[0].unit} largest supplied channel span; capped at 20. A zero span earns no scale-normalised points.`},
      {label: "Observed duration", points: 15 * fraction(duration, elapsed), explanation: `${round(duration)} / ${round(elapsed)} qualified seconds; up to 15. Missing time earns zero.`},
      {label: "Recurrence", points: 10 * (1 - 1 / events.length), explanation: `${events.length} intervals; 10 × (1 − 1 / interval count).`},
      {label: "Qualified channel completeness", points: 20 * coverage, explanation: `${valid} / ${rows.size * channels.length} required channel-row observations; up to 20.`},
      {label: "Same-row comparison", points: channels.length > 1 ? 10 * coverage : 0, explanation: `${channels.length} qualified compared channels; up to 10 for complete same-row comparison. Only boost actual/target is a command comparison; pedal/plate and cylinder spread are not commanded targets.`},
      {label: "Contiguous supporting rows", points: 20 * fraction(pairs, rows.size), explanation: `${pairs} adjacent supported row pairs / ${rows.size} distinct event rows; up to 20. Gaps are never bridged.`},
      {label: "Missing operating context", points: -10 * (1 - contextCoverage), explanation: `${context} / ${rows.size * 2} RPM and pedal observations. Up to 10 points withheld for missing context; missing values are not stability evidence.`},
      {label: "Opposing boost direction", points: -10 * fraction(oppositeCount, events.length + oppositeCount), explanation: opposite ? `${oppositeCount} opposite-direction intervals reduce support for a persistent one-direction interpretation (up to 10); neither observation is invalidated.` : "Not applicable. Other coincident event families are not independent causal corroboration and earn no bonus."},
    ].map(f => ({...f, points: round(f.points)}));
    const score = round(Math.max(0, Math.min(95, factors.reduce((a, f) => a + f.points, 0))));
    return {kind: check.id, title: check.title, score, factors, events, peak, unit: events[0].unit};
  }).sort((a, b) => b.score - a.score || a.events[0].startRow - b.events[0].startRow || a.kind.localeCompare(b.kind));
  return scores.map((s, index) => ({...s, rank: index + 1, gapToLeader: round(scores[0].score - s.score)}));
}
export type SourceEvidenceScores = ReturnType<typeof sourceEvidenceScoring>;
