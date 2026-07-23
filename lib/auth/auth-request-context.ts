import "server-only";

import { createHash } from "node:crypto";
import type { AuthRequestContext } from "@/lib/auth/auth-types";

function hashNetworkValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getAuthRequestContext(request: Request): AuthRequestContext {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || null;
  const rawUserAgent = request.headers.get("user-agent")?.trim() || null;

  return {
    ipHash: ip ? hashNetworkValue(ip) : null,
    userAgent: rawUserAgent?.slice(0, 512) ?? null,
  };
}
