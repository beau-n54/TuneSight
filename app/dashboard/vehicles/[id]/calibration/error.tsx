"use client";
export default function CalibrationWorkshopError({ reset }: { error: Error; reset: () => void }) {
  return <main className="min-h-screen bg-black px-6 py-10 text-white"><div className="mx-auto max-w-3xl rounded-2xl border border-red-400/30 bg-zinc-900 p-6"><h1 className="text-xl font-bold">Calibration Evidence unavailable</h1><p className="mt-2 text-sm text-zinc-400">The controlled Workshop Evidence could not be loaded. No calibration values have been substituted.</p><button type="button" onClick={reset} className="mt-5 rounded-lg border border-blue-400/50 px-4 py-2 text-sm text-blue-200">Try again</button></div></main>;
}
