"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginDetailsPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSave = () => {
    setMessage("");

    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    if (!currentPassword.trim()) {
      setMessage("Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      setMessage("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage("New password and confirm password do not match.");
      return;
    }

    localStorage.setItem("ts_account_email", email);
    setMessage("Login details saved successfully.");
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="text-zinc-400 hover:text-white transition">
          ← Back to Account
        </Link>

        <h1 className="text-5xl font-bold mt-8 mb-4">Login Details</h1>
        <p className="text-zinc-400 mb-10">
          Update your account email and password here.
        </p>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-8 mb-6">
          <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-xl bg-black border border-zinc-700 mb-6"
          />

          <label className="block text-sm text-zinc-400 mb-2">Current Password</label>
          <input
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full p-4 rounded-xl bg-black border border-zinc-700 mb-6"
          />

          <label className="block text-sm text-zinc-400 mb-2">New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-4 rounded-xl bg-black border border-zinc-700 mb-6"
          />

          <label className="block text-sm text-zinc-400 mb-2">Confirm New Password</label>
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="w-full p-4 rounded-xl bg-black border border-zinc-700 mb-6"
          />

          <button
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition mb-4"
          >
            Save Login Details
          </button>

          <button className="w-full py-4 rounded-xl bg-zinc-800 text-white font-semibold hover:opacity-80 transition">
            Forgot Password? Send Reset Email
          </button>

          {message && (
            <p className="mt-6 text-sm text-zinc-300">
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}