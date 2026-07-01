import Link from "next/link";

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Billing</h1>
        <p className="text-zinc-400 mb-10">
          View invoices, payment details, and billing history.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
          <p className="text-zinc-400 mb-6">
            Your billing history and payment details will appear here once payment is connected.
          </p>

          <button className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
            View Payment History
          </button>
        </div>
      </div>
    </main>
  );
}