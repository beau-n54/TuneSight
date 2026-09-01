export function calibrationWorkshopPath(vehicleId: string): string {
  const normalized = vehicleId.trim();
  if (!normalized) throw new Error("Vehicle identity is required.");
  return `/dashboard/vehicles/${encodeURIComponent(normalized)}/calibration`;
}

export function isSubscriberWorkshopSessionId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

export function subscriberWorkshopSessionPath(vehicleId: string, sessionId: string): string {
  if (!isSubscriberWorkshopSessionId(sessionId)) throw new Error("A valid subscriber Workshop session identity is required.");
  return `${calibrationWorkshopPath(vehicleId)}?session=${encodeURIComponent(sessionId)}`;
}
