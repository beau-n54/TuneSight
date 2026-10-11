"use client";
import Link from "next/link";
export default function DashboardPage() {
  const plan = "Controlled unpaid beta";
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-5xl font-bold">Dashboard</h1>

        <p className="mb-2 text-zinc-400">Welcome to TuneSight.</p>

        <p className="mb-10 text-zinc-400">
          Current Plan:{" "}
          <span className="font-semibold capitalize text-white">{plan}</span>
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <Link
            href="/garage"
            className="bmw-border block rounded-2xl bg-zinc-900 p-8 transition hover:scale-[1.02] hover:border-white"
          >
            <h2 className="mb-2 text-2xl font-semibold">Garage</h2>
            <p className="text-zinc-400">
              View and manage your vehicles, logs, modifications, and tunes.
            </p>
          </Link>

          <Link
            href="/logs"
            className="bmw-border block rounded-2xl bg-zinc-900 p-8 transition hover:scale-[1.02] hover:border-white"
          >
            <h2 className="mb-2 text-2xl font-semibold">Upload Log</h2>
            <p className="text-zinc-400">
              Quickly upload and analyse a new MHD log file.
            </p>
          </Link>

          <Link
            href="/account"
            className="bmw-border rounded-2xl bg-zinc-900 p-8 transition hover:opacity-90"
          >
            <h2 className="mb-2 text-2xl font-semibold">Account</h2>
            <p className="text-zinc-400">
              Manage your login, subscription, billing, and support options.
            </p>
          </Link>
        </div>



      </div>
    </main>
  );
}
