"use client";

import { useEffect, useState } from "react";

export default function ModsPage({ ownerId }: { ownerId: string }) {
  const prefix = `tunesight:setup-notes:${ownerId}:`;
  const [turbo, setTurbo] = useState("");
  const [fuelSystem, setFuelSystem] = useState("");
  const [intercooler, setIntercooler] = useState("");
  const [intake, setIntake] = useState("");
  const [exhaust, setExhaust] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (!active) return;
    try {
    setTurbo(localStorage.getItem(prefix + "turbo") || "");
    setFuelSystem(localStorage.getItem(prefix + "fuel_system") || "");
    setIntercooler(localStorage.getItem(prefix + "intercooler") || "");
    setIntake(localStorage.getItem(prefix + "intake") || "");
    setExhaust(localStorage.getItem(prefix + "exhaust") || "");
    } catch { setMessage("Browser settings could not be restored."); }
    });
    return () => { active = false; };
  }, [prefix]);

  const handleSave = () => {
    try {
    localStorage.setItem(prefix + "turbo", turbo);
    localStorage.setItem(prefix + "fuel_system", fuelSystem);
    localStorage.setItem(prefix + "intercooler", intercooler);
    localStorage.setItem(prefix + "intake", intake);
    localStorage.setItem(prefix + "exhaust", exhaust);

    setMessage("Saved in this browser only. This form does not change your Garage vehicle setup.");
    } catch { setMessage("Not saved: browser storage is unavailable or full."); }
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Vehicle Modifications</h1>
        <p className="text-zinc-400 mb-10">
          Account-scoped browser notes. Earlier unowned notes are not imported. Use the owned vehicle in Garage to update the setup used by Analysis.
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
