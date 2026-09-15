export type SubscriberProcessingFailure = Readonly<{
  outcome: "invalid_upload" | "storage_failure" | "provider_rejection";
  code: "UPLOAD_LEASE_INVALID" | "TRANSIENT_OBJECT_RETRIEVAL" | "SOURCE_BINDING" | "SOURCE_OBJECT_WRITE" | "SOURCE_LEASE_WRITE" | "SOURCE_POINTER_WRITE" | "SOURCE_REPLACEMENT_CLEANUP" | "PROVIDER_REJECTION";
  error: string;
  status: 400 | 422 | 503;
}>;

export function classifySubscriberProcessingFailure(error: unknown): SubscriberProcessingFailure {
  const internal = error instanceof Error ? error.message : "";
  if (internal === "PRIVATE_UPLOAD_LEASE_INVALID") return Object.freeze({ outcome: "invalid_upload", code: "UPLOAD_LEASE_INVALID", error: "Calibration upload lease is invalid or expired.", status: 400 });
  if (internal === "PRIVATE_UPLOAD_READ_FAILED") return Object.freeze({ outcome: "storage_failure", code: "TRANSIENT_OBJECT_RETRIEVAL", error: "Private calibration upload could not be retrieved for processing.", status: 503 });
  if (internal === "SOURCE_BINARY_BINDING_MISMATCH") return Object.freeze({ outcome: "storage_failure", code: "SOURCE_BINDING", error: "Source calibration evidence did not match its exact processing binding.", status: 503 });
  if (internal === "SOURCE_BINARY_WRITE_FAILED") return Object.freeze({ outcome: "storage_failure", code: "SOURCE_OBJECT_WRITE", error: "Private source calibration storage could not retain the reconstruction source.", status: 503 });
  if (internal === "SOURCE_BINARY_LEASE_WRITE_FAILED") return Object.freeze({ outcome: "storage_failure", code: "SOURCE_LEASE_WRITE", error: "Private source calibration storage could not retain the reconstruction lease.", status: 503 });
  if (internal === "SOURCE_BINARY_POINTER_WRITE_FAILED") return Object.freeze({ outcome: "storage_failure", code: "SOURCE_POINTER_WRITE", error: "Private source calibration storage could not activate the reconstruction lease.", status: 503 });
  if (internal === "SOURCE_BINARY_DELETE_FAILED") return Object.freeze({ outcome: "storage_failure", code: "SOURCE_REPLACEMENT_CLEANUP", error: "Private source calibration storage could not replace the prior reconstruction lease.", status: 503 });
  return Object.freeze({ outcome: "provider_rejection", code: "PROVIDER_REJECTION", error: "Calibration evidence was rejected by the governed provider.", status: 422 });
}
