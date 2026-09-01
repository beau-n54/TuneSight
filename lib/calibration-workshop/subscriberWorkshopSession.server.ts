import "server-only";
import { randomBytes } from "node:crypto";
import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";

const TTL_MS = 30 * 60 * 1000, MAX_SESSIONS = 16;
type Entry = { ownerId: string; vehicleId: string; expiresAt: number; result: SubscriberCalibrationResult };
const sessions = new Map<string, Entry>();
function prune(now = Date.now()) { for (const [id, entry] of sessions) if (entry.expiresAt <= now) sessions.delete(id); while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!); }
export function createSubscriberWorkshopSession(ownerId: string, vehicleId: string, result: SubscriberCalibrationResult): string { prune(); const id = randomBytes(24).toString("base64url"); sessions.set(id, { ownerId, vehicleId, expiresAt: Date.now() + TTL_MS, result }); return id; }
export function readSubscriberWorkshopSession(id: string, ownerId: string, vehicleId: string): SubscriberCalibrationResult | null { prune(); const entry = sessions.get(id); if (!entry || entry.ownerId !== ownerId || entry.vehicleId !== vehicleId) return null; return entry.result; }
export function clearSubscriberWorkshopSessionsForTests() { sessions.clear(); }
