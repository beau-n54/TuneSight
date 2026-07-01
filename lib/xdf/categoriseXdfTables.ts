import type { XdfTableCategory } from "./xdfTypes";

const CATEGORY_RULES: Record<Exclude<XdfTableCategory, "unknown">, string[]> = {
  boost: [
    "boost",
    "target boost",
    "boost target",
    "manifold pressure",
    "pressure ratio",
    "charge pressure",
    "turbo pressure",
  ],

  fueling: [
    "fuel",
    "lambda",
    "afr",
    "air fuel",
    "fuel scalar",
    "fuel mass",
    "injector",
    "ethanol",
    "e85",
  ],

  timing: [
    "ignition",
    "timing",
    "spark",
    "knock",
    "advance",
    "correction",
  ],

  torque: [
    "torque",
    "driver demand",
    "requested torque",
    "torque limit",
    "load to torque",
  ],

  load: [
    "load",
    "requested load",
    "load target",
    "load ceiling",
    "cylinder fill",
  ],

  wgdc: [
    "wgdc",
    "wastegate",
    "duty cycle",
    "base dc",
    "pid",
  ],

  railPressure: [
    "rail pressure",
    "fuel pressure",
    "hpfp",
    "high pressure pump",
    "pressure target",
  ],

  vanos: [
    "vanos",
    "camshaft",
    "intake cam",
    "exhaust cam",
    "cam timing",
  ],

  safety: [
    "limit",
    "limiter",
    "ceiling",
    "maximum",
    "minimum",
    "failsafe",
    "protection",
  ],
};

export function categoriseXdfTableName(name: string): {
  category: XdfTableCategory;
  confidence: number;
} {
  const normalizedName = name.toLowerCase();

  let bestCategory: XdfTableCategory = "unknown";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_RULES) as [
    Exclude<XdfTableCategory, "unknown">,
    string[],
  ][]) {
    const score = keywords.reduce((total, keyword) => {
      return normalizedName.includes(keyword) ? total + 1 : total;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  if (bestScore === 0) {
    return {
      category: "unknown",
      confidence: 0,
    };
  }

  return {
    category: bestCategory,
    confidence: Math.min(0.95, 0.45 + bestScore * 0.2),
  };
}

export function buildCategoryCounts(
  categories: XdfTableCategory[],
): Record<XdfTableCategory, number> {
  return {
    boost: categories.filter((category) => category === "boost").length,
    fueling: categories.filter((category) => category === "fueling").length,
    timing: categories.filter((category) => category === "timing").length,
    torque: categories.filter((category) => category === "torque").length,
    load: categories.filter((category) => category === "load").length,
    wgdc: categories.filter((category) => category === "wgdc").length,
    railPressure: categories.filter((category) => category === "railPressure").length,
    vanos: categories.filter((category) => category === "vanos").length,
    safety: categories.filter((category) => category === "safety").length,
    unknown: categories.filter((category) => category === "unknown").length,
  };
}