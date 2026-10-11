import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import Link from "next/link";
export default async function CheckoutPage() {
  await requireSubscriberPage();
  return <main className="min-h-screen bg-black px-6 py-16 text-white"><section className="bmw-border mx-auto max-w-xl rounded-2xl bg-zinc-900 p-8">
    <h1 className="mb-4 text-3xl font-bold">Checkout unavailable</h1>
    <p>TuneSight is a controlled, unpaid beta. No payment is collected and no paid plan is activated.</p>
    <button disabled className="my-6 rounded-xl bg-zinc-800 px-5 py-3 text-zinc-400">Payments unavailable</button>
    <Link href="/beta-access" className="block text-blue-300">View beta access</Link>
  </section></main>;
}
