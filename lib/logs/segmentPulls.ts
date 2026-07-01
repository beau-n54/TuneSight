import type { ParsedLog, PullWindow, PullQuality } from "../analysis/types";

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function segmentPulls(parsedLog: ParsedLog): PullWindow[] {
  const throttle =
    parsedLog.channels.throttle ||
    parsedLog.channels.accelerator_pedal ||
    parsedLog.channels.pedal ||
    [];

  const rpm = parsedLog.rpm || [];
  const timestamps = parsedLog.timestamps || [];

  if (!throttle.length || !rpm.length || !timestamps.length) {
    return [];
  }

  const windows: PullWindow[] = [];
  let start: number | null = null;

  const minThrottle = 85;

  for (let i = 0; i < throttle.length; i++) {
    const isWot = throttle[i] >= minThrottle;

    if (isWot && start === null) {
      start = i;
    }

    if ((!isWot || i === throttle.length - 1) && start !== null) {
      const end = isWot && i === throttle.length - 1 ? i : i - 1;

      if (end > start) {
        const rpmStart = rpm[start] ?? 0;
        const rpmEnd = rpm[end] ?? 0;
        const durationSec = Math.max(
          0,
          (timestamps[end] ?? 0) - (timestamps[start] ?? 0)
        );
        const avgThrottle = average(throttle.slice(start, end + 1));
        const rpmSpan = Math.abs(rpmEnd - rpmStart);

        const issues: string[] = [];
        let quality: PullQuality = "strong";

        if (durationSec < 2) {
          issues.push("Short pull duration");
          quality = "questionable";
        }

        if (rpmSpan < 1800) {
          issues.push("Limited RPM span");
          quality = quality === "strong" ? "usable" : quality;
        }

        if (avgThrottle < 90) {
          issues.push("Throttle not fully stable");
          quality = quality === "strong" ? "usable" : quality;
        }

        windows.push({
          id: `pull_${windows.length + 1}`,
          startIndex: start,
          endIndex: end,
          rpmStart,
          rpmEnd,
          durationSec,
          avgThrottle,
          isValidWot: issues.length === 0 || quality !== "questionable",
          quality,
          issues,
        });
      }

      start = null;
    }
  }

  return windows;
}