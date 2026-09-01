export type WorkshopDeepLinkState = Readonly<{
  vehicleId: string;
  previewRom?: string;
  subscriberSession?: string;
  definition?: string | null;
}>;

export function buildWorkshopDeepLink(state: WorkshopDeepLinkState): string {
  if (!state.vehicleId.trim()) throw new Error("Workshop navigation requires a vehicle identity.");
  if (Boolean(state.previewRom?.trim()) === Boolean(state.subscriberSession?.trim())) throw new Error("Workshop navigation requires exactly one preview ROM or subscriber session.");
  const parameters = new URLSearchParams();
  if (state.previewRom) parameters.set("previewRom", state.previewRom);
  if (state.subscriberSession) parameters.set("session", state.subscriberSession);
  if (state.definition) parameters.set("definition", state.definition);
  return `/dashboard/vehicles/${encodeURIComponent(state.vehicleId)}/calibration?${parameters.toString()}`;
}
