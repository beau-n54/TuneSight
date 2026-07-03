import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight mb-6">
            TuneSight
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-10">
            Advanced BMW diagnostic platform that analyses vehicle logs alongside
            tune calibrations and vehicle setup to uncover smarter calibration
            decisions with clarity, confidence, and speed.
          </p>

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

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/plans/starter"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Starter</h2>

            <p className="text-zinc-400 mb-4">
              For single-vehicle BMW owners who want reliable diagnostic clarity
              without workshop-level volume.
            </p>

            <p className="text-3xl font-bold mb-6">
              $19<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>1 Vehicle</li>
              <li>10 Log Analyses / Month</li>
              <li>5 Tune Uploads / Month</li>
              <li>Complete Diagnostic Reports</li>
              <li>Log & Tune Cross-Reference</li>
              <li>Root Cause Identification</li>
              <li>Vehicle Setup Profile</li>
              <li>Software Updates</li>
            </ul>
          </Link>

          <Link
            href="/plans/pro"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition block relative"
          >
            <div className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white mb-3">
              MOST POPULAR
            </div>

            <h2 className="text-2xl font-semibold mb-2">Pro</h2>

            <p className="text-zinc-400 mb-4">
              For active enthusiasts managing up to 3 BMWs with unlimited logs,
              unlimited tune uploads, and full platform access.
            </p>

            <p className="text-3xl font-bold mb-6">
              $49<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Up to 3 Vehicles</li>
              <li>Unlimited Log Analyses</li>
              <li>Unlimited Tune Uploads</li>
              <li>Full TuneSight Diagnostic Platform</li>
              <li>Complete Cross-Reference Analysis</li>
              <li>Calibration Recommendations</li>
              <li>Vehicle Setup Intelligence</li>
              <li>Complete Analysis History</li>
              <li>Priority Support</li>
              <li>Access to Future Features</li>
            </ul>
          </Link>

          <Link
            href="/plans/workshop"
            className="bmw-border rounded-2xl bg-zinc-900 p-6 hover:border-white hover:scale-[1.02] transition block"
          >
            <h2 className="text-2xl font-semibold mb-2">Workshop</h2>

            <p className="text-zinc-400 mb-4">
              For tuners, workshops, and performance businesses managing
              customer vehicles at scale.
            </p>

            <p className="text-3xl font-bold mb-6">
              $200<span className="text-base text-zinc-400">/mo</span>
            </p>

            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Unlimited Vehicles</li>
              <li>Unlimited Log Analyses</li>
              <li>Unlimited Tune Uploads</li>
              <li>Customer Vehicle Management</li>
              <li>Customer Diagnostic History</li>
              <li>Workshop Dashboard</li>
              <li>Team Access</li>
              <li>Priority Support</li>
              <li>Early Access to New Features</li>
            </ul>
          </Link>
        </div>
      </section>
    </main>
  );
}