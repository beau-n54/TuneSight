import { defineChannelDefinition, type ChannelDefinition } from "./nativeVehicleData.ts";

export const ENET_HSFZ_PORT = 6801;
export const ENET_DISCOVERY_PORT = 6811;
export const ENET_TESTER_ADDRESS = 0xf4;
export const ENET_DME_ADDRESS = 0x12;

export type ObdPidDefinition = Readonly<{ pid: number; channel: ChannelDefinition; bytes: number; decode: (bytes: Uint8Array) => number }>;
const channel = (input: { key: string; pid: number; bytes: number; unit: string; scale: number; offset: number; provenance: string; decode: (bytes: Uint8Array) => number }): ObdPidDefinition => Object.freeze({ pid: input.pid, bytes: input.bytes, decode: input.decode, channel: defineChannelDefinition({ channelKey: input.key, sourceEndpointId: "dme-primary", protocol: "sae-j1979-over-bmw-enet-hsfz", serviceId: "01-current-data", requestId: `pid-${input.pid.toString(16).padStart(2, "0")}`, rawDataType: input.bytes === 1 ? "uint8" : "uint16", decoding: { kind: "linear", scale: input.scale, offset: input.offset, qualification: "qualified" }, unit: input.unit, applicability: { state: "qualified", dmeFamilies: ["obd-current-data-support-observed"] }, expectedRateHz: null, provenance: input.provenance }) });
const byte = (value: Uint8Array) => value[0] ?? Number.NaN;
const word = (value: Uint8Array) => ((value[0] ?? 0) << 8) | (value[1] ?? 0);

export const ENET_OBD_CHANNELS: readonly ObdPidDefinition[] = Object.freeze([
  channel({ key: "engine.speed", pid: 0x0c, bytes: 2, unit: "rpm", scale: 0.25, offset: 0, decode: (v) => word(v), provenance: "SAE J1979 Mode 01 PID 0C; available only after the connected DME advertises PID support." }),
  channel({ key: "map.absolute", pid: 0x0b, bytes: 1, unit: "kPa", scale: 1, offset: 0, decode: byte, provenance: "SAE J1979 Mode 01 PID 0B; absolute intake manifold pressure." }),
  channel({ key: "coolant.temperature", pid: 0x05, bytes: 1, unit: "°C", scale: 1, offset: -40, decode: byte, provenance: "SAE J1979 Mode 01 PID 05." }),
  channel({ key: "charge.temperature", pid: 0x0f, bytes: 1, unit: "°C", scale: 1, offset: -40, decode: byte, provenance: "SAE J1979 Mode 01 PID 0F intake-air temperature; it is not relabelled as a post-intercooler sensor." }),
  channel({ key: "throttle.position", pid: 0x11, bytes: 1, unit: "%", scale: 100 / 255, offset: 0, decode: byte, provenance: "SAE J1979 Mode 01 PID 11 absolute throttle position." }),
  channel({ key: "vehicle.speed", pid: 0x0d, bytes: 1, unit: "km/h", scale: 1, offset: 0, decode: byte, provenance: "SAE J1979 Mode 01 PID 0D." }),
  channel({ key: "airflow.mass", pid: 0x10, bytes: 2, unit: "g/s", scale: 0.01, offset: 0, decode: word, provenance: "SAE J1979 Mode 01 PID 10." }),
  channel({ key: "ambient.pressure", pid: 0x33, bytes: 1, unit: "kPa", scale: 1, offset: 0, decode: byte, provenance: "SAE J1979 Mode 01 PID 33." }),
  channel({ key: "oil.temperature", pid: 0x5c, bytes: 1, unit: "°C", scale: 1, offset: -40, decode: byte, provenance: "SAE J1979 Mode 01 PID 5C." }),
  channel({ key: "control-module.voltage", pid: 0x42, bytes: 2, unit: "V", scale: 0.001, offset: 0, decode: word, provenance: "SAE J1979 Mode 01 PID 42." }),
]);

export function encodeHsfzFrame(type: number, payload: Uint8Array): Buffer { const frame = Buffer.alloc(6 + payload.byteLength); frame.writeUInt32BE(payload.byteLength, 0); frame.writeUInt16BE(type, 4); Buffer.from(payload).copy(frame, 6); return frame; }
export function decodeHsfzFrames(bytes: Buffer): Readonly<{ frames: readonly Readonly<{ type: number; payload: Uint8Array }>[]; remainder: Buffer }> { const frames: { type: number; payload: Uint8Array }[] = []; let offset = 0; while (bytes.byteLength - offset >= 6) { const length = bytes.readUInt32BE(offset); if (length > 65_536) throw new Error("malformed_hsfz_length"); if (bytes.byteLength - offset < 6 + length) break; frames.push(Object.freeze({ type: bytes.readUInt16BE(offset + 4), payload: new Uint8Array(bytes.subarray(offset + 6, offset + 6 + length)) })); offset += 6 + length; } return Object.freeze({ frames: Object.freeze(frames), remainder: bytes.subarray(offset) }); }
export function encodeDmeRequest(service: number, parameters: readonly number[]): Buffer { return encodeHsfzFrame(0x0001, Uint8Array.from([ENET_TESTER_ADDRESS, ENET_DME_ADDRESS, service, ...parameters])); }
export function parseObdResponse(input: { pid: ObdPidDefinition; payload: Uint8Array }): number { const p = input.payload; if (p[0] !== ENET_DME_ADDRESS || p[1] !== ENET_TESTER_ADDRESS || p[2] !== 0x41 || p[3] !== input.pid.pid) throw new Error("unexpected_obd_response"); const data = p.slice(4, 4 + input.pid.bytes); if (data.byteLength !== input.pid.bytes) throw new Error("malformed_obd_response"); const raw = input.pid.decode(data); const converted = raw * input.pid.channel.decoding.scale + input.pid.channel.decoding.offset; if (!Number.isFinite(converted)) throw new Error("invalid_obd_conversion"); return converted; }
export function supportedPids(basePid: number, payload: Uint8Array): readonly number[] { if (payload[0] !== ENET_DME_ADDRESS || payload[1] !== ENET_TESTER_ADDRESS || payload[2] !== 0x41 || payload[3] !== basePid || payload.byteLength < 8) throw new Error("malformed_supported_pid_response"); const mask = ((payload[4]! << 24) | (payload[5]! << 16) | (payload[6]! << 8) | payload[7]!) >>> 0; return Object.freeze(Array.from({ length: 32 }, (_, index) => basePid + index + 1).filter((_, index) => Boolean(mask & (0x80000000 >>> index)))); }

export function deriveBoostActualKpa(input: { manifoldAbsoluteKpa: number; ambientAbsoluteKpa: number }): number {
  if (!Number.isFinite(input.manifoldAbsoluteKpa) || !Number.isFinite(input.ambientAbsoluteKpa) || input.manifoldAbsoluteKpa < 0 || input.ambientAbsoluteKpa <= 0) throw new Error("invalid_boost_inputs");
  return input.manifoldAbsoluteKpa - input.ambientAbsoluteKpa;
}

export function resolveExactRomSoftwareIdentity(expected: string, observedIdentifiers: readonly (string | null)[]): string | null {
  return observedIdentifiers.some((value) => value === expected) ? expected : null;
}
