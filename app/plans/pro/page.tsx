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
          The Pro Plan is built for serious enthusiasts, remote tuners, and users
          running repeated revisions of the same setup. It is designed for people who
          need deeper visibility into how the car, the tune, and the logs relate to
          each other over time.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What’s Included</h2>
          <div className="space-y-5 text-zinc-300">
            <div>
              <h3 className="font-semibold text-white">Unlimited MHD CSV log uploads</h3>
              <p className="text-zinc-400 mt-1">
                Upload as many logs as needed for repeated testing, revision checks,
                and setup comparisons without running into basic usage limits.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Multiple vehicle profiles</h3>
              <p className="text-zinc-400 mt-1">
                Manage more than one vehicle inside the same account, which is ideal
                for users with multiple cars or separate street and track setups.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Tune file / map upload support</h3>
              <p className="text-zinc-400 mt-1">
                Upload tune or map revision files alongside your logs so TuneSight can
                help you keep track of what revision was on the car when the log was
                taken. This creates a much clearer relationship between the file being
                flashed and the behavior shown in the log.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Cross-reference tune files with logs</h3>
              <p className="text-zinc-400 mt-1">
                Compare uploaded tune revisions against uploaded logs so you can see
                which map version produced which behavior. This is especially useful
                when trying to confirm whether a change in the tune improved boost
                control, timing behavior, fueling, or general drivability.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">Deeper AI-assisted analysis</h3>
              <p className="text-zinc-400 mt-1">
                Receive stronger AI interpretation of the log data with more focus on
                trend recognition, repeated behavior, and setup-specific context rather
                than a simple first-pass summary.
              </p>
            </div>
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What You Can Do With Pro</h2>
          <ul className="space-y-3 text-zinc-300 list-disc pl-5">
            <li>Upload unlimited logs for repeated tune revisions</li>
            <li>Store and organise multiple cars or setups</li>
            <li>Upload the tune/map file used for each revision cycle</li>
            <li>Cross-reference a tune revision against the logs produced from it</li>
            <li>Build a more complete picture of how hardware, tune, and fuel interact</li>
          </ul>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">Best For</h2>
          <p className="text-zinc-300">
            Pro is best for serious users who want more than basic log review. It is
            ideal when you are actively tuning, comparing revisions, or trying to keep
            your tune files and log results tied together in a cleaner workflow.
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