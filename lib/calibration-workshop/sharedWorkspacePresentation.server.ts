import "server-only";
import { resolveWorkspacePresentation } from "./sharedWorkspaceDispatch.ts";

/** Server only; never NEXT_PUBLIC. Shared by default, explicit legacy rollback; invalid values safely select legacy. */
export function subscriberWorkspacePresentation() {
  return resolveWorkspacePresentation(process.env.TUNESIGHT_CALIBRATION_PRESENTATION);
}
