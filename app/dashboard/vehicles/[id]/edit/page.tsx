import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditVehiclePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !vehicle) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/dashboard/vehicles/${id}`}
          className="inline-flex items-center text-zinc-400 transition hover:text-white"
        >
          ← Back to Vehicle
        </Link>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <h1 className="mb-2 text-3xl font-bold">Edit Vehicle Setup</h1>
          <p className="text-zinc-400">
            Update your vehicle details and setup so TuneSight can compare logs
            against the actual build.
          </p>
        </div>

        <form
          action="/api/vehicles/update"
          method="POST"
          className="space-y-6"
        >
          <input type="hidden" name="vehicleId" value={vehicle.id} />

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Vehicle Basics</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Nickname"
                name="nickname"
                defaultValue={vehicle.nickname || ""}
              />
              <InputField
                label="Year"
                name="year"
                defaultValue={vehicle.year || ""}
              />
              <InputField
                label="Make"
                name="make"
                defaultValue={vehicle.make || ""}
              />
              <InputField
                label="Model"
                name="model"
                defaultValue={vehicle.model || ""}
              />
              <InputField
                label="Engine Code"
                name="engine_code"
                defaultValue={vehicle.engine_code || ""}
              />
              <InputField
                label="Fuel Type"
                name="fuel_type"
                defaultValue={vehicle.fuel_type || ""}
              />
              <InputField
                label="Transmission"
                name="transmission"
                defaultValue={vehicle.transmission || ""}
              />
              <InputField
                label="Tune Status"
                name="tune_status"
                defaultValue={vehicle.tune_status || ""}
              />
            </div>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Power & Airflow</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Turbos"
                name="turbos"
                defaultValue={vehicle.turbos || ""}
              />
              <InputField
                label="Intercooler"
                name="intercooler"
                defaultValue={vehicle.intercooler || ""}
              />
              <InputField
                label="Downpipes"
                name="downpipes"
                defaultValue={vehicle.downpipes || ""}
              />
              <InputField
                label="MAP Sensor"
                name="map_sensor"
                defaultValue={vehicle.map_sensor || ""}
              />
            </div>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Fuel & Ignition</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Fuel System"
                name="fuel_system"
                defaultValue={vehicle.fuel_system || ""}
              />
              <InputField
                label="Port Injection"
                name="port_injection"
                defaultValue={vehicle.port_injection || ""}
              />
              <InputField
                label="Injectors"
                name="injectors"
                defaultValue={vehicle.injectors || ""}
              />
              <InputField
                label="Coils"
                name="coils"
                defaultValue={vehicle.coils || ""}
              />
            </div>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Cross-Reference Setup</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Turbo Setup"
                name="turbo_setup"
                defaultValue={vehicle.turbo_setup || ""}
              />
              <InputField
                label="Fueling Setup"
                name="fueling_setup"
                defaultValue={vehicle.fueling_setup || ""}
              />
              <InputField
                label="Horsepower Goal"
                name="horsepower_goal"
                defaultValue={vehicle.horsepower_goal || ""}
              />
            </div>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Notes</h2>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Notes</label>
              <textarea
                name="notes"
                defaultValue={vehicle.notes || ""}
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bmw-border rounded-xl bg-zinc-900 px-6 py-3 text-white transition hover:bg-zinc-800"
          >
            Save Vehicle Setup
          </button>
        </form>
      </div>
    </main>
  );
}

function InputField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-zinc-400">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-blue-500"
      />
    </div>
  );
}