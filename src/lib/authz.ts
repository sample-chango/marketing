import type { User } from "@supabase/supabase-js";

export type ApprovalStatus = "pending" | "approved" | "rejected";

type UserLike = Pick<User, "email" | "app_metadata"> | null;

export function getApprovalStatus(
  user: Pick<User, "app_metadata"> | null,
): ApprovalStatus | null {
  const status = user?.app_metadata?.approval_status;
  return status === "pending" || status === "approved" || status === "rejected"
    ? status
    : null;
}

export function isAdminUser(user: UserLike) {
  if (!user) return false;
  if (user.app_metadata?.role === "admin") return true;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));
}

export function isApprovedUser(user: UserLike) {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const status = getApprovalStatus(user);
  return status === "approved" || status === null;
}

export function areSignupRequestsEnabled() {
  return process.env.SIGNUP_REQUESTS_ENABLED !== "false";
}
