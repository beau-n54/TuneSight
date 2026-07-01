"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VehiclePageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const vehicleIdFromUrl = searchParams.get("id");
  const isNewVehicle = useMemo(
    () => searchParams.get("new") === "1",
    [searchParams]
  );

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engineCode, setEngineCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadVehicle = async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("You must be logged in.");
        setLoading(false);
        return;
      }

      if (isNewVehicle) {
        setVehicleId(null);
        setNickname("");
        setMake("");
        setModel("");
        setYear("");
        setEngineCode("");
        setLoading(false);
        return;
      }

      if (!vehicleIdFromUrl) {
        setVehicleId(null);
        setNickname("");
        setMake("");
        setModel("");
        setYear("");
        setEngineCode("");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("id, nickname, make, model, year, engine_code")
        .eq("id", vehicleIdFromUrl)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(`Error loading vehicle: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data) {
        setVehicleId(data.id);
        setNickname(data.nickname ?? "");
        setMake(data.make ?? "");
        setModel(data.model ?? "");
        setYear(data.year ? String(data.year) : "");
        setEngineCode(data.engine_code ?? "");
      } else {
        setVehicleId(null);
        setNickname("");
        setMake("");
        setModel("");
        setYear("");
        setEngineCode("");
      }

      setLoading(false);
    };

    loadVehicle();
  }, [vehicleIdFromUrl, isNewVehicle]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in.");
      setSaving(false);
      return;
    }

    if (!make.trim()) {
      setMessage("Please enter the make.");
      setSaving(false);
      return;
    }

    if (!model.trim()) {
      setMessage("Please enter the model.");
      setSaving(false);
      return;
    }

    if (!year.trim()) {
      setMessage("Please enter the year.");
      setSaving(false);
      return;
    }

    if (!engineCode.trim()) {
      setMessage("Please enter the engine code.");
      setSaving(false);
      return;
    }

    const yearNumber = Number(year);

    if (Number.isNaN(yearNumber)) {
      setMessage("Year must be a number.");
      setSaving(false);
      return;
    }

    if (vehicleId && !isNewVehicle) {
      const { error } = await supabase
        .from("vehicles")
        .update({
          nickname: nickname.trim() || null,
          make: make.trim(),
          model: model.trim(),
          year: yearNumber,
          engine_code: engineCode.trim(),
        })
        .eq("id", vehicleId)
        .eq("user_id", user.id);

      if (error) {
        setMessage(`Error saving vehicle: ${error.message}`);
        setSaving(false);
        return;
      }

      setMessage("Vehicle setup updated successfully.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        user_id: user.id,
        nickname: nickname.trim() || null,
        make: make.trim(),
        model: model.trim(),
        year: yearNumber,
        engine_code: engineCode.trim(),
      })
      .select("id")
      .single();

    if (error) {
      setMessage(`Error saving vehicle: ${error.message}`);
      setSaving(false);
      return;
    }

    setVehicleId(data.id);
    setMessage("New vehicle saved successfully.");
    setSaving(false);
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/garage"
          className="text-zinc-400 hover:text-white transition"
        >
          ← Back to Garage
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-6">
          {isNewVehicle ? "Add New Vehicle" : "Vehicle Setup"}
        </h1>

        <p className="text-zinc-400 mb-10">
          {isNewVehicle
            ? "Add a new vehicle to your garage."
            : "Configure your vehicle details so TuneSight can keep each build organised properly."}
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
          <div className="mb-6">
            <label className="block mb-2 text-sm text-zinc-400">
              Nickname
            </label>
            <input
              type="text"
              placeholder="e.g. Street Build, Track Car, Daily"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || saving}
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-sm text-zinc-400">Make</label>
            <input
              type="text"
              placeholder="e.g. BMW"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:outline-none focus:ring-blue-500"
              disabled={loading || saving}
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-sm text-zinc-400">Model</label>
            <input
              type="text"
              placeholder="e.g. 335i msport"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || saving}
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-sm text-zinc-400">Year</label>
            <input
              type="number"
              placeholder="e.g. 2007"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || saving}
            />
          </div>

          <div className="mb-8">
            <label className="block mb-2 text-sm text-zinc-400">
              Engine Code
            </label>
            <select
  value={engineCode}
  onChange={(e) => setEngineCode(e.target.value)}
  className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
  disabled={loading || saving}
>
  <option value="">Select Engine</option>
  <option value="N54">N54</option>
  <option value="N55">N55</option>
  <option value="B58 Gen 1">B58 Gen 1</option>
  <option value="B58 Gen 2">B58 Gen 2</option>
  <option value="S55">S55</option>
  <option value="S58">S58</option>
</select>
          </div>

          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="w-full py-4 bg-white text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : saving
              ? "Saving..."
              : isNewVehicle
              ? "Save New Vehicle"
              : vehicleId
              ? "Update Vehicle Setup"
              : "Save Vehicle Setup"}
          </button>

          {message && (
            <p
              className={`mt-4 ${
                message.toLowerCase().includes("error") ||
                message.toLowerCase().includes("must") ||
                message.toLowerCase().includes("please")
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
export default function VehiclePage() {
  return (
    <Suspense fallback={<div>Loading vehicle...</div>}>
      <VehiclePageContent />
    </Suspense>
  );
}