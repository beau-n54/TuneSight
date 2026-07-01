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
          The Workshop Plan is built for tuners, performance shops, and businesses
          managing multiple customer vehicles. It is designed for environments where
          customer records, tune revisions, uploaded logs, and team access all need to
          work together in one organised system.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>
          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">Team and staff access</h3>
              <p className="text-zinc-400 mt-1">
                Give workshop staff and team members access to the same system so
                customer vehicles, uploaded files, and analysis history can be managed
                collaboratively.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Customer vehicle management</h3>
              <p className="text-zinc-400 mt-1">
                Organise multiple customer cars in one workspace, with each build tied
                to its own modifications, uploaded logs, and tune revisions.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Unlimited log and tune file uploads</h3>
              <p className="text-zinc-400 mt-1">
                Upload as many logs and tune files as needed across customer jobs
                without worrying about plan limits getting in the way of workshop flow.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Cross-reference tune revisions with customer logs</h3>
              <p className="text-zinc-400 mt-1">
                Keep tune files and logs linked to the correct customer vehicle and
                revision cycle. This makes it much easier to see which calibration file
                was associated with which results, rather than relying on scattered file
                names and memory.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Priority analysis tools</h3>
              <p className="text-zinc-400 mt-1">
                Use TuneSight as a true workshop workflow tool, helping your business
                review logs faster, organise files better, and reduce time wasted
                manually sorting through revisions and customer data.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What You Can Do With Workshop</h2>
          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Manage many customer vehicles in one central workspace</li>
            <li>Store and organise tune files alongside the matching logs</li>
            <li>Track revision history more clearly across customer jobs</li>
            <li>Support a team workflow inside the same platform</li>
            <li>Use TuneSight as a real business tool rather than a personal-use app</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>
          <p className="text-zinc-300">
            Workshop is best for tuners and businesses that need more than one-user log
            review. It is the right fit when customer files, tune revisions, uploaded
            logs, and staff workflows all need to stay organised and connected.
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