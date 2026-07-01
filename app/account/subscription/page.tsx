import Link from "next/link";

export default function SubscriptionPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Subscription</h1>
        <p className="text-zinc-400 mb-10">
          Manage your TuneSight subscription plan.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-2">Current Plan</h2>
          <p className="text-zinc-400 mb-6">
            Your current subscription plan will be displayed here.
          </p>

          <div className="space-y-4">
            <button className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
              Upgrade Plan
            </button>

            <button className="w-full py-4 rounded-xl bg-zinc-800 text-white font-semibold hover:opacity-80 transition">
              Downgrade Plan
            </button>

            <button className="w-full py-4 rounded-xl bg-red-600 text-white font-semibold hover:opacity-80 transition">
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}