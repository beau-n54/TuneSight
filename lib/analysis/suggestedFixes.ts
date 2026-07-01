export function buildSuggestedFixes(signals: any[], profile: any) {
  const fixes: any[] = [];

  const hasSignal = (keyword: string) =>
    signals.some(s => s.title.toLowerCase().includes(keyword));

  // 🔥 Fuel mismatch
  if (hasSignal("fuel mismatch")) {
    fixes.push({
      title: "Fuel type mismatch correction",
      priority: "HIGH",
      actions: [
        "Reduce ethanol content OR switch to correct fuel for this tune",
        "Adjust tune to match ethanol blend (if intentional)",
        "Verify fuel trims and AFR stability"
      ],
      reason: "Tune is built for pump fuel but ethanol detected in logs"
    });
  }

  // 🔥 Rail pressure drop
  if (hasSignal("rail pressure")) {
    fixes.push({
      title: "High-pressure fuel system limitation",
      priority: "HIGH",
      actions: [
        "Increase port injection contribution",
        "Reduce boost/load in high RPM",
        "Upgrade HPFP if running ethanol blends"
      ],
      reason: "Rail pressure dropping under load indicates HPFP limitation"
    });
  }

  // 🔥 LPFP drop
  if (hasSignal("lpfp")) {
    fixes.push({
      title: "Low-pressure fuel system weakness",
      priority: "MEDIUM",
      actions: [
        "Check LPFP voltage and wiring",
        "Upgrade LPFP if running ethanol",
        "Inspect fuel filter and regulator"
      ],
      reason: "LPFP pressure dropping under load"
    });
  }

  // 🔥 Knock / timing correction
  if (hasSignal("knock") || hasSignal("timing")) {
    fixes.push({
      title: "Ignition instability detected",
      priority: "HIGH",
      actions: [
        "Reduce ignition timing in affected areas",
        "Check fuel quality",
        "Reduce IAT (cooling improvements)",
        "Verify plugs and coils"
      ],
      reason: "Timing corrections detected despite conservative profile"
    });
  }

  return fixes;
}