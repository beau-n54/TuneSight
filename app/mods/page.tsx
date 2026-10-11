import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import SubscriberPageClient from "./subscriber-page-client";
export default async function SubscriberPage() {
  const { user } = await requireSubscriberPage();
  return <SubscriberPageClient ownerId={user.id} />;
}
