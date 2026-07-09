"use client";

import { useRouter } from "next/navigation";

export default function ProCheckout() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full bmw-border bg-zinc-900 p-8 rounded-2xl">
        <h1 className="text-4xl font-bold mb-4">Pro Plan</h1>

        <p className="text-zinc-400 mb-8">
          Built for active BMW enthusiasts managing up to 3 vehicles with
          unlimited log analyses, unlimited tune uploads, and full access to the
          TuneSight diagnostic platform.
        </p>

        <div className="mb-8">
          <p className="text-zinc-400 text-sm uppercase tracking-wider mb-2">
            Monthly Subscription
          </p>

          <div className="text-5xl font-bold">
            $49
            <span className="text-xl text-zinc-400"> / month</span>
          </div>
        </div>

        <div className="rounded-xl bg-black/40 border border-zinc-800 p-5 mb-8">
          <ul className="space-y-2 text-zinc-300 text-sm">
            <li>✓ Up to 3 Vehicles</li>
            <li>✓ Unlimited Log Analyses</li>
            <li>✓ Unlimited Tune Uploads</li>
            <li>✓ Full TuneSight Diagnostic Platform</li>
            <li>✓ Complete Cross-Reference Analysis</li>
            <li>✓ Calibration Recommendations</li>
            <li>✓ Vehicle Setup Intelligence</li>
            <li>✓ Complete Analysis History</li>
            <li>✓ Priority Support</li>
            <li>✓ All Future Platform Updates</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => router.push("/legal-acceptance")}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition"
        >
          Continue to Legal Review
        </button>
      </div>
    </main>
  );
}