export type CylinderIssue = {
  cylinder: number;
  value: number;
  severity: "low" | "medium" | "high";
  message: string;
  suspectedCause: string;
};

export function analyzePerCylinderIntelligence(
  rows: Record<string, unknown>[]
): CylinderIssue[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const issues: CylinderIssue[] = [];

  const cylinders = [
    {
      cyl: 1,
      keys: [
        "timing_correction_cyl_1",
        "Cyl1 Timing Cor (*)",
        "Timing Cyl. 1",
      ],
    },
    {
      cyl: 2,
      keys: [
        "timing_correction_cyl_2",
        "Cyl2 Timing Cor (*)",
        "Timing Cyl. 2",
      ],
    },
    {
      cyl: 3,
      keys: [
        "timing_correction_cyl_3",
        "Cyl3 Timing Cor (*)",
        "Timing Cyl. 3",
      ],
    },
    {
      cyl: 4,
      keys: [
        "timing_correction_cyl_4",
        "Cyl4 Timing Cor (*)",
        "Timing Cyl. 4",
      ],
    },
    {
      cyl: 5,
      keys: [
        "timing_correction_cyl_5",
        "Cyl5 Timing Cor (*)",
        "Timing Cyl. 5",
      ],
    },
    {
      cyl: 6,
      keys: [
        "timing_correction_cyl_6",
        "Cyl6 Timing Cor (*)",
        "Timing Cyl. 6",
      ],
    },
  ];

  for (const cylinder of cylinders) {
    let minimum = 0;

    for (const row of rows) {
      for (const key of cylinder.keys) {
        const raw = row[key];

        if (typeof raw === "number") {
          if (raw < minimum) {
            minimum = raw;
          }
        }
      }
    }

    if (minimum <= -5) {
      issues.push({
        cylinder: cylinder.cyl,
        value: minimum,
        severity: "high",
        message: `Severe timing correction detected on Cylinder ${cylinder.cyl}`,
        suspectedCause:
          "Possible ignition breakdown, injector issue, knock activity, or fuel quality limitation.",
      });
    } else if (minimum <= -3) {
      issues.push({
        cylinder: cylinder.cyl,
        value: minimum,
        severity: "medium",
        message: `Moderate timing correction detected on Cylinder ${cylinder.cyl}`,
        suspectedCause:
          "Potential spark plug wear, coil weakness, or inconsistent fueling.",
      });
    } else if (minimum <= -1.5) {
      issues.push({
        cylinder: cylinder.cyl,
        value: minimum,
        severity: "low",
        message: `Minor timing correction detected on Cylinder ${cylinder.cyl}`,
        suspectedCause:
          "Light knock response or normal transient correction.",
      });
    }
  }

  return issues;
}