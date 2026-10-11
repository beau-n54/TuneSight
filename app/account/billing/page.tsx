import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import Link from "next/link";

export default async function BillingPage() {
  await requireSubscriberPage();
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Billing</h1>
        <p className="text-zinc-400 mb-10">
          TuneSight is a controlled, unpaid beta. No payment is collected.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
          <p className="text-zinc-400 mb-6">
            Billing and payment history are unavailable. No payment has been processed by these controls.
          </p>

          <button disabled className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
            View Payment History
          </button>
        </div>
      </div>
    </main>
  );
}
