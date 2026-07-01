import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const vehicleId = formData.get("vehicleId") as string;

  if (!vehicleId) {
    return NextResponse.redirect(new URL("/garage", request.url), {
      status: 303,
    });
  }

  const updatedData = {
    nickname: (formData.get("nickname") as string) || "",
    year: (formData.get("year") as string) || "",
    make: (formData.get("make") as string) || "",
    model: (formData.get("model") as string) || "",
    engine_code: (formData.get("engine_code") as string) || "",
    fuel_type: (formData.get("fuel_type") as string) || "",
    transmission: (formData.get("transmission") as string) || "",
    tune_status: (formData.get("tune_status") as string) || "",
    turbos: (formData.get("turbos") as string) || "",
    intercooler: (formData.get("intercooler") as string) || "",
    downpipes: (formData.get("downpipes") as string) || "",
    map_sensor: (formData.get("map_sensor") as string) || "",
    fuel_system: (formData.get("fuel_system") as string) || "",
    port_injection: (formData.get("port_injection") as string) || "",
    injectors: (formData.get("injectors") as string) || "",
    coils: (formData.get("coils") as string) || "",
    turbo_setup: (formData.get("turbo_setup") as string) || "",
    fueling_setup: (formData.get("fueling_setup") as string) || "",
    horsepower_goal: formData.get("horsepower_goal")
      ? Number(formData.get("horsepower_goal"))
      : null,
    notes: (formData.get("notes") as string) || "",
  };

  const { error } = await supabase
    .from("vehicles")
    .update(updatedData)
    .eq("id", vehicleId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating vehicle:", error.message);

    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}/edit`, request.url),
      { status: 303 }
    );
  }

  return NextResponse.redirect(
    new URL(`/dashboard/vehicles/${vehicleId}`, request.url),
    { status: 303 }
  );
}