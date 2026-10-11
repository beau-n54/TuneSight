import Link from "next/link";
import Image from "next/image";

import homepageBanner from "../homepage images/homepage banner.png";

const classicPlatforms = ["N13", "N20", "N54", "N55"];
const modernPlatforms = ["S55", "B58 Gen1", "B58 Gen2", "S58", "S63"];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="bmw-border rounded-3xl overflow-hidden bg-zinc-950 mb-12 shadow-2xl shadow-blue-500/10">
          <Image
            src={homepageBanner}
            alt="TuneSight — Engineering Intelligence for BMW Performance"
            className="w-full h-auto"
            loading="eager"
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

          <div className="bmw-border rounded-2xl bg-zinc-950 p-6 text-center"><p className="text-xl font-semibold">Controlled, unpaid beta</p><p className="mt-3 text-zinc-400">Starter, Pro and Workshop subscriptions are not available for purchase. Access requires beta approval; this page grants no entitlement.</p><Link href="/login" className="mt-5 inline-block underline">Sign in to your beta account</Link></div>
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
