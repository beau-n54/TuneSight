import Link from "next/link";

export default function LogsPage() {
  return <main className="min-h-screen bg-black px-6 py-16 text-white"><section className="bmw-border mx-auto max-w-3xl rounded-2xl bg-zinc-900 p-8">
    <h1 className="text-3xl font-bold">Vehicle Log Analysis</h1>
    <p className="mt-4 text-zinc-300">Select your owned vehicle in Garage, then open Logs to upload supported CSV evidence. Analysis needs the vehicle context and qualified units.</p>
    <p className="mt-3 text-sm text-amber-200">The former browser-only analyser is unavailable because it could label a log healthy without qualified vehicle or channel evidence. No local file is analysed on this page.</p>
    <Link href="/garage" className="mt-6 inline-block rounded-xl border border-blue-400 px-5 py-3">Choose vehicle in Garage</Link>
  </section></main>;
}
