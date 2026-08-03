import type { ReactNode } from "react";

export const engineeringWorkspaceSections = [
  { id: "engineering-summary", label: "Engineering Summary" },
  { id: "primary-engineering-results", label: "Primary Engineering Results" },
  { id: "engineering-telemetry", label: "Engineering Telemetry Workspace" },
  { id: "engineering-evidence", label: "Engineering Evidence" },
  { id: "engineering-investigation", label: "Engineering Investigation" },
  { id: "calibration-context", label: "Calibration Context" },
] as const;

type Props = {
  summary: ReactNode;
  primaryResults: ReactNode;
  telemetry: ReactNode;
  evidence: ReactNode;
  investigation: ReactNode;
  calibrationContext: ReactNode;
};

export function EngineeringWorkspaceShell(props: Props) {
  const content = [props.summary, props.primaryResults, props.telemetry, props.evidence, props.investigation, props.calibrationContext];

  return (
    <div aria-label="Engineering Workspace" className="space-y-6" data-workspace-focus="shared">
      <nav aria-label="Engineering Workspace sections" className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl shadow-black/20 backdrop-blur">
        <ul className="flex min-w-max gap-1">
          {engineeringWorkspaceSections.map((section) => (
            <li key={section.id}>
              <a className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400" href={`#${section.id}`}>
                {section.label.replace("Engineering ", "")}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid items-start gap-6 xl:grid-cols-12">
        {engineeringWorkspaceSections.map((section, index) => (
          <section aria-labelledby={`${section.id}-heading`} className={index < 4 ? "scroll-mt-24 space-y-4 xl:col-span-12" : "scroll-mt-24 space-y-4 xl:col-span-6"} id={section.id} key={section.id}>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-800" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500" id={`${section.id}-heading`}>{section.label}</h2>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
            {content[index]}
          </section>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceReservedPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h3 className="font-semibold text-zinc-200">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{children}</p>
    </div>
  );
}
