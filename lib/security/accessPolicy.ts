export type BetaProfile = {
  legal_accepted: boolean | null;
  beta_access: boolean | null;
  beta_status: string | null;
  beta_expires_at: string | null;
  role?: string | null;
};

export type AccessDecision = "allowed" | "legal_required" | "beta_required" | "suspended" | "expired" | "profile_unavailable";

/** Profile data must come from the authenticated server query, never user metadata or localStorage. */
export function betaAccessDecision(profile: BetaProfile | null, now = Date.now()): AccessDecision {
  if (!profile) return "profile_unavailable";
  if (profile.beta_status === "suspended") return "suspended";
  if (profile.beta_expires_at !== null) {
    const expiry = Date.parse(profile.beta_expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) return "expired";
  }
  if (profile.legal_accepted !== true) return "legal_required";
  if (profile.beta_access !== true || profile.beta_status !== "approved") return "beta_required";
  return "allowed";
}

export function hasAdministratorAuthority(profile: BetaProfile | null, now = Date.now()): boolean {
  return betaAccessDecision(profile, now) === "allowed" && profile?.role === "admin";
}

export const PROTECTED_ROOTS = ["dashboard", "garage", "account", "vehicle", "mods", "logs", "checkout"] as const;
export function isSubscriberPath(path: string): boolean {
  return PROTECTED_ROOTS.some(root => path === `/${root}` || path.startsWith(`/${root}/`));
}

/** A destination is a path, not a URL. Reject encodings that can change URL structure. */
export function safeReturnPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return fallback;
  try {
    const parsed = new URL(value, "https://return.invalid");
    return parsed.origin === "https://return.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const source = new URL(origin), target = new URL(request.url);
    return source.origin === origin && source.origin === target.origin
      && ["http:", "https:"].includes(source.protocol)
      && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
}
