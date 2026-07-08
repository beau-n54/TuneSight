"use client";

import { useRouter } from "next/navigation";

export default function StarterCheckout() {
  const router = useRouter();

  function handleCheckout() {
    // Stripe will replace this later.
    // For the beta, continue through the onboarding flow.
    router.push("/legal-acceptance");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-3xl font-bold mb-4">
          Starter Plan
        </h1>

        <p className="text-zinc-400 mb-6">
          Perfect for individual enthusiasts getting started with TuneSight.
        </p>

        <div className="text-4xl font-bold mb-8">
          $19
          <span className="text-lg text-zinc-400 font-normal"> / month</span>
        </div>

        <button
          onClick={handleCheckout}
          className="w-full rounded-xl bg-white py-4 font-semibold text-black transition hover:opacity-90"
        >
          Continue to Legal Review
        </button>

      </div>
    </main>
  );
}