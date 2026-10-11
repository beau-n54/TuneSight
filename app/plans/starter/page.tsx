import Link from "next/link";
export default function PlanPage() {
  return <main className="min-h-screen bg-black px-6 py-16 text-white"><section className="bmw-border mx-auto max-w-3xl space-y-5 rounded-2xl bg-zinc-900 p-8">
    <Link href="/" className="text-zinc-400">Back to TuneSight</Link><h1 className="text-3xl font-bold">Starter — future plan</h1>
    <p>TuneSight is a controlled, unpaid beta. Paid plans, monthly allowances and commercial entitlements are not active. No payment is taken and selecting this page grants no access.</p>
    <button disabled className="rounded border border-zinc-700 px-5 py-3 text-zinc-400">Subscription unavailable during beta</button>
    <p><Link href="/login" className="underline">Sign in with your approved beta account</Link></p>
  </section></main>;
}
