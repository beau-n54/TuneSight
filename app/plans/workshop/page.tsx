import Link from "next/link";

export default function WorkshopPlanPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-400 hover:text-white transition">
          ← Back to Home
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Workshop Plan</h1>

        <p className="text-zinc-400 text-lg mb-8">
          Workshop is built for tuners, performance shops, and businesses
          managing customer vehicles at scale. It includes every Pro feature,
          plus unlimited vehicles, customer management tools, team access, and a
          dedicated workflow for organising logs, tune files, revisions, and
          diagnostic history across multiple customer builds.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>

          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">
                Includes every Pro feature
              </h3>
              <p className="text-zinc-400 mt-1">
                Workshop includes full platform access, unlimited log analyses,
                unlimited tune uploads, cross-reference diagnostics, calibration
                recommendations, vehicle setup intelligence, analysis history,
                priority support, and future platform updates.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Unlimited vehicles</h3>
              <p className="text-zinc-400 mt-1">
                Manage unlimited customer vehicles inside TuneSight without
                being restricted by vehicle count.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Customer vehicle management
              </h3>
              <p className="text-zinc-400 mt-1">
                Organise customer cars in one workspace, with each build tied to
                its own modifications, uploaded logs, tune files, and revision
                history.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Customer diagnostic history
              </h3>
              <p className="text-zinc-400 mt-1">
                Keep diagnostic reports, log reviews, tune comparisons, and
                vehicle setup records connected to each customer vehicle.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Workshop dashboard</h3>
              <p className="text-zinc-400 mt-1">
                Use TuneSight as a central workspace for reviewing customer
                vehicles, uploaded files, diagnostic reports, tune revisions,
                and active workflow.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Customer tune archive</h3>
              <p className="text-zinc-400 mt-1">
                Keep tune files organised by customer, vehicle, and revision so
                the right file can be matched to the right log and diagnostic
                result.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Team access</h3>
              <p className="text-zinc-400 mt-1">
                Give workshop staff access to the same platform so customer
                vehicles, uploaded files, and analysis history can be managed in
                one shared system.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Priority support and early feature access
              </h3>
              <p className="text-zinc-400 mt-1">
                Workshop users receive priority support and early access to new
                TuneSight platform features as they are released.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            What You Can Do With Workshop
          </h2>

          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Manage unlimited customer vehicles</li>
            <li>Analyse unlimited logs</li>
            <li>Upload unlimited tune files</li>
            <li>Store customer vehicles, logs, and tune revisions together</li>
            <li>Track diagnostic history across customer builds</li>
            <li>Give team members access to a shared workshop workflow</li>
            <li>Use TuneSight as a professional business tool, not just a personal log viewer</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>

          <p className="text-zinc-300">
            Workshop is best for tuners, performance businesses, and workshops
            that need to manage multiple customer vehicles, uploaded logs, tune
            revisions, diagnostic reports, and team workflows inside one
            organised platform.
          </p>
        </div>

        <a
          href="/checkout/workshop"
          className="px-8 py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition"
        >
          Continue to Payment
        </a>
      </div>
    </main>
  );
}