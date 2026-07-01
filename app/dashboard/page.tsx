"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [plan, setPlan] = useState("starter");

  useEffect(() => {
    const savedPlan = localStorage.getItem("ts_plan") || "starter";
    setPlan(savedPlan);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Dashboard</h1>
        <p className="text-zinc-400 mb-2">
          Welcome to TuneSight.
        </p>
        <p className="text-zinc-400 mb-10">
          Current Plan: <span className="text-white font-semibold capitalize">{plan}</span>
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/garage"
            className="bmw-border rounded-2xl bg-zinc-900 p-8 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Garage</h2>
            <p className="text-zinc-400">
              View and manage your vehicles, logs, modifications, and tunes.
            </p>
          </Link>

          <Link
            href="/logs"
            className="bmw-border rounded-2xl bg-zinc-900 p-8 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Upload Log</h2>
            <p className="text-zinc-400">
              Quickly upload and analyse a new MHD log file.
            </p>
          </Link>

          <Link
            href="/account"
            className="bmw-border rounded-2xl bg-zinc-900 p-8 hover:opacity-90 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Account</h2>
            <p className="text-zinc-400">
              Manage your login, subscription, billing, and support options.
            </p>
          </Link>
        </div>

        {plan === "starter" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Starter Features</h2>
            <p className="text-zinc-400">
              Single vehicle workflow, log upload, core AI insights, and basic setup tracking.
            </p>
          </div>
        )}

        {plan === "pro" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Pro Features</h2>
            <p className="text-zinc-400">
              Multiple vehicle support, unlimited log uploads, tune file upload, and log-to-tune cross-referencing.
            </p>
          </div>
        )}

        {plan === "workshop" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Workshop Features</h2>
            <p className="text-zinc-400">
              Team workflow, customer vehicle management, unlimited uploads, and workshop-level tune/log organisation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}