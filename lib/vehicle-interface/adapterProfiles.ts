import { createHash } from "node:crypto";
import type { ReadOnlyOperation } from "./nativeVehicleData.ts";

export type AdapterEvidence = Readonly<{ uri: string; classification: "manufacturer_documented" | "official_application_documented" | "credible_secondary"; claim: string }>;
export type NetworkEndpoint = Readonly<{ host: string; port: number; protocol: "tcp" | "udp"; state: "documented" | "strongly_evidenced" | "unknown" }>;
export type VehicleAdapterProfile = Readonly<{
  profileId: string;
  profileRevision: string;
  manufacturer: string;
  productFamily: string;
  transport: "wifi_serial_bridge" | "wifi_ethernet_bridge" | "wired_ethernet" | "usb_diagnostic" | "unknown_wifi";
  wifiSsids: readonly string[];
  discovery: "configured_endpoint" | "network_service_discovery" | "unknown";
  endpoints: readonly NetworkEndpoint[];
  protocolCapabilities: readonly ("k_dcan" | "enet_hsfz" | "doip" | "unknown")[];
  readOnlyOperations: readonly ReadOnlyOperation[];
  externallySupportedVehicleScopes: readonly string[];
  unknownProperties: readonly string[];
  evidence: readonly AdapterEvidence[];
  qualification: "externally_documented_physical_verification_pending";
}>;

const READ_ONLY: readonly ReadOnlyOperation[] = Object.freeze(["discover", "open", "connect", "identify", "read", "stream", "disconnect"]);
const digest = (value: unknown) => createHash("sha256").update("tunesight.vehicle-adapter-profile.v1\0").update(JSON.stringify(value)).digest("hex");

export function defineVehicleAdapterProfile(input: Omit<VehicleAdapterProfile, "profileId" | "profileRevision" | "readOnlyOperations" | "qualification"> & { profileKey: string }): VehicleAdapterProfile {
  if (!input.profileKey.trim() || !input.manufacturer.trim() || !input.productFamily.trim()) throw new Error("Adapter profile identity is incomplete.");
  for (const endpoint of input.endpoints) if (endpoint.port < 1 || endpoint.port > 65535 || !Number.isInteger(endpoint.port)) throw new Error("Adapter endpoint port is invalid.");
  const stable = { manufacturer: input.manufacturer, productFamily: input.productFamily, profileKey: input.profileKey };
  const revision = { ...stable, transport: input.transport, wifiSsids: [...input.wifiSsids].sort(), discovery: input.discovery, endpoints: input.endpoints, protocolCapabilities: [...input.protocolCapabilities].sort(), externallySupportedVehicleScopes: [...input.externallySupportedVehicleScopes].sort(), unknownProperties: [...input.unknownProperties].sort(), evidence: input.evidence };
  return Object.freeze({ ...revision, profileId: `vehicle-adapter-profile:${digest(stable)}`, profileRevision: `vehicle-adapter-profile-revision:${digest(revision)}`, wifiSsids: Object.freeze(revision.wifiSsids), endpoints: Object.freeze(input.endpoints.map((value) => Object.freeze({ ...value }))), protocolCapabilities: Object.freeze(revision.protocolCapabilities), readOnlyOperations: READ_ONLY, externallySupportedVehicleScopes: Object.freeze(revision.externallySupportedVehicleScopes), unknownProperties: Object.freeze(revision.unknownProperties), evidence: Object.freeze(input.evidence.map((value) => Object.freeze({ ...value }))), qualification: "externally_documented_physical_verification_pending" });
}

export const THOR_WIFI_PROFILE = defineVehicleAdapterProfile({ profileKey: "thor-wifi-can-generation", manufacturer: "THOR", productFamily: "OBD II WiFi Dongle", transport: "wifi_serial_bridge", wifiSsids: [], discovery: "configured_endpoint", endpoints: [{ host: "192.168.4.1", port: 23, protocol: "tcp", state: "strongly_evidenced" }], protocolCapabilities: ["k_dcan"], externallySupportedVehicleScopes: ["BMW E-series through D-CAN; older K-line vehicles require separate hardware"], unknownProperties: ["exact owned-adapter SSID and firmware", "endpoint/framing confirmation", "authentication or proprietary handshake", "B58/ENET capability", "sustained logging rate and latency"], evidence: [{ uri: "https://www.bimmergeeks.net/product-page/protool-thor-xhp-wifi-adapter", classification: "credible_secondary", claim: "THOR WiFi product support and explicit B58 limitation." }, { uri: "https://www.bmwklubpolska.pl/forum/topic/173014-n47-m47-aplikacja-android-diagnostyka-dpf-i-wi%C4%99cej/page/203/", classification: "credible_secondary", claim: "D-CAN, configured host 192.168.4.1 and TCP port 23." }] });

export const MHD_ORANGE_PROFILE = defineVehicleAdapterProfile({ profileKey: "mhd-orange-can-generation", manufacturer: "MHD Tuning", productFamily: "MHD Orange WiFi", transport: "wifi_serial_bridge", wifiSsids: ["MHD CAN"], discovery: "unknown", endpoints: [], protocolCapabilities: ["k_dcan"], externallySupportedVehicleScopes: ["BMW E-series through CAN/K+DCAN"], unknownProperties: ["owned-adapter IP address and port", "socket framing", "authentication or proprietary handshake", "B58/ENET capability", "sustained logging rate and latency"], evidence: [{ uri: "https://data.mhdtuning.com/downloads/MHD%20User%20Guide.pdf", classification: "manufacturer_documented", claim: "Orange adapter joins an adapter-created WiFi network; internet continuity may be affected." }, { uri: "https://bimmercode.app/manual/", classification: "official_application_documented", claim: "MHD CAN SSID identifies the orange profile; MHD ENET identifies the separate black profile." }, { uri: "https://mhdtuning.com/pages/mhd-wireless-adapter", classification: "manufacturer_documented", claim: "New Universal model distinguishes CAN for E-series from ENET for F/G and identifies orange as a previous generation." }] });

export const BMW_ENET_CABLE_PROFILE = defineVehicleAdapterProfile({ profileKey: "bmw-f-series-enet-cable", manufacturer: "BMW-compatible", productFamily: "OBD-to-Ethernet ENET cable", transport: "wired_ethernet", wifiSsids: [], discovery: "network_service_discovery", endpoints: [], protocolCapabilities: ["enet_hsfz"], externallySupportedVehicleScopes: ["BMW F-series diagnostic Ethernet where supported"], unknownProperties: ["connected vehicle network address", "DME endpoint discovered for the current vehicle", "physical sustained logging rate and latency", "exact DME native-channel request authority"], evidence: [{ uri: "https://bmwtechinfo.bmwgroup.com/tech_training_manual/ST401%20Body%20Electronics%20II.pdf", classification: "manufacturer_documented", claim: "BMW F-series diagnostic Ethernet is available through the OBD diagnostic socket and uses TCP/IP and UDP." }] });

export const GENERIC_USB_DIAGNOSTIC_PROFILE = defineVehicleAdapterProfile({ profileKey: "generic-usb-diagnostic-unqualified", manufacturer: "Unspecified", productFamily: "USB diagnostic interface", transport: "usb_diagnostic", wifiSsids: [], discovery: "unknown", endpoints: [], protocolCapabilities: ["unknown"], externallySupportedVehicleScopes: [], unknownProperties: ["exact hardware and driver", "F-series Ethernet capability", "protocol and framing", "DME applicability", "native-channel request authority"], evidence: [{ uri: "https://bmwtechinfo.bmwgroup.com/assets/site_information.pdf", classification: "manufacturer_documented", claim: "BMW service information documents ICOM or SAE J2534 pass-through devices and manufacturer-dependent USB drivers; this does not qualify arbitrary USB interfaces for TuneSight telemetry." }] });
