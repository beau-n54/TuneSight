import type { ReactNode } from "react";
import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import SubscriberSessionBoundary from "@/components/SubscriberSessionBoundary";
export default async function SubscriberLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSubscriberPage();
  return <SubscriberSessionBoundary ownerId={user.id}>{children}</SubscriberSessionBoundary>;
}
