import Link from "next/link";

export default function StarterPlanPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-zinc-400 transition hover:text-white">
          ← Back to Home
        </Link>

        <h1 className="mt-8 mb-4 text-5xl font-bold">Starter Plan</h1>

        <p className="mb-8 text-lg text-zinc-400">
          Starter is built for single-vehicle BMW owners who want reliable
          diagnostic clarity without workshop-level volume. It gives you a clean
          way to analyse your own logs, upload tune files, track your vehicle
          setup, and understand what the data is pointing toward.
        </p>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">What's Included</h2>

          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">1 vehicle profile</h3>
              <p className="mt-1 text-zinc-400">
                Keep one BMW organised inside TuneSight with its engine
                platform, modifications, uploaded logs, tune files and setup
                details stored together.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                10 log analyses per month
              </h3>
              <p className="mt-1 text-zinc-400">
                Upload and analyse up to 10 vehicle logs each month covering
                boost, fuel pressure, ignition timing, throttle behaviour and
                more.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                5 tune uploads per month
              </h3>
              <p className="mt-1 text-zinc-400">
                Upload calibration files so TuneSight can compare tune changes
                against real-world log behaviour.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Complete diagnostic reports
              </h3>
              <p className="mt-1 text-zinc-400">
                Receive structured reports showing evidence, confidence,
                rejected causes and recommended diagnostic direction.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Log & Tune Cross Reference
              </h3>
              <p className="mt-1 text-zinc-400">
                Compare tune calibrations directly against log behaviour and
                vehicle setup instead of reviewing each independently.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Root Cause Identification
              </h3>
              <p className="mt-1 text-zinc-400">
                Let TuneSight narrow down the most likely cause before changing
                hardware or calibration.
              </p>
            </div>
          </div>
        </section>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">
            What You Can Do With Starter
          </h2>

          <ul className="list-disc space-y-3 pl-5 text-zinc-300">
            <li>Manage one personal BMW build</li>
            <li>Analyse up to 10 logs each month</li>
            <li>Upload up to 5 tune files each month</li>
            <li>Track vehicle setup and modifications</li>
            <li>Review structured diagnostic reports</li>
            <li>Make smarter calibration decisions</li>
          </ul>
        </section>

        <section className="bmw-border mb-10 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">Best For</h2>

          <p className="text-zinc-300">
            Starter is ideal for BMW enthusiasts, single-vehicle owners and
            first-time TuneSight users who want professional diagnostics without
            needing multi-vehicle or workshop features.
          </p>
        </section>

        <Link
          href="/legal-acceptance"
          className="inline-flex rounded-xl bg-white px-8 py-4 font-semibold text-black transition hover:opacity-80"
        >
          Continue to Legal Review
        </Link>
      </div>
    </main>
  );
}