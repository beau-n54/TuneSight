import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import Link from "next/link";

export default async function SubscriptionPage() {
  await requireSubscriberPage();
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Subscription</h1>
        <p className="text-zinc-400 mb-10">
          TuneSight is a controlled, unpaid beta. Paid plans and subscription changes are unavailable.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-2">Current Plan</h2>
          <p className="text-zinc-400 mb-6">
            Beta approval is managed by TuneSight. Plan labels do not grant paid capabilities.
          </p>

          <div className="space-y-4">
            <button disabled className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
              Upgrade Plan
            </button>

            <button disabled className="w-full py-4 rounded-xl bg-zinc-800 text-white font-semibold hover:opacity-80 transition">
              Downgrade Plan
            </button>

            <button disabled className="w-full py-4 rounded-xl bg-red-600 text-white font-semibold hover:opacity-80 transition">
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
