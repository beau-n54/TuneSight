import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import SubscriberPageClient from "./subscriber-page-client";
import { notFound } from "next/navigation";
export default async function SubscriberPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireSubscriberPage();
  const { id } = await params;
  const { data, error } = await supabase.from("vehicles").select("id").eq("id", id).eq("user_id", user.id).single();
  if (error || !data) notFound();
  return <SubscriberPageClient />;
}
