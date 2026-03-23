import type { UserRole } from "@/types/roles";

export const ROUTE_ACCESS_FIXTURE: Record<Exclude<UserRole, "public">, { allowed: string[]; denied: string[] }> = {
  admin: {
    allowed: ["/dashboard/executive", "/dashboard/reviews", "/dashboard/nrs", "/dashboard/msme/id-registry"],
    denied: [],
  },
  reviewer: {
    allowed: ["/dashboard/reviews", "/dashboard/compliance"],
    denied: ["/dashboard/nrs", "/dashboard/associations"],
  },
  msme: {
    allowed: ["/dashboard/msme", "/dashboard/msme/onboarding", "/dashboard/msme/id-card", "/dashboard/payments"],
    denied: ["/dashboard/reviews", "/dashboard/nrs", "/dashboard/executive"],
  },
  association_officer: {
    allowed: ["/dashboard/associations", "/dashboard/reports"],
    denied: ["/dashboard/reviews", "/dashboard/nrs"],
  },
  fccpc_officer: {
    allowed: ["/dashboard/fccpc"],
    denied: ["/dashboard/reviews", "/dashboard/payments"],
  },
  firs_officer: {
    allowed: ["/dashboard/nrs", "/dashboard/payments"],
    denied: ["/dashboard/reviews", "/dashboard/associations"],
  },
};
