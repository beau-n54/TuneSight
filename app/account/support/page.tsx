"use client";

import Link from "next/link";
import { useState } from "react";

export default function SupportPage() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const handleAsk = () => {
    const q = question.toLowerCase().trim();

    if (!q) {
      setResponse("Please enter a question so TuneSight Assist can help.");
      return;
    }

    if (q.includes("upload") && q.includes("log")) {
      setResponse(
        "To upload a log, go to the Logs page from your dashboard or garage, then choose your MHD CSV file. TuneSight will parse the headers, row count, and generate AI insights."
      );
      return;
    }

    if (q.includes("plan") || q.includes("subscription")) {
      setResponse(
        "You can review your current plan and manage upgrades, downgrades, or cancellation from the Subscription section inside your Account page."
      );
      return;
    }

    if (q.includes("vehicle") || q.includes("engine")) {
      setResponse(
        "Go to Vehicle Setup to enter your vehicle name, engine platform, and fuel type. This helps TuneSight analyse your logs with proper context."
      );
      return;
    }

    if (q.includes("mods") || q.includes("modifications")) {
      setResponse(
        "Go to the Modifications page to store your turbo, fuel system, intercooler, intake, and exhaust setup. This gives your log analysis more useful context."
      );
      return;
    }

    if (q.includes("timing") || q.includes("boost") || q.includes("afr") || q.includes("fuel pressure")) {
      setResponse(
        "TuneSight AI Insights are designed to highlight early signs of boost issues, timing corrections, AFR behavior, and low fuel pressure. Upload a log on the Logs page to review these insights."
      );
      return;
    }

    if (q.includes("billing") || q.includes("invoice") || q.includes("payment")) {
      setResponse(
        "Billing and payment history will be managed from the Billing section in your Account area once payments are fully connected."
      );
      return;
    }

    setResponse(
      "I could not find a direct answer for that yet. Try asking about logs, plans, vehicle setup, modifications, subscription, or billing."
    );
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">TuneSight Assist</h1>
        <p className="text-zinc-400 mb-10">
          Ask TuneSight Assist a question about the platform, plans, uploads, or analysis workflow.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-6">
          <label className="block text-sm text-zinc-400 mb-2">
            Ask a question
          </label>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How do I upload an MHD log?"
            className="w-full min-h-[140px] p-4 rounded-xl bg-black border border-zinc-700 mb-6"
          />

          <button
            onClick={handleAsk}
            className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition"
          >
            Ask TuneSight Assist
          </button>
        </div>

        {response && (
          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold mb-4">Response</h2>
            <p className="text-zinc-300 leading-7">{response}</p>
          </div>
        )}
      </div>
    </main>
  );
}