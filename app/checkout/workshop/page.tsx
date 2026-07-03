export default function WorkshopCheckout() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full bmw-border bg-zinc-900 p-8 rounded-2xl">
        <h1 className="text-4xl font-bold mb-4">Workshop Plan</h1>

        <p className="text-zinc-400 mb-8">
          Built for professional tuners, workshops, and performance businesses
          managing multiple customer vehicles. Includes every Pro feature, plus
          unlimited vehicles, customer management, team access, workshop
          workflow, and priority support.
        </p>

        <div className="mb-8">
          <p className="text-zinc-400 text-sm uppercase tracking-wider mb-2">
            Monthly Subscription
          </p>

          <div className="text-5xl font-bold">
            $200
            <span className="text-xl text-zinc-400"> / month</span>
          </div>
        </div>

        <div className="rounded-xl bg-black/40 border border-zinc-800 p-5 mb-8">
          <ul className="space-y-2 text-zinc-300 text-sm">
            <li>✓ Unlimited Vehicles</li>
            <li>✓ Unlimited Log Analyses</li>
            <li>✓ Unlimited Tune Uploads</li>
            <li>✓ Customer Vehicle Management</li>
            <li>✓ Customer Diagnostic History</li>
            <li>✓ Workshop Dashboard</li>
            <li>✓ Team Access</li>
            <li>✓ Priority Support</li>
            <li>✓ Early Access to New Features</li>
          </ul>
        </div>

        <button className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
          Continue to Secure Payment
        </button>
      </div>
    </main>
  );
}