import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const educationSource = readFileSync(
  new URL("./TelemetryViewEducation.tsx", import.meta.url),
  "utf8"
);
const workspaceSource = readFileSync(
  new URL("./TelemetryGraphV1.tsx", import.meta.url),
  "utf8"
);

test("Telemetry Workspace exposes a compact native education disclosure", () => {
  assert.match(educationSource, /<details className=/);
  assert.match(educationSource, /<summary className=/);
  assert.doesNotMatch(educationSource, /<details[^>]*\sopen/);
  assert.match(educationSource, /Understanding this view/);
  assert.match(educationSource, /focus-visible:outline-sky-400/);
  assert.match(educationSource, /aria-labelledby=\{headingId\}/);
  assert.match(educationSource, /role="region"/);
});

test("Engineer View education preserves complete-log chronology and Sample Sequence truth", () => {
  assert.match(educationSource, /complete uploaded telemetry recording/);
  assert.match(educationSource, /original source order/);
  assert.match(educationSource, /multiple pulls or acceleration regions/);
  assert.match(educationSource, /RPM rises and resets/);
  assert.match(educationSource, /horizontal axis uses Sample Sequence/);
  assert.match(educationSource, /one chronology, not one continuous RPM sweep/);
});

test("Individual Pull education is scoped to one authoritative detected window", () => {
  assert.match(
    educationSource,
    /Individual Pull isolates one authoritative detected telemetry window/
  );
  assert.match(educationSource, /without unrelated portions of the session/);
  assert.doesNotMatch(educationSource, /Primary Results/);
});

test("Terrain education distinguishes measured evidence from presentation geometry", () => {
  assert.match(educationSource, /highlighted authoritative ridge represents the measured telemetry/);
  assert.match(educationSource, /surrounding wireframe terrain is presentation-only geometry/);
  assert.match(educationSource, /does not create extra telemetry samples/);
  assert.match(educationSource, /Horizontal position preserves Sample Sequence/);
  assert.match(educationSource, /vertical engineering scale preserves truthful values and units/);
  assert.match(educationSource, /Exact recorded RPM remains available through inspection/);
  assert.match(educationSource, /pattern and shape recognition/);
});

test("Line education explains precision, qualified RPM, and truthful fallback", () => {
  assert.match(educationSource, /Line View presents its recorded samples for precise engineering inspection/);
  assert.match(educationSource, /recorded RPM is sufficiently qualified/);
  assert.match(educationSource, /horizontal axis uses genuine recorded RPM/);
  assert.match(educationSource, /TuneSight uses Sample Sequence so source order remains accurate/);
  assert.match(educationSource, /sample-level inspection/);
  assert.match(educationSource, /Terrain when pattern and shape are easier to recognise/);
});

test("context selection changes education without changing renderer selection", () => {
  assert.match(workspaceSource, /const educationView: TelemetryEducationView = isIndividualPull/);
  assert.match(workspaceSource, /"individual_pull_terrain"/);
  assert.match(workspaceSource, /"individual_pull_line"/);
  assert.match(workspaceSource, /<TelemetryViewEducation view=\{educationView\} \/>/);
  assert.match(workspaceSource, /graphView=\{isIndividualPull \? graphView : "line"\}/);
});

test("education has no engineering-data or interaction ownership", () => {
  assert.doesNotMatch(
    educationSource,
    /GraphPoint|PullWindow|buildGraphPoints|sliceTelemetryToPull|resolveTerrainPointer/
  );
  assert.doesNotMatch(educationSource, /\btelemetry:|\bevents:|\bpullWindows:/);
  assert.match(
    educationSource,
    /export default function TelemetryViewEducation\(\{\s*view,\s*\}: \{\s*view: TelemetryEducationView;/
  );
  assert.doesNotMatch(
    educationSource,
    /means your|is failing|has failed|root cause|means knock/i
  );
});

test("education content is responsive and structurally extensible by view", () => {
  assert.match(
    educationSource,
    /Record<TelemetryEducationView, ViewEducation>/
  );
  assert.match(educationSource, /sm:flex-row/);
  assert.match(educationSource, /md:grid-cols-2/);
  assert.match(educationSource, /xl:grid-cols-3/);
});
