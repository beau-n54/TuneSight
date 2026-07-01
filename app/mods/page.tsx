"use client";

import { useEffect, useState } from "react";

export default function ModsPage() {
  const [turbo, setTurbo] = useState("");
  const [fuelSystem, setFuelSystem] = useState("");
  const [intercooler, setIntercooler] = useState("");
  const [intake, setIntake] = useState("");
  const [exhaust, setExhaust] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTurbo(localStorage.getItem("ts_mod_turbo") || "");
    setFuelSystem(localStorage.getItem("ts_mod_fuel_system") || "");
    setIntercooler(localStorage.getItem("ts_mod_intercooler") || "");
    setIntake(localStorage.getItem("ts_mod_intake") || "");
    setExhaust(localStorage.getItem("ts_mod_exhaust") || "");
  }, []);

  const handleSave = () => {
    localStorage.setItem("ts_mod_turbo", turbo);
    localStorage.setItem("ts_mod_fuel_system", fuelSystem);
    localStorage.setItem("ts_mod_intercooler", intercooler);
    localStorage.setItem("ts_mod_intake", intake);
    localStorage.setItem("ts_mod_exhaust", exhaust);

    setMessage("Modifications saved.");
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Vehicle Modifications</h1>
        <p className="text-zinc-400 mb-10">
          Store the core parts of your setup so TuneSight can analyse logs with better context.
        </p>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-zinc-400">Turbo Setup</label>
          <input
            type="text"
            placeholder="e.g. Stock twins, 17T, Pure800"
            value={turbo}
            onChange={(e) => setTurbo(e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-zinc-400">Fuel System</label>
          <input
            type="text"
            placeholder="e.g. Stock HPFP, Dorch Stage 2, PI"
            value={fuelSystem}
            onChange={(e) => setFuelSystem(e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-zinc-400">Intercooler</label>
          <input
            type="text"
            placeholder="e.g. VRSF 7.5 Race"
            value={intercooler}
            onChange={(e) => setIntercooler(e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-zinc-400">Intake</label>
          <input
            type="text"
            placeholder="e.g. Dual cone intake"
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
          />
        </div>

        <div className="mb-10">
          <label className="block mb-2 text-sm text-zinc-400">Exhaust / Downpipes</label>
          <input
            type="text"
            placeholder="e.g. Catless downpipes, 3 inch exhaust"
            value={exhaust}
            onChange={(e) => setExhaust(e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-4 bg-white text-black rounded-xl font-semibold hover:opacity-80 transition"
        >
          Save Modifications
        </button>

        {message && <p className="mt-4 text-green-400">{message}</p>}
      </div>
    </main>
  );
}