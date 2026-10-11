import { requireSubscriberAction, requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteOwnedVehicle } from "@/lib/security/vehicleDeletion.server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listPage, LIST_PAGE_SIZE } from "@/lib/security/listBounds";
import ListPagination from "@/components/ListPagination";

export default async function GaragePage({ searchParams }: { searchParams: Promise<{ deletion?: string; page?: string }> }) {
  const query = await searchParams;
  const page = listPage(query.page);
  await requireSubscriberPage();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function deleteVehicle(formData: FormData) {
    "use server";

    await requireSubscriberAction();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const vehicleId = formData.get("vehicleId");

    if (!vehicleId || typeof vehicleId !== "string") return;

    let failed = false;
    try { await deleteOwnedVehicle(supabase, user.id, vehicleId); } catch { failed = true; }
    if (failed) redirect("/garage?deletion=incomplete");
    revalidatePath("/garage");
  }

  const { data: vehicleRows, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false }).order("id").range(page*LIST_PAGE_SIZE, (page+1)*LIST_PAGE_SIZE);
  const vehicles = vehicleRows?.slice(0,LIST_PAGE_SIZE);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="text-zinc-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Garage</h1>
        {query.deletion === "incomplete" && <p role="alert" className="mb-6 text-amber-300">Deletion is not complete. The recovery inventory is retained. Retry Delete Vehicle; the owning record is removed only after object cleanup is confirmed.</p>}
        <p className="text-zinc-400 mb-10">
          Your Garage is where all your vehicles live. Click a vehicle to open
          its own workspace.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-2">Your Vehicles</h2>
          <p className="text-zinc-400">
            Vehicles on this page: {vehicles?.length ?? 0}
          </p>

          {error && (
            <p className="text-red-400 mt-4">
              Vehicle list is temporarily unavailable. Please retry.
            </p>
          )}
        </div>

        <ListPagination path="/garage" page={page} hasMore={(vehicleRows?.length ?? 0)>LIST_PAGE_SIZE}/>
        <div className="space-y-4 mb-10">
          {vehicles && vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <div
  key={vehicle.id}
  className="bmw-border rounded-2xl bg-zinc-900 p-6"
>
                
                <Link
  href={`/dashboard/vehicles/${vehicle.id}`}
  className="block hover:opacity-90 transition"
>
                  <h3 className="text-2xl font-semibold mb-2">
                    {vehicle.nickname || "Unnamed Vehicle"}
                  </h3>

                  <p className="text-zinc-400 mb-1">
                    {vehicle.year || "Unknown Year"} {vehicle.make || "Unknown Make"}{" "}
                    {vehicle.model || "Unknown Model"}
                  </p>

                  <p className="text-zinc-500 text-sm mb-4">
                    Engine Code: {vehicle.engine_code || "Unknown"}
                  </p>
                </Link>

                <div className="flex flex-wrap gap-3">
                  <Link
  href={`/dashboard/vehicles/${vehicle.id}`}
  className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-black"
>
  Open Vehicle
</Link>

                  <form action={deleteVehicle}>
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-xl border border-red-500 px-4 py-2 text-red-400 hover:bg-red-500 hover:text-white transition"
                    >
                      Delete Vehicle
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            !error && (
              <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
                <p className="text-zinc-400 mb-4">No vehicles added yet.</p>

                <Link
                  href="/vehicle?new=1"
                  className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-black font-semibold hover:opacity-90 transition"
                >
                  Add Your First Vehicle
                </Link>
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/vehicle?new=1"
            className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-black font-semibold hover:opacity-90 transition"
          >
            Add Another Vehicle
          </Link>
        </div>
      </div>
    </main>
  );
}
