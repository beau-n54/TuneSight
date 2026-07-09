import Link from "next/link";

export default function WorkshopPlanPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-8 inline-flex text-sm text-zinc-300 transition hover:text-white"
        >
          ← Back to Home
        </Link>

        <h1 className="mb-4 text-5xl font-bold">Workshop Plan</h1>

        <p className="mb-10 max-w-4xl text-lg leading-8 text-zinc-300">
          Workshop is built for professional tuners, workshops, and performance
          businesses managing customer vehicles at scale. Includes every Pro
          feature plus unlimited vehicles, customer management, workshop
          workflow, team access, and priority support.
        </p>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-6 text-2xl font-semibold">What's Included</h2>

          <ul className="space-y-3 text-zinc-300">
            <li>• Unlimited customer vehicle profiles</li>
            <li>• Unlimited log analyses</li>
            <li>• Unlimited tune uploads</li>
            <li>• Full TuneSight diagnostic platform</li>
            <li>• Complete cross-reference analysis</li>
            <li>• Calibration recommendations</li>
            <li>• Vehicle setup intelligence</li>
            <li>• Customer vehicle management</li>
            <li>• Customer diagnostic history</li>
            <li>• Workshop dashboard</li>
            <li>• Customer tune archive</li>
            <li>• Team access</li>
            <li>• Priority support</li>
            <li>• Early access to new features</li>
          </ul>
        </section>

        <section className="bmw-border mb-8 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-6 text-2xl font-semibold">
            What You Can Do With Workshop
          </h2>

          <ul className="space-y-3 text-zinc-300">
            <li>• Manage unlimited BMW customer vehicles</li>
            <li>• Analyse unlimited customer logs</li>
            <li>• Upload unlimited customer tune files</li>
            <li>• Compare tune revisions against real log behaviour</li>
            <li>• Track customer vehicle setup and modification changes</li>
            <li>• Review diagnostic reports with clear supporting evidence</li>
            <li>• Build a cleaner workflow for workshop diagnostics</li>
            <li>• Give your team access to the same diagnostic system</li>
          </ul>
        </section>

        <section className="bmw-border mb-10 rounded-2xl bg-zinc-900 p-8">
          <h2 className="mb-4 text-2xl font-semibold">Best For</h2>

          <p className="text-zinc-300">
            Workshop is best for BMW tuners, performance workshops, dyno shops,
            and businesses managing multiple customer vehicles who need
            unlimited analysis, customer history, team access, and full
            workshop-level diagnostic capability.
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