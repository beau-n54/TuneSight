// No deployed consumer uses this former diagnostic endpoint. Authoritative
// Calibration providers load their qualified library server-side independently.
export function GET() {
  return Response.json({ error: "The diagnostic ROM-library endpoint is unavailable." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
