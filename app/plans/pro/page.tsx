import Link from "next/link";

export default function ProPlanPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-400 hover:text-white transition">
          ← Back to Home
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Pro Plan</h1>

        <p className="text-zinc-400 text-lg mb-8">
          Pro is built for active BMW enthusiasts managing up to 3 vehicles with
          unlimited log analyses, unlimited tune uploads, and full access to the
          TuneSight diagnostic platform. It is designed for users who are
          regularly reviewing logs, comparing tune revisions, and refining
          vehicle setup.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>

          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">Up to 3 vehicle profiles</h3>
              <p className="text-zinc-400 mt-1">
                Manage up to 3 BMWs inside one account, including engine
                platform, modifications, uploaded logs, tune files, and setup
                details for each vehicle.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Unlimited log analyses</h3>
              <p className="text-zinc-400 mt-1">
                Analyse as many logs as needed for repeated testing, revision
                checks, setup comparisons, and ongoing diagnostic review.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Unlimited tune uploads</h3>
              <p className="text-zinc-400 mt-1">
                Upload tune files without monthly limits so each revision can be
                reviewed alongside the logs and vehicle setup it belongs to.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Complete cross-reference analysis
              </h3>
              <p className="text-zinc-400 mt-1">
                Compare log behaviour against tune calibrations and vehicle
                setup to understand what is really driving the issue.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Calibration recommendations
              </h3>
              <p className="text-zinc-400 mt-1">
                Receive clear diagnostic direction that helps identify what
                calibration area should be reviewed before making the next
                change.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Complete analysis history
              </h3>
              <p className="text-zinc-400 mt-1">
                Keep logs, tune files, diagnostic reports, and vehicle setup
                history organised so you can track how the build changes over
                time.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Priority support and future updates
              </h3>
              <p className="text-zinc-400 mt-1">
                Get priority support and access to all future TuneSight platform
                updates as new diagnostic features are released.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What You Can Do With Pro</h2>

          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Manage up to 3 BMW vehicles</li>
            <li>Analyse unlimited logs</li>
            <li>Upload unlimited tune files</li>
            <li>Compare tune revisions against real log behaviour</li>
            <li>Track vehicle setup and modification changes</li>
            <li>Review diagnostic reports with clear supporting evidence</li>
            <li>Build a cleaner workflow for active tuning and revision checks</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>

          <p className="text-zinc-300">
            Pro is best for active BMW enthusiasts, serious single-user tuners,
            and owners managing multiple vehicles who need unlimited analysis,
            tune upload freedom, and full access to the TuneSight diagnostic
            platform.
          </p>
        </div>

        <a
          href="/checkout/pro"
          className="px-8 py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition"
        >
          Continue to Payment
        </a>
      </div>
    </main>
  );
}