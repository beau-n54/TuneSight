export type PresentedFinding = Readonly<{ key: string; sourceId: string; findingId: string; occurrence: number; text: string }>;
/** Preserve repeated evidence. Identity is owner + governed ID (or the legacy
 * owner's exact finding text) + occurrence within that identity, never row index.
 */
export function presentationFindings(groups: readonly Readonly<{
  sourceId: string; findings: readonly (string | Readonly<{ findingId: string; text: string }>)[];
}>[]): readonly PresentedFinding[] {
  const occurrences = new Map<string, number>();
  return Object.freeze(groups.flatMap(group => group.findings.map(finding => {
    const text = typeof finding === "string" ? finding : finding.text;
    const findingId = typeof finding === "string" ? finding : finding.findingId;
    const identity = JSON.stringify([group.sourceId, findingId]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return Object.freeze({ key: JSON.stringify([group.sourceId, findingId, occurrence]), sourceId: group.sourceId, findingId, occurrence, text });
  })));
}
