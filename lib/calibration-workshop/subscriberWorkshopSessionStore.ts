import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { deserialize, serialize } from "node:v8";
import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";

const TTL_MS = 30 * 60 * 1000, MAX_SESSIONS = 16, SESSION_DIRECTORY = path.resolve(".next/cache/subscriber-workshop-sessions");
type Entry = { ownerId: string; vehicleId: string; expiresAt: number; result: SubscriberCalibrationResult };
function sessionPath(id: string): string | null { return isSubscriberWorkshopSessionId(id) ? path.join(SESSION_DIRECTORY, `${id}.session`) : null; }
function readEntry(file: string): Entry | null { try { return deserialize(fs.readFileSync(file)) as Entry; } catch { return null; } }
function prune(now = Date.now(), maximum = MAX_SESSIONS) { fs.mkdirSync(SESSION_DIRECTORY, { recursive: true }); const files = fs.readdirSync(SESSION_DIRECTORY).filter((name) => /^[A-Za-z0-9_-]{32}\.session$/.test(name)).map((name) => path.join(SESSION_DIRECTORY, name)); for (const file of files) { const entry = readEntry(file); if (!entry || entry.expiresAt <= now) fs.rmSync(file, { force: true }); } const retained = fs.readdirSync(SESSION_DIRECTORY).filter((name) => name.endsWith(".session")).map((name) => path.join(SESSION_DIRECTORY, name)).sort((left, right) => fs.statSync(left).mtimeMs - fs.statSync(right).mtimeMs); while (retained.length > maximum) fs.rmSync(retained.shift()!, { force: true }); }
export function createSubscriberWorkshopSession(ownerId: string, vehicleId: string, result: SubscriberCalibrationResult): string { prune(Date.now(), MAX_SESSIONS - 1); const id = randomBytes(24).toString("base64url"), file = sessionPath(id)!, temporary = `${file}.${process.pid}.tmp`; fs.writeFileSync(temporary, serialize({ ownerId, vehicleId, expiresAt: Date.now() + TTL_MS, result } satisfies Entry), { mode: 0o600 }); fs.renameSync(temporary, file); return id; }
export function readSubscriberWorkshopSession(id: string, ownerId: string, vehicleId: string): SubscriberCalibrationResult | null { prune(); const file = sessionPath(id); if (!file) return null; const entry = readEntry(file); if (!entry || entry.expiresAt <= Date.now() || entry.ownerId !== ownerId || entry.vehicleId !== vehicleId) return null; return entry.result; }
export function clearSubscriberWorkshopSessionsForTests() { if (!fs.existsSync(SESSION_DIRECTORY)) return; for (const name of fs.readdirSync(SESSION_DIRECTORY)) if (/^[A-Za-z0-9_-]{32}\.session$/.test(name)) fs.rmSync(path.join(SESSION_DIRECTORY, name), { force: true }); }
