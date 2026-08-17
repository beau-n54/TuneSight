export type TelemetryEducationView =
  | "engineer"
  | "individual_pull_line"
  | "individual_pull_terrain";

type EducationSection = {
  heading: string;
  paragraphs: readonly string[];
  points?: readonly string[];
};

type ViewEducation = {
  eyebrow: string;
  sections: readonly EducationSection[];
  summary: string;
};

export const TELEMETRY_VIEW_EDUCATION: Readonly<
  Record<TelemetryEducationView, ViewEducation>
> = {
  engineer: {
    eyebrow: "Complete recording",
    summary:
      "Read the complete uploaded telemetry session in truthful source order.",
    sections: [
      {
        heading: "What am I looking at?",
        paragraphs: [
          "Engineer View shows the complete uploaded telemetry recording in its original source order. A session may contain multiple pulls or acceleration regions, throttle changes, shifts where present, detected events, RPM rises and resets, and portions outside a pull.",
        ],
      },
      {
        heading: "Why is it shown this way?",
        paragraphs: [
          "The horizontal axis uses Sample Sequence because the complete recording is one chronology, not one continuous RPM sweep. Sample Sequence preserves what happened first, next, and last without pretending separate regions share a single RPM progression.",
        ],
      },
      {
        heading: "What should I look for?",
        points: [
          "Repeated behaviour across detected regions.",
          "Relationships between channels before, during, and after an event.",
          "Changes in behaviour across the whole logging session.",
        ],
        paragraphs: [],
      },
      {
        heading: "When should I use this view?",
        paragraphs: [
          "Use Engineer View to understand the whole session, preserve chronology, and compare behaviour across detected regions.",
        ],
      },
      {
        heading: "When should I switch views?",
        paragraphs: [
          "Switch to Individual Pull when you want focused inspection of one authoritative detected telemetry window without unrelated portions of the session.",
        ],
      },
    ],
  },
  individual_pull_terrain: {
    eyebrow: "Focused pattern recognition",
    summary:
      "Use a visual engineering landscape to recognise how one selected pull develops.",
    sections: [
      {
        heading: "What am I looking at?",
        paragraphs: [
          "Individual Pull isolates one authoritative detected telemetry window from the complete recording. Terrain shapes the selected signal into a visual engineering landscape for that window.",
          "Horizontal position preserves Sample Sequence and source chronology. The vertical engineering scale preserves truthful values and units. Exact recorded RPM remains available through inspection where the source provides it.",
        ],
      },
      {
        heading: "Why is it shown this way?",
        paragraphs: [
          "The highlighted authoritative ridge represents the measured telemetry. The surrounding wireframe terrain is presentation-only geometry that makes the evidence's shape easier to perceive; it does not create extra telemetry samples.",
        ],
      },
      {
        heading: "What should I look for?",
        points: [
          "Ramps, plateaus, peaks, troughs, and sustained deviations.",
          "Sudden transitions or unstable-looking development across the sequence.",
          "How a signal changes before, through, and after a detected event.",
        ],
        paragraphs: [],
      },
      {
        heading: "When should I use this view?",
        paragraphs: [
          "Use Terrain for pattern and shape recognition when studying behaviour inside the selected pull.",
        ],
      },
      {
        heading: "When should I switch views?",
        paragraphs: [
          "Switch to Line when you need precise sample-level values, exact location, or qualified RPM-based inspection. Switch to Engineer View when the surrounding session chronology matters.",
        ],
      },
    ],
  },
  individual_pull_line: {
    eyebrow: "Focused precision inspection",
    summary:
      "Inspect exact values and locations within one authoritative detected pull.",
    sections: [
      {
        heading: "What am I looking at?",
        paragraphs: [
          "Individual Pull isolates one authoritative detected telemetry window from the complete recording. Line View presents its recorded samples for precise engineering inspection.",
        ],
      },
      {
        heading: "Why is it shown this way?",
        paragraphs: [
          "When recorded RPM is sufficiently qualified, the horizontal axis uses genuine recorded RPM. When RPM cannot truthfully support that representation, TuneSight uses Sample Sequence so source order remains accurate.",
        ],
      },
      {
        heading: "What should I look for?",
        points: [
          "The exact sample or RPM location where behaviour changes.",
          "Precise engineering values and relationships between displayed channels.",
          "How recorded behaviour aligns with detected pull and event regions.",
        ],
        paragraphs: [],
      },
      {
        heading: "When should I use this view?",
        paragraphs: [
          "Use Line for exact RPM-based inspection where qualified, sample-level inspection, calibration validation, and locating precisely where behaviour occurs.",
        ],
      },
      {
        heading: "When should I switch views?",
        paragraphs: [
          "Switch to Terrain when pattern and shape are easier to recognise as a landscape. Switch to Engineer View when you need the complete recording and its surrounding chronology.",
        ],
      },
    ],
  },
};

export default function TelemetryViewEducation({
  view,
}: {
  view: TelemetryEducationView;
}) {
  const education = TELEMETRY_VIEW_EDUCATION[view];
  const headingId = `telemetry-view-education-${view}`;

  return (
    <details className="group mt-4 border border-sky-950/80 bg-black/50">
      <summary className="cursor-pointer select-none px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 sm:px-4">
        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span
            className="text-xs font-semibold text-sky-200"
            id={headingId}
          >
            Understanding this view
          </span>
          <span className="text-[11px] text-zinc-500">
            {education.eyebrow}
          </span>
        </span>
      </summary>

      <div
        aria-labelledby={headingId}
        className="border-t border-sky-950/70 px-3 py-4 sm:px-4"
        role="region"
      >
        <p className="max-w-3xl text-sm leading-6 text-zinc-300">
          {education.summary}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {education.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-400">
                {section.heading}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p
                  className="mt-2 text-xs leading-5 text-zinc-400"
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
              {section.points && (
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-400">
                  {section.points.map((point) => (
                    <li className="flex gap-2" key={point}>
                      <span aria-hidden="true" className="text-sky-600">
                        -
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}
