import Link from "next/link";

export default function StarterPlanPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-400 hover:text-white transition">
          ← Back to Home
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Starter Plan</h1>

        <p className="text-zinc-400 text-lg mb-8">
          Starter is built for single-vehicle BMW owners who want reliable
          diagnostic clarity without workshop-level volume. It gives you a
          clean way to analyse your own logs, upload tune files, track your
          vehicle setup, and understand what the data is pointing toward.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>

          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">1 vehicle profile</h3>
              <p className="text-zinc-400 mt-1">
                Keep one BMW organised inside TuneSight with its engine
                platform, modifications, uploaded logs, tune files, and setup
                details stored in one place.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                10 log analyses per month
              </h3>
              <p className="text-zinc-400 mt-1">
                Upload and analyse up to 10 vehicle logs each month to review
                boost control, fuel pressure, timing behaviour, throttle
                activity, and other key diagnostic areas.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                5 tune uploads per month
              </h3>
              <p className="text-zinc-400 mt-1">
                Upload tune files so TuneSight can compare calibration changes
                against log behaviour and vehicle setup.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Complete diagnostic reports
              </h3>
              <p className="text-zinc-400 mt-1">
                Receive structured reports that highlight likely issues,
                supporting evidence, rejected causes, and diagnostic direction.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Log and tune cross-reference
              </h3>
              <p className="text-zinc-400 mt-1">
                Review how log behaviour lines up with tune calibrations and
                vehicle setup instead of treating each file as isolated data.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Root cause identification
              </h3>
              <p className="text-zinc-400 mt-1">
                Use TuneSight to narrow down the most likely cause of a problem
                before making unnecessary calibration or hardware changes.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            What You Can Do With Starter
          </h2>

          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Manage one personal BMW build</li>
            <li>Analyse up to 10 logs per month</li>
            <li>Upload up to 5 tune files per month</li>
            <li>Track your vehicle setup and modification details</li>
            <li>Review diagnostic reports with clear evidence</li>
            <li>Understand the likely cause before changing calibration</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>

          <p className="text-zinc-300">
            Starter is best for individual BMW enthusiasts, single-car owners,
            and first-time TuneSight users who want a professional way to review
            their own logs and tune files without needing multi-vehicle or
            workshop-level volume.
          </p>
        </div>

        <a
          href="/checkout/starter"
          className="px-8 py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition"
        >
          Continue to Payment
        </a>
      </div>
    </main>
  );
}