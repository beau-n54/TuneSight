import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import LiveTelemetryWorkspace from "@/components/LiveTelemetryWorkspace";
import { createClient } from "@/lib/supabase/server";

export default async function VehicleTelemetryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: vehicle, error } = await supabase.from("vehicles").select("id, nickname, year, make, model, engine_code").eq("id", id).eq("user_id", user.id).single(); if (error || !vehicle) notFound();
  return <main className="min-h-screen bg-black px-6 py-10 text-white"><div className="mx-auto max-w-6xl"><Link href={`/dashboard/vehicles/${vehicle.id}`} className="mb-6 inline-flex text-zinc-400 hover:text-white">← Back to Vehicle</Link><LiveTelemetryWorkspace vehicle={{ id: vehicle.id, name: vehicle.nickname || "Unnamed Vehicle", description: `${vehicle.year || "Unknown year"} ${vehicle.make || "Unknown make"} ${vehicle.model || "Unknown model"}`, engineCode: vehicle.engine_code || "Unknown" }} /></div></main>;
}
