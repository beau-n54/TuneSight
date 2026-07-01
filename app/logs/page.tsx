"use client";

import { ChangeEvent, useState } from "react";

export default function LogsPage() {
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const runBasicAnalysis = (headers: string[], rows: string[]) => {
    const results: string[] = [];

    // BOOST
    if (headers.includes("Boost (PSI)")) {
      const boostIndex = headers.indexOf("Boost (PSI)");

      const boostValues = rows
        .map((row) => {
          const cols = row.split(",");
          return parseFloat(cols[boostIndex]);
        })
        .filter((value) => !isNaN(value));

      if (boostValues.length > 0) {
        const maxBoost = Math.max(...boostValues);

        if (maxBoost > 22) {
          results.push(
            `⚠️ High boost detected (${maxBoost.toFixed(1)} PSI) — Possible overboost or aggressive tuning.`,
          );
        } else {
          results.push(`✅ Boost looks healthy (Max ${maxBoost.toFixed(1)} PSI)`);
        }
      }
    }

    // TIMING CORRECTIONS
    const timingHeaders = headers.filter((h) => h.includes("Timing Cor"));

    if (timingHeaders.length > 0) {
      const timingValues: number[] = [];

      timingHeaders.forEach((header) => {
        const idx = headers.indexOf(header);

        rows.forEach((row) => {
          const cols = row.split(",");
          const value = parseFloat(cols[idx]);
          if (!isNaN(value)) {
            timingValues.push(value);
          }
        });
      });

      if (timingValues.length > 0) {
        const minTiming = Math.min(...timingValues);

        if (minTiming < -3) {
          results.push(
            `⚠️ Timing correction detected: minimum timing value was ${minTiming.toFixed(1)}`,
          );
        } else {
          results.push(`✅ Timing looks stable (Min ${minTiming.toFixed(1)})`);
        }
      }
    }

    // AFR
    if (headers.includes("Lambda bank 1 (AFR)")) {
      const afrIndex = headers.indexOf("Lambda bank 1 (AFR)");

      const afrValues = rows
        .map((row) => {
          const cols = row.split(",");
          return parseFloat(cols[afrIndex]);
        })
        .filter((value) => !isNaN(value));

      if (afrValues.length > 0) {
        const minAfr = Math.min(...afrValues);

        if (minAfr < 11.5) {
          results.push(`⚠️ AFR running rich (${minAfr.toFixed(2)}) — Possible overfueling.`);
        } else if (minAfr > 13) {
          results.push(`⚠️ AFR running lean (${minAfr.toFixed(2)}) — Possible fueling issue.`);
        } else {
          results.push(`✅ AFR looks healthy (${minAfr.toFixed(2)} min)`);
        }
      }
    }

    // LOW FUEL PRESSURE
    if (headers.includes("Fuel low pressure sensor (PSI)")) {
      const fuelIndex = headers.indexOf("Fuel low pressure sensor (PSI)");

      const fuelValues = rows
        .map((row) => {
          const cols = row.split(",");
          return parseFloat(cols[fuelIndex]);
        })
        .filter((value) => !isNaN(value));

      if (fuelValues.length > 0) {
        const minFuel = Math.min(...fuelValues);

        if (minFuel < 50) {
          results.push(
            `⚠️ Low fuel pressure (${minFuel.toFixed(1)} PSI) — Possible pump or fueling issue.`,
          );
        } else {
          results.push(`✅ Fuel pressure looks stable (Min ${minFuel.toFixed(1)} PSI)`);
        }
      }
    }

    if (results.length === 0) {
      results.push("No supported analysis channels were found in this log.");
    }

    setAnalysis(results);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRowCount(null);
    setHeaders([]);
    setAnalysis([]);
    setMessage("");

    const text = await file.text();

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (lines.length < 2) {
      setMessage("CSV file looks empty or invalid.");
      return;
    }

    const headerLine = lines.find((line) => !line.startsWith("#"));

    if (!headerLine) {
      setMessage("No valid header row found.");
      return;
    }

    const parsedHeaders = headerLine.split(",").map((h) => h.trim());
    const dataLines = lines.filter((line) => !line.startsWith("#")).slice(1);

    setHeaders(parsedHeaders);
    setRowCount(dataLines.length);
    runBasicAnalysis(parsedHeaders, dataLines);
    setMessage("Log file loaded successfully.");
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">MHD Log Upload</h1>
        <p className="text-zinc-400 mb-10">
          Upload an MHD CSV log so TuneSight can begin analysing the data.
        </p>

        <div className="bmw-border rounded-2xl border border-zinc-800 bg-zinc-900 p-8 mb-8">
          <label className="block mb-4 text-sm text-zinc-400">
            Choose CSV Log File
          </label>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-zinc-300 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:bg-white file:text-black hover:file:opacity-80"
          />
        </div>

        {fileName && (
          <div className="bmw-border rounded-2xl border border-zinc-800 bg-zinc-900 p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Log Summary</h2>

            <p className="mb-2">
              <span className="text-zinc-400">File:</span> {fileName}
            </p>

            <p className="mb-2">
              <span className="text-zinc-400">Rows:</span>{" "}
              {rowCount !== null ? rowCount : "-"}
            </p>

            <p>
              <span className="text-zinc-400">Headers Found:</span> {headers.length}
            </p>
          </div>
        )}

        {headers.length > 0 && (
          <div className="bmw-border rounded-2xl border border-zinc-800 bg-zinc-900 p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Detected Headers</h2>

            <div className="flex flex-wrap gap-2">
              {headers.map((header) => (
                <span
                  key={header}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-sm text-zinc-200"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
        )}

        {analysis.length > 0 && (
          <div className="bmw-border rounded-2xl border border-zinc-800 bg-zinc-900 p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-4">AI Insights</h2>

            <ul className="space-y-2">
              {analysis.map((item, index) => (
                <li key={index} className="text-zinc-300">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && <p className="text-green-400">{message}</p>}
      </div>
    </main>
  );
}