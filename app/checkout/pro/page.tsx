export default function StarterCheckout() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full bmw-border bg-zinc-900 p-8 rounded-2xl">
        <h1 className="text-4xl font-bold mb-4">Starter Plan</h1>

        <p className="text-zinc-400 mb-8">
          Built for individual BMW owners who want professional diagnostics for
          a single vehicle. Starter gives you everything needed to understand
          your logs, compare tune files, and build confidence before making
          calibration changes.
        </p>

        <div className="mb-8">
          <p className="text-zinc-400 text-sm uppercase tracking-wider mb-2">
            Monthly Subscription
          </p>

          <div className="text-5xl font-bold">
            $19
            <span className="text-xl text-zinc-400"> / month</span>
          </div>
        </div>

        <div className="rounded-xl bg-black/40 border border-zinc-800 p-5 mb-8">
          <ul className="space-y-2 text-zinc-300 text-sm">
            <li>✓ 1 Vehicle</li>
            <li>✓ 10 Log Analyses Per Month</li>
            <li>✓ 5 Tune Uploads Per Month</li>
            <li>✓ Complete Diagnostic Reports</li>
            <li>✓ Log & Tune Cross-Reference</li>
            <li>✓ Root Cause Identification</li>
            <li>✓ Vehicle Setup Profile</li>
            <li>✓ Software Updates</li>
          </ul>
        </div>

        <button className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
          Continue to Secure Payment
        </button>
      </div>
    </main>
  );
}