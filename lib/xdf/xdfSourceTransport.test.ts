import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { defineDefinitionSetRevision } from "./definitionRomApplicability.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";
import { N54_CURRENT_GOVERNED_REVIEW_REFERENCES } from "./n54GovernedApplicabilityAdmission.ts";

test("governed XDF bytes and Definition Set revisions survive repository transport exactly", () => {
  assert.match(fs.readFileSync(".gitattributes", "utf8"), /^\*\.xdf -text -diff$/m);
  for (const item of N54_CURRENT_GOVERNED_REVIEW_REFERENCES) {
    const relative = `BMW-XDFs-master/N54/${item.identity}.xdf`, fullPath = path.resolve(relative);
    const workingObject = execFileSync("git", ["hash-object", "--no-filters", fullPath], { encoding: "utf8" }).trim();
    const repositoryObject = execFileSync("git", ["rev-parse", `:${relative}`], { encoding: "utf8" }).trim();
    assert.equal(workingObject, repositoryObject, "XDF working bytes must equal the repository object without text conversion");
    const parsed = interpretXdfStructure({ xml: fs.readFileSync(fullPath, "utf8"), filename: "controlled.xdf", provenance: "repository transport proof" });
    assert.equal(parsed.outcome, "structurally_interpreted");
    assert.ok(parsed.sourceArtifact);
    const definitionSet = defineDefinitionSetRevision({ sourceArtifact: parsed.sourceArtifact!, definitions: parsed.definitions });
    assert.equal(parsed.sourceArtifact!.sourceDigest, item.review.sourceArtifactDigest);
    assert.equal(definitionSet.definitionSetId, item.review.definitionSetId);
    assert.equal(definitionSet.revisionId, item.review.definitionSetRevisionId);
  }
});
