import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import SubscriberPageClient from "./subscriber-page-client";
export default async function SubscriberPage() {
  await requireSubscriberPage();
  return <SubscriberPageClient />;
}
