export default function ProCheckout() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full bmw-border bg-zinc-900 p-8 rounded-2xl">
        
        <h1 className="text-3xl font-bold mb-4">Pro Plan</h1>
        <p className="text-zinc-400 mb-6">
          Built for serious users running multiple logs, setups, and tune revisions.
        </p>

        <div className="text-4xl font-bold mb-6">$49/mo</div>

        <button className="w-full py-3 rounded-xl bg-white text-black font-semibold">
          Pay Now
        </button>

      </div>
    </main>
  );
}