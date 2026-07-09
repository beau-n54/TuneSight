import Link from "next/link";

export default function ProPlanPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-zinc-400 transition hover:text-white">
          ← Back to Home
        </Link>

        <h1 className="mt-8 mb-4 text-5xl font-bold">Pro Plan</h1>

        <p className="mb-8 text-lg text-zinc-400">
          Pro is built for active BMW enthusiasts managing up to 3 vehicles with
          unlimited log analyses, unlimited tune uploads, and full access to the
          TuneSight diagnostic platform.
        </p>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">What&apos;s Included</h2>

          <ul className="list-disc space-y-3 pl-5 text-zinc-300">
            <li>Up to 3 vehicle profiles</li>
            <li>Unlimited log analyses</li>
            <li>Unlimited tune uploads</li>
            <li>Complete cross-reference analysis</li>
            <li>Calibration recommendations</li>
            <li>Complete analysis history</li>
            <li>Priority support and future updates</li>
          </ul>
        </section>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">
            What You Can Do With Pro
          </h2>

          <ul className="list-disc space-y-3 pl-5 text-zinc-300">
            <li>Manage up to 3 BMW vehicles</li>
            <li>Analyse unlimited logs</li>
            <li>Upload unlimited tune files</li>
            <li>Compare tune revisions against real log behaviour</li>
            <li>Track vehicle setup and modification changes</li>
            <li>Review diagnostic reports with clear supporting evidence</li>
            <li>Build a cleaner workflow for active tuning and revision checks</li>
          </ul>
        </section>

        <section className="bmw-border mb-10 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">Best For</h2>

          <p className="text-zinc-300">
            Pro is best for active BMW enthusiasts, serious single-user tuners,
            and owners managing multiple vehicles who need unlimited analysis,
            tune upload freedom, and full access to the TuneSight diagnostic
            platform.
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