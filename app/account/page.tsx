import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white transition">
          ← Back to Dashboard
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Account</h1>
        <p className="text-zinc-400 mb-10">
          Manage your TuneSight account, subscription, billing, and support options.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Email & Password</h2>
            <p className="text-zinc-400 mb-6">
              Update your login email and password details.
            </p>

            <Link
              href="/account/login-details"
              className="block w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition text-center"
            >
              Manage Login Details
            </Link>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Subscription</h2>
            <p className="text-zinc-400 mb-6">
              View your current plan, upgrade, downgrade, or cancel.
            </p>

            <Link
              href="/account/subscription"
              className="block w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition text-center"
            >
              Manage Subscription
            </Link>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Billing</h2>
            <p className="text-zinc-400 mb-6">
              View invoices, payment details, and billing history.
            </p>

            <Link
              href="/account/billing"
              className="block w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition text-center"
            >
              View Billing
            </Link>
          </div>

          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-2">Help & Support</h2>
            <p className="text-zinc-400 mb-6">
              Get help with TuneSight, troubleshooting, and account support.
            </p>

            <Link
              href="/account/support"
              className="block w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition text-center"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}