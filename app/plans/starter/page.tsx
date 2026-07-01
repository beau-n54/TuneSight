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
          The Starter Plan is built for individual BMW owners who want a smarter way
          to review MHD logs without needing workshop-level tools. It gives you a clean,
          guided entry into TuneSight and helps turn raw data into something easier to
          understand and act on.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>
          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">Upload and review MHD CSV logs</h3>
              <p className="text-zinc-400 mt-1">
                Upload your MHD log files directly into TuneSight and view them in a
                cleaner, more structured way. Instead of scanning raw CSV data manually,
                you get an easier starting point for understanding how the car behaved
                during the pull or drive.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Single vehicle profile setup</h3>
              <p className="text-zinc-400 mt-1">
                Create one vehicle profile tied to your own car. This allows TuneSight
                to keep your log history, selected engine platform, and basic setup
                information organised in one place.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Basic engine and modification tracking</h3>
              <p className="text-zinc-400 mt-1">
                Record the key details of your setup, such as your engine type, fueling
                configuration, turbo setup, intake, exhaust, intercooler, and other
                supporting modifications. This helps give context to your logs instead of
                treating every file as standalone data.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Core AI-generated summaries</h3>
              <p className="text-zinc-400 mt-1">
                Receive a simple AI-assisted summary of what the log appears to show.
                This is designed to help highlight broad areas of concern or interest,
                making it easier to understand whether a log looks healthy or whether it
                needs a closer look.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Ideal for one personal build</h3>
              <p className="text-zinc-400 mt-1">
                Starter is designed for the owner who wants to monitor and learn from
                their own car. It is not aimed at managing multiple vehicles or a full
                customer workflow.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What You Can Do With Starter</h2>
          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Upload your own logs and keep them stored under one vehicle profile</li>
            <li>Track your car’s basic modification list for better analysis context</li>
            <li>Review AI summaries to get a quick first-pass understanding of the log</li>
            <li>Build confidence reading log data without needing advanced tools straight away</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>
          <p className="text-zinc-300">
            Starter is best for individual enthusiasts, first-time users of log analysis,
            and owners who want a cleaner way to review their own MHD files without
            paying for a larger, more advanced tier they may not need yet.
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