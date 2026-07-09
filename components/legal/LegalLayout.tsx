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
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">
          {eyebrow}
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">
          {title}
        </h1>

        <p className="mt-4 text-zinc-300 leading-8">
          {intro}
        </p>

        <section className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-2xl font-semibold text-white">
                  {section.title}
                </h2>

                <p className="mt-3 leading-8 text-zinc-300">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10">
          <Link
            href="/legal-acceptance"
            className="inline-flex rounded-xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-600"
          >
            Back to Legal Review
          </Link>
        </div>
      </div>
    </main>
  );
}