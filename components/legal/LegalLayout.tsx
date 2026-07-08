import Link from "next/link";

type LegalSection = {
  title: string;
  body: string;
};

type LegalLayoutProps = {
  eyebrow?: string;
  title: string;
  intro: string;
  sections: LegalSection[];
};

export default function LegalLayout({
  eyebrow = "TuneSight Legal",
  title,
  intro,
  sections,
}: LegalLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">
          {eyebrow}
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">{title}</h1>

        <p className="mt-4 text-slate-300">{intro}</p>

        <section className="mt-10 space-y-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-slate-300">{section.body}</p>
            </div>
          ))}
        </section>

        <div className="mt-8">
          <Link
            href="/legal-acceptance"
            className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Back to Legal Review
          </Link>
        </div>
      </div>
    </main>
  );
}