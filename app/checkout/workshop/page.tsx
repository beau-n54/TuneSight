"use client";

import { useRouter } from "next/navigation";

export default function WorkshopCheckout() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.push("/")}
          className="mb-8 text-sm text-zinc-300 transition hover:text-white"
        >
          ← Back to Home
        </button>

        <h1 className="mb-4 text-5xl font-bold">Workshop Plan</h1>

        <p className="mb-10 max-w-4xl text-lg leading-8 text-zinc-300">
          Workshop is built for professional tuners, workshops, and performance
          businesses managing customer vehicles at scale with unlimited log
          analyses, unlimited tune uploads, customer history, team access, and
          full access to the TuneSight diagnostic platform.
        </p>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900/80 p-8">
          <h2 className="mb-6 text-3xl font-bold">What's Included</h2>

          <ul className="space-y-4 text-zinc-200">
            <li>• Unlimited customer vehicle profiles</li>
            <li>• Unlimited log analyses</li>
            <li>• Unlimited tune uploads</li>
            <li>• Full TuneSight diagnostic platform</li>
            <li>• Complete cross-reference analysis</li>
            <li>• Calibration recommendations</li>
            <li>• Vehicle setup intelligence</li>
            <li>• Complete customer analysis history</li>
            <li>• Workshop dashboard</li>
            <li>• Team access</li>
            <li>• Priority support and future updates</li>
          </ul>
        </section>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900/80 p-8">
          <h2 className="mb-6 text-3xl font-bold">
            What You Can Do With Workshop
          </h2>

          <ul className="space-y-4 text-zinc-200">
            <li>• Manage unlimited BMW customer vehicles</li>
            <li>• Analyse unlimited customer logs</li>
            <li>• Upload unlimited customer tune files</li>
            <li>• Compare tune revisions against real log behaviour</li>
            <li>• Track customer vehicle setups and modification changes</li>
            <li>• Review diagnostic reports with clear supporting evidence</li>
            <li>• Build a cleaner workflow for workshop diagnostics</li>
            <li>• Keep customer diagnostic history in one place</li>
            <li>• Give your team access to the same diagnostic system</li>
          </ul>
        </section>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900/80 p-8">
          <h2 className="mb-6 text-3xl font-bold">Best For</h2>

          <p className="text-lg leading-8 text-zinc-300">
            Workshop is best for professional BMW tuners, performance workshops,
            dyno shops, and tuning businesses that need unlimited customer
            vehicle management, team access, workshop-level diagnostics, and a
            complete history for every customer vehicle.
          </p>
        </section>

        <section className="bmw-border mb-10 rounded-2xl bg-zinc-900/80 p-8">
          <h2 className="mb-4 text-3xl font-bold">Workshop Subscription</h2>

          <div className="text-5xl font-bold">
            $200
            <span className="text-2xl text-zinc-400">/mo</span>
          </div>
        </section>

        <button
          onClick={() => router.push("/legal-acceptance")}
          className="rounded-xl bg-white px-8 py-4 font-semibold text-black transition hover:opacity-80"
        >
          Continue to Legal Review
        </button>
      </div>
    </main>
  );
}