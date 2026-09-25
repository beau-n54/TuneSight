import Link from "next/link";
import BridgeDownload from "@/components/BridgeDownload";

export const metadata = { title: "TuneSight Bridge for Windows" };
export default function BridgePage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 text-white">
    <Link href="/dashboard" className="mb-6 inline-block text-blue-300">Back to TuneSight</Link>
    <BridgeDownload />
  </main>;
}
