export type WorkshopDeepLinkState = Readonly<{
  vehicleId: string;
  previewRom: string;
  definition?: string | null;
}>;

export function buildWorkshopDeepLink(state: WorkshopDeepLinkState): string {
  if (!state.vehicleId.trim()) throw new Error("Workshop navigation requires a vehicle identity.");
  if (!state.previewRom.trim()) throw new Error("Workshop navigation requires an explicit preview ROM.");
  const parameters = new URLSearchParams();
  parameters.set("previewRom", state.previewRom);
  if (state.definition) parameters.set("definition", state.definition);
  return `/dashboard/vehicles/${encodeURIComponent(state.vehicleId)}/calibration?${parameters.toString()}`;
}
