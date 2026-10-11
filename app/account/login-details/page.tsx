import Link from "next/link";
import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";

export default async function LoginDetailsPage() {
  await requireSubscriberPage();
  return <main className="min-h-screen bg-black px-6 py-16 text-white"><div className="mx-auto max-w-3xl">
    <Link href="/account" className="text-zinc-400 hover:text-white">← Back to Account</Link>
    <h1 className="my-8 text-4xl font-bold">Login Details</h1>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-8">
      <p>Email changes are not available in TuneSight beta. Contact TuneSight support for account assistance.</p>
      <button disabled className="my-6 rounded-xl bg-zinc-800 px-5 py-3 text-zinc-400">Change email — unavailable</button>
      <p className="mb-6 text-zinc-300">To change your password, open Login, enter your registered email and select Forgot Password. Follow the recovery link in your email.</p>
      <Link href="/login" className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black">Open password recovery</Link>
    </section>
  </div></main>;
}
