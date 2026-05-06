import type { UserRole } from "@/types/roles";

export const ROUTE_ACCESS_FIXTURE: Record<Exclude<UserRole, "public">, { allowed: string[]; denied: string[] }> = {
  admin: {
    allowed: [
      "/dashboard",
      "/dashboard/admin",
      "/dashboard/admin/msmes",
      "/dashboard/admin/verifications",
      "/dashboard/admin/digital-ids",
      "/dashboard/admin/associations",
      "/dashboard/admin/association-members",
      "/dashboard/admin/association-upload",
      "/dashboard/admin/complaints",
      "/dashboard/admin/public-verification",
    ],
    denied: [],
  },
  reviewer: {
    allowed: ["/dashboard/reviews", "/dashboard/compliance"],
    denied: ["/dashboard/nrs", "/dashboard/associations"],
  },
  msme: {
    allowed: ["/dashboard/msme", "/dashboard/msme/onboarding", "/dashboard/msme/id-card", "/dashboard/msme/payments"],
    denied: ["/dashboard/reviews", "/dashboard/nrs", "/dashboard"],
  },
  association_officer: {
    allowed: ["/dashboard/associations", "/dashboard/reports"],
    denied: ["/dashboard/reviews", "/dashboard/nrs"],
  },
  fccpc_officer: {
    allowed: ["/dashboard/fccpc"],
    denied: ["/dashboard/reviews", "/dashboard/payments"],
  },
  nrs_officer: {
    allowed: ["/dashboard/nrs", "/dashboard/payments"],
    denied: ["/dashboard/reviews", "/dashboard/associations"],
  },
  firs_officer: {
    allowed: ["/dashboard/nrs", "/dashboard/payments"],
    denied: ["/dashboard/reviews", "/dashboard/associations"],
  },
};
