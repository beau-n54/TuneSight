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
        "Choose your owned vehicle in Garage, open Logs, and upload a supported CSV. Rules run only when source units and vehicle applicability are qualified; unavailable inputs are shown explicitly."
      );
      return;
    }

    if (q.includes("plan") || q.includes("subscription")) {
      setResponse(
        "TuneSight is a controlled, unpaid beta. Paid plans, upgrades, cancellations and payment processing are not enabled."
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
        "Update the owned vehicle in Garage for the setup used by Analysis. The separate Modifications page stores browser-only notes and does not change Analysis context."
      );
      return;
    }

    if (q.includes("timing") || q.includes("boost") || q.includes("afr") || q.includes("fuel pressure")) {
      setResponse(
        "Qualified rule-based Analysis can identify supported observations. Missing channels and unsupported platforms remain unavailable; a log is not an all-systems health or safety certification."
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
          Search predefined help answers about TuneSight. This is a static help lookup; it does not inspect your vehicle or provide a live AI diagnosis.
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
