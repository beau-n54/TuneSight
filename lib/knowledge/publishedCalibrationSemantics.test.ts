import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildEngineeringNavigationIndex, filterEngineeringNavigation } from "../calibration-workshop/engineeringNavigation.ts";
import { loadSubscriberCalibration } from "../calibration-workshop/subscriberCalibrationProvider.ts";
import { HELD_CALIBRATION_SEMANTICS, PUBLISHED_CALIBRATION_KNOWLEDGE_REGISTRY, PUBLISHED_CALIBRATION_SEMANTICS, calibrationKnowledgeForRelationship } from "./publishedCalibrationSemantics.ts";

const n54Relationship = "qualified-rom-layout-applicability-revision:7bec3ec729b79e57ae9b412e6ac1cf972d9187799a1cb7e6ea90550a9e5af765";
const b58Relationship = "qualified-rom-layout-applicability-revision:f2631e65861257af71b6b2c9c5b67919319c50bb9db16494d2ecfaeaa9603272";
const heldRevision = "xdf-definition-revision:c5801ec096075ed64bcc6fe656c0ce5ac664e9a974df3dafa1afcbd2e8c0c51c";

test("Founder publication preserves the accepted seventeen and adds ten exact I8A0S relationship records while retaining the hold", () => {
  assert.equal(PUBLISHED_CALIBRATION_SEMANTICS.length, 27);
  assert.equal(PUBLISHED_CALIBRATION_SEMANTICS.filter(item => item.rom === "I8A0S").length, 10);
  assert.equal(PUBLISHED_CALIBRATION_SEMANTICS.filter(item => item.rom === "IJE0S").length, 10);
  assert.equal(PUBLISHED_CALIBRATION_SEMANTICS.filter(item => item.rom === "00003076501103").length, 7);
  assert.equal(HELD_CALIBRATION_SEMANTICS.length, 1);
  assert.equal(HELD_CALIBRATION_SEMANTICS[0]?.definitionRevision, heldRevision);
  assert.ok(!PUBLISHED_CALIBRATION_SEMANTICS.some(item => item.knowledge.exactDefinitionRevisions.includes(heldRevision)));
  for (const item of PUBLISHED_CALIBRATION_SEMANTICS) {
    assert.equal(item.decision.outcome, "accepted_authoritative");
    assert.equal(item.instruction.operation, "register");
    assert.equal(item.receipt.outcome, "published");
    assert.equal(item.knowledge.verification, "founder_verified");
    assert.ok(Object.isFrozen(item.knowledge));
    assert.ok(Object.isFrozen(item.canonicalKnowledge));
    assert.equal(item.canonicalKnowledge.identity.value?.stableId, item.knowledge.knowledgeId);
    assert.deepEqual(item.canonicalKnowledge.applicability.value?.softwareVersions, [item.rom]);
    assert.deepEqual(item.canonicalKnowledge.applicability.value?.sourceReferenceIds, item.knowledge.exactDefinitionRevisions);
    assert.ok(item.knowledge.limitations.length > 0);
  }
  assert.deepEqual(Object.keys(PUBLISHED_CALIBRATION_KNOWLEDGE_REGISTRY), ["lookup"]);
});

test("publication preserves exact ROM scope, source language, symbols and accepted caveats", () => {
  assert.equal(calibrationKnowledgeForRelationship("qualified-rom-layout-applicability-revision:bd3735b9751749c91ab429e1139a508f2fc04fbc21228f66a6c438ca9c2cba05").length, 10);
  assert.equal(calibrationKnowledgeForRelationship(n54Relationship).length, 10);
  assert.equal(calibrationKnowledgeForRelationship(b58Relationship).length, 7);
  assert.deepEqual(calibrationKnowledgeForRelationship("qualified-rom-layout-applicability-revision:other"), []);

  const german = PUBLISHED_CALIBRATION_SEMANTICS.find(item => item.originalTitle.includes("Vorsteuerung"))!;
  assert.equal(german.knowledge.aliases[0]?.value, "Wastegate Base Position — Feed-forward");
  assert.ok(german.knowledge.aliases.some(alias => alias.value === "Wastegate Position - für Vorsteuerung"));
  assert.ok(german.knowledge.aliases.some(alias => alias.value === "Wastegate Pre-control Position"));
  assert.equal(german.knowledge.sourceSymbol, "BMWtchctr_pct_WgBasc_M");

  const pFactor = PUBLISHED_CALIBRATION_SEMANTICS.find(item => item.originalTitle === "WGDC P factor")!;
  assert.doesNotMatch(pFactor.knowledge.controls[0]!.value, /power|kilowatt|kW/i);
  assert.match(pFactor.knowledge.limitations.join(" "), /metadata only.*not.*physical power/i);
  assert.equal(pFactor.knowledge.axisMeanings.length, 0);
  assert.equal(pFactor.knowledge.outputMeaning, null);

  const boost = PUBLISHED_CALIBRATION_SEMANTICS.find(item => item.originalTitle.startsWith("Boost Ceiling (Relative)"))!;
  assert.deepEqual(boost.knowledge.axisMeanings.map(item => item.value), [{ axisId: "x", meaning: "Engine Speed" }, { axisId: "y", meaning: "Gear" }]);
  assert.equal(boost.knowledge.outputMeaning?.value, "Relative Boost-pressure Ceiling");

  const protection = PUBLISHED_CALIBRATION_SEMANTICS.find(item => item.originalTitle.startsWith("Load limit factor"))!;
  assert.equal(protection.knowledge.engineeringSystem?.value, "Limiters & Safety");
  assert.ok(!protection.knowledge.relatedEngineeringSystems?.some(system => system.value === "Fueling / Lambda"));
  assert.match(protection.knowledge.limitations.join(" "), /Fueling \/ Lambda is not qualified/);
});

test("exact subscriber Workshops publish only current-ROM semantics into navigation", { timeout: 180_000 }, async context => {
  const i8Bytes = new Uint8Array(fs.readFileSync("BMW-XDFs-master/N54/I8A0S_MapSwitchBase.bin"));
  const i8 = await loadSubscriberCalibration({ bytes: i8Bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-17T00:00:00.000Z" });
  assert.equal(i8.status, "workshop_ready");
  if (i8.status !== "workshop_ready" || "mode" in i8.workshop) assert.fail("I8A0S must provide its comparison Workshop.");
  const i8Navigation = buildEngineeringNavigationIndex(i8.workshop.definitions);
  assert.equal(i8Navigation.counts.ENGINEERING_QUALIFIED, 10);
  assert.equal(i8Navigation.counts.essentials, 10);
  assert.deepEqual(i8Navigation.entries.filter(entry => entry.essential).flatMap(entry => entry.systems).filter((value,index,array) => array.indexOf(value) === index).sort(), ["Boost & Air Control", "Fueling / Lambda", "IAT / Temperature Compensation", "Ignition / Timing", "Load & Torque", "Protection / Safety / Limiters", "WGDC / Turbo Control"]);

  const n54Bytes = new Uint8Array(fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"));
  const n54 = await loadSubscriberCalibration({ bytes: n54Bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-17T00:00:00.000Z" });
  assert.equal(n54.status, "workshop_ready");
  if (n54.status !== "workshop_ready" || "mode" in n54.workshop) assert.fail("IJE0S must provide its comparison Workshop.");
  const n54Navigation = buildEngineeringNavigationIndex(n54.workshop.definitions);
  assert.equal(n54Navigation.counts.ENGINEERING_QUALIFIED, 10);
  assert.equal(n54Navigation.counts.essentials, 10);
  assert.equal(filterEngineeringNavigation(n54Navigation, { mode: "all", query: "ethanol" }).filter(entry => entry.classification === "ENGINEERING_QUALIFIED").length, 4);
  assert.equal(n54.workshop.definitions.find(item => item.definitionRevision === heldRevision)?.semantic.outcome, "unavailable");
  assert.ok(!JSON.stringify(n54.workshop).includes("BMWtchctr_pct_WgBasc_M"));

  const b58Bytes = new Uint8Array(7_864_320), marker = Buffer.from("00003076501103", "hex");
  for (const offset of [262469, 6814977, 7863823]) b58Bytes.set(marker, offset);
  const startedAt = performance.now();
  const b58 = await loadSubscriberCalibration({ bytes: b58Bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-17T00:00:00.000Z" });
  assert.equal(b58.status, "workshop_ready");
  if (b58.status !== "workshop_ready" || !("mode" in b58.workshop)) assert.fail("B58 must provide its Current-only Workshop.");
  const b58Navigation = buildEngineeringNavigationIndex(b58.workshop.definitions.map(definition => ({ ...definition, available: definition.availability === "current_available" })));
  assert.equal(b58Navigation.counts.ENGINEERING_QUALIFIED, 7);
  assert.equal(b58Navigation.counts.essentials, 7);
  assert.equal(filterEngineeringNavigation(b58Navigation, { mode: "all", query: "feed-forward" }).length, 1);
  assert.ok(!JSON.stringify(b58.workshop).includes("Fuel Scalar Blend — Ethanol"));
  assert.ok(performance.now() - startedAt < 45_000);
  context.diagnostic(`SEMANTIC_PUBLICATION ${JSON.stringify({ i8a0sTables: i8.workshop.definitions.length, n54Tables: n54.workshop.definitions.length, b58Tables: b58.workshop.definitions.length })}`);
});

test("subscriber clients present qualified English primary names and retain original source language", () => {
  for (const file of ["app/dashboard/vehicles/[id]/calibration/workshop-client.tsx", "app/dashboard/vehicles/[id]/calibration/current-only-workshop-client.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /semanticTitle/);
    assert.match(source, /primary!==definition\.title|primary !== item\.title/);
  }
});
