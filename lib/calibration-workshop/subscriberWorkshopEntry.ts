export type SubscriberWorkshopEntry =
  | Readonly<{ mode: "subscriber" }>
  | Readonly<{ mode: "development_preview"; requestedPreviewRom: string }>
  | Readonly<{ mode: "empty" }>;

export function selectSubscriberWorkshopEntry(input: Readonly<{
  subscriberReady: boolean;
  requestedPreviewRom: string | undefined;
  runtimeEnvironment: string | undefined;
}>): SubscriberWorkshopEntry {
  if (input.subscriberReady) return Object.freeze({ mode: "subscriber" });
  if (input.runtimeEnvironment !== "production" && input.requestedPreviewRom?.trim()) return Object.freeze({ mode: "development_preview", requestedPreviewRom: input.requestedPreviewRom });
  return Object.freeze({ mode: "empty" });
}
