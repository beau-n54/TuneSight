import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        
        {/* HEADER */}
        <div className="flex flex-col items-center text-center">
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight mb-6">
            TuneSight
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-10">
           Advanced BMW diagnostic platform that analyses vehicle logs alongside tune calibrations
           and vehicle setup to uncover smarter calibration decisions with clarity, confidence,
           and speed.
          </p>

          {/* LOGIN / SIGNUP BUTTONS */}
          <div className="flex gap-4 mb-16 flex-wrap justify-center">
            <a
              href="/login"
              className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-80 transition"
            >
              Member Login
            </a>

            <a
              href="/signup"
              className="px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 font-medium hover:bg-zinc-700 transition"
            >
              Sign Up
            </a>
          </div>
        </div>

        {/* PLANS */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* STARTER */}
          <Link
            href="/plans/starter"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Starter</h2>
            <p className="text-zinc-400 mb-4">
              Perfect for individual enthusiasts getting started.
            </p>

            <p className="text-3xl font-bold mb-6">
              $19<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Basic log uploads</li>
              <li>Single vehicle profile</li>
              <li>Core AI insight summaries</li>
            </ul>
          </Link>

          {/* PRO */}
          <Link
            href="/plans/pro"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Pro</h2>
            <p className="text-zinc-400 mb-4">
              Built for serious users running multiple revisions and setups.
            </p>

            <p className="text-3xl font-bold mb-6">
              $49<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Unlimited log uploads</li>
              <li>Multiple vehicle profiles</li>
              <li>Upload tune files + cross-reference logs</li>
            </ul>
          </Link>

          {/* WORKSHOP */}
          <Link
            href="/plans/workshop"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Workshop</h2>
            <p className="text-zinc-400 mb-4">
              For tuners and shops managing multiple customer vehicles.
            </p>

            <p className="text-3xl font-bold mb-6">
              $99<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Team access</li>
              <li>Customer vehicle management</li>
              <li>Logs + tune file revision workflow</li>
            </ul>
          </Link>

        </div>
      </section>
    </main>
  );
}