import Link from "next/link";

const classicPlatforms = ["N13", "N20", "N54", "N55"];
const modernPlatforms = ["S55", "B58 Gen1", "B58 Gen2", "S58", "S63"];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="bmw-border rounded-3xl overflow-hidden bg-zinc-950 mb-12 shadow-2xl shadow-blue-500/10">
          <img
            src="/tunesight-banner.jpeg"
            alt="TuneSight BMW diagnostic platform"
            className="w-full h-auto"
          />
        </div>

        <section className="text-center max-w-4xl mx-auto mb-20">
          <p className="text-sm tracking-[0.35em] text-blue-400 uppercase mb-5">
            Advanced BMW Diagnostic Platform
          </p>

          <p className="text-zinc-300 text-xl md:text-2xl font-semibold mb-5">
            Cross-reference logs, tune calibrations, and vehicle setup in one clear diagnostic workflow.
          </p>

          <p className="text-zinc-400 text-lg md:text-xl mb-10">
            TuneSight helps BMW owners, tuners, and workshops uncover smarter
            calibration decisions with clarity, confidence, and speed.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/signup" className="px-7 py-3 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition">
              Get Started
            </Link>
            <Link href="/login" className="px-7 py-3 rounded-xl bg-zinc-900 border border-zinc-700 font-semibold hover:bg-zinc-800 transition">
              Member Login
            </Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            ["Diagnose", "Turn BMW datalogs into clear diagnostic reports that highlight faults, patterns, and likely root causes."],
            ["Cross-Reference", "Compare log behaviour against tune calibrations and vehicle setup to understand what is really driving the issue."],
            ["Decide", "Receive clear diagnostic conclusions and calibration recommendations that help guide the next move."],
          ].map(([title, text]) => (
            <div key={title} className="bmw-border rounded-2xl bg-zinc-950 p-8 min-h-[210px]">
              <h2 className="text-2xl font-semibold mb-4">{title}</h2>
              <p className="text-zinc-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </section>

        <section className="bmw-border rounded-2xl bg-zinc-950/80 p-8 md:p-10 mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why TuneSight?
            </h2>
            <p className="text-zinc-400 max-w-3xl mx-auto">
              Built for BMW diagnostics where logs, tune files, and vehicle setup
              need to be understood together before the next calibration move.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              "Cross-reference logs against tune files",
              "Built specifically for BMW platforms",
              "Diagnose issues with confidence",
              "Understand the cause before changing calibration",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-zinc-800 bg-black/40 p-5 text-sm text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            BMW Platforms Supported
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-10">
            Built specifically around BMW performance platforms, diagnostics, logs,
            tune files, and calibration workflows.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h3 className="text-xl font-semibold mb-4">Classic Platforms</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {classicPlatforms.map((platform) => (
                  <span key={platform} className="rounded-full border border-zinc-700 bg-black px-5 py-2 text-sm text-zinc-300">
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h3 className="text-xl font-semibold mb-4">Modern Platforms</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {modernPlatforms.map((platform) => (
                  <span key={platform} className="rounded-full border border-zinc-700 bg-black px-5 py-2 text-sm text-zinc-300">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Choose Your TuneSight Plan
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              From single-car enthusiasts to professional workshops, TuneSight scales
              with the way you diagnose, tune, and manage BMW platforms.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            <Link href="/plans/starter" className="bmw-border rounded-2xl bg-zinc-950 p-6 hover:scale-[1.02] transition block">
              <h3 className="text-2xl font-semibold mb-3">Starter</h3>
              <p className="text-zinc-400 mb-5">
                For single-vehicle BMW owners who want reliable diagnostic clarity without workshop-level volume.
              </p>
              <p className="text-4xl font-bold mb-6">$19<span className="text-base text-zinc-400">/mo</span></p>
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

            <Link href="/plans/pro" className="bmw-border rounded-2xl bg-zinc-950 p-6 shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition block relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-semibold mb-3">Pro</h3>
              <p className="text-zinc-400 mb-5">
                For active enthusiasts managing up to 3 BMWs with unlimited logs, unlimited tune uploads, and full platform access.
              </p>
              <p className="text-4xl font-bold mb-6">$49<span className="text-base text-zinc-400">/mo</span></p>
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
                <li>All Future Platform Updates</li>
              </ul>
            </Link>

            <Link href="/plans/workshop" className="bmw-border rounded-2xl bg-zinc-950 p-6 hover:scale-[1.02] transition block">
              <h3 className="text-2xl font-semibold mb-3">Workshop</h3>
              <p className="text-zinc-400 mb-5">
                Professional diagnostics for tuners, workshops, and performance businesses managing customer vehicles at scale.
              </p>
              <p className="text-4xl font-bold mb-6">$200<span className="text-base text-zinc-400">/mo</span></p>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li>Includes every Pro feature, plus:</li>
                <li>Unlimited Vehicles</li>
                <li>Unlimited Log Analyses</li>
                <li>Unlimited Tune Uploads</li>
                <li>Full TuneSight Diagnostic Platform</li>
                <li>Complete Cross-Reference Analysis</li>
                <li>Calibration Recommendations</li>
                <li>Vehicle Setup Intelligence</li>
                <li>Complete Analysis History</li>
                <li>Customer Vehicle Management</li>
                <li>Customer Diagnostic History</li>
                <li>Workshop Dashboard</li>
                <li>Customer Tune Archive</li>
                <li>Team Access</li>
                <li>Priority Support</li>
                <li>Early Access to New Features</li>
                <li>All Future Platform Updates</li>
              </ul>
            </Link>
          </div>
        </section>

        <section className="bmw-border rounded-2xl bg-zinc-950/80 p-8 md:p-10 mb-16 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Every decision begins with better data.
          </h2>
          <p className="text-zinc-400 max-w-3xl mx-auto">
            TuneSight turns BMW log data, tune files, and vehicle setup into
            diagnostic confidence before the next calibration change.
          </p>
        </section>

        <footer className="border-t border-zinc-800 pt-8 text-sm text-zinc-500 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} TuneSight. Beta platform.</p>
          <div className="flex gap-5 flex-wrap">
            <Link href="/support" className="hover:text-white transition">Support</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms & Conditions</Link>
            <Link href="/legal" className="hover:text-white transition">Legal Disclaimer</Link>
            <Link href="/login" className="hover:text-white transition">Login</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}