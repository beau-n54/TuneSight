import { RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";
import { classifyEntryEditCapabilities } from "./editAuthority.ts";
import { assessXdfDefinitionTechnicalEditCapability } from "./workingCalibrationCapability.ts";

export type WorkingCalibrationCapabilityAudit = Readonly<{ relationships: number; tables: number; technicallyReversible: number; inverseBlocked: number; quarantined: number; unavailable: number; editQualified: number; viewOnly: number }>;
export function auditRepositoryWorkingCalibrationCapabilities(): WorkingCalibrationCapabilityAudit {
  const entries = RepositoryDefinitionCatalog.listEntries().filter((entry) => entry.lifecycleState === "active" && entry.applicabilityState === "published"), definitions = entries.flatMap((entry) => entry.authority.definitions.map((definition) => ({ definition, quarantined: entry.quarantines.some((item) => item.occurrence.definitionRevisionId === definition.revisionId) })));
  const technicallyReversible = definitions.filter((item) => !item.quarantined && assessXdfDefinitionTechnicalEditCapability(item.definition).state === "technically_reversible").length, quarantined = definitions.filter((item) => item.quarantined).length, inverseBlocked = definitions.length - technicallyReversible - quarantined;
  const capabilities = entries.flatMap(classifyEntryEditCapabilities), editQualified = capabilities.filter((item) => item.state === "EDIT_QUALIFIED").length;
  return Object.freeze({ relationships: entries.length, tables: definitions.length, technicallyReversible, inverseBlocked, quarantined, unavailable: definitions.length - editQualified, editQualified, viewOnly: definitions.length - editQualified });
}
