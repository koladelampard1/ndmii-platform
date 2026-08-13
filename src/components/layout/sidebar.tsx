import { getCurrentUserContext } from "@/lib/auth/session";
import { ROLE_NAV_GROUPS, ROLE_NAV_ITEMS, canAccessRoute, isPlatformAdmin, type NavigationGroup } from "@/lib/auth/authorization";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { UserRole } from "@/types/roles";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAccessPropertyRegistrationWorkspace } from "@/lib/data/property-foundation";
import { resolvePropertyOperationsAccess } from "@/lib/property/property-operations-service";

const ROLE_LABEL: Record<UserRole, string> = {
  public: "Public",
  admin: "Administrator",
  super_admin: "Super Administrator",
  boi_executive: "BOI Executive",
  programme_officer: "Programme Officer",
  assessment_officer: "Assessment Officer",
  field_officer: "Field Officer",
  data_analyst: "Data Analyst",
  auditor: "Auditor",
  workspace_user: "Workspace User",
  reviewer: "Reviewer",
  fccpc_officer: "FCCPC Officer",
  nrs_officer: "NRS Officer",
  firs_officer: "NRS Officer",
  association_officer: "Association Officer",
  msme: "MSME Operator",
};

export async function Sidebar() {
  const context = await getCurrentUserContext();
  const { role } = context;
  const navGroups: NavigationGroup[] =
    role === "admin" || role === "super_admin"
      ? ROLE_NAV_GROUPS[role] ?? [{ label: "Admin", items: ROLE_NAV_ITEMS[role] }]
      : role === "public"
        ? [{ label: "Public", items: [{ href: "/verify", label: "Public Verification" }] }]
        : ROLE_NAV_GROUPS[role] ?? [{ label: "Operational Modules", items: ROLE_NAV_ITEMS[role] }];

  if (context.appUserId && !navGroups.some((group) => group.items.some((item) => item.href === "/dashboard/lcdbo"))) {
    const supabase = await createServiceRoleSupabaseClient();
    const [{ count }, { data: programme }] = await Promise.all([
      supabase.from("cluster_members").select("id", { count: "exact", head: true }).eq("assigned_officer_id", context.appUserId),
      supabase.from("programmes").select("id").eq("slug", "local-content-development-beyond-oil").maybeSingle(),
    ]);
    const { data: scopedRoles } = programme?.id
      ? await supabase.from("role_assignments").select("role,expires_at").eq("user_id", context.appUserId).eq("scope_type", "programme").eq("scope_id", programme.id).eq("status", "active").in("role", ["programme_officer", "institution_admin", "data_analyst", "auditor", "observer", "admin", "super_admin", "state_coordinator", "lga_coordinator", "cluster_manager", "correspondence_admin", "records_admin", "requester", "drafter", "rmrdc_reviewer", "roseate_reviewer", "joint_secretariat", "rmrdc_signatory", "roseate_signatory", "signatory_delegate", "dispatch_officer"])
      : { data: [] };
    const hasActiveScopedRole = (scopedRoles ?? []).some((assignment) => !assignment.expires_at || new Date(assignment.expires_at).getTime() > Date.now());
    if ((count ?? 0) > 0 || hasActiveScopedRole) navGroups.push({ label: "Programme Operations", items: [{ href: "/dashboard/lcdbo", label: "LCDBO Programme Operations" }] });
    const hasCorrespondenceRole = (scopedRoles ?? []).some((assignment) => ["programme_officer", "institution_admin", "data_analyst", "auditor", "observer", "correspondence_admin", "records_admin", "requester", "drafter", "rmrdc_reviewer", "roseate_reviewer", "joint_secretariat", "rmrdc_signatory", "roseate_signatory", "signatory_delegate", "dispatch_officer"].includes(assignment.role) && (!assignment.expires_at || new Date(assignment.expires_at).getTime() > Date.now()));
    if (hasCorrespondenceRole && !navGroups.some((group) => group.items.some((item) => item.href === "/dashboard/correspondence"))) {
      navGroups.push({ label: "Correspondence", items: [{ href: "/dashboard/correspondence", label: "LCDBO Correspondence" }] });
    }
  }

  if (context.appUserId && !navGroups.some((group) => group.items.some((item) => item.href === "/dashboard/property/register"))) {
    const supabase = await createServiceRoleSupabaseClient();
    const propertyAccess = await canAccessPropertyRegistrationWorkspace({ ctx: context, client: supabase });
    if (propertyAccess.allowed) {
      navGroups.push({
        label: "Property Applications",
        items: [
          { href: "/dashboard/property/register", label: "Register Property" },
          { href: "/dashboard/property/my-properties", label: "My Properties" },
          { href: "/dashboard/property/drafts", label: "Drafts" },
        ],
      });
    }
  }

  if (context.appUserId && !navGroups.some((group) => group.items.some((item) => item.href === "/dashboard/property/operations"))) {
    const supabase = await createServiceRoleSupabaseClient();
    const operationsAccess = await resolvePropertyOperationsAccess({ ctx: context, client: supabase });
    if (operationsAccess.allowed) {
      navGroups.push({
        label: "Registry Operations",
        items: [
          { href: "/dashboard/property/operations", label: "Command Centre" },
          { href: "/dashboard/property/cases", label: "Registry Cases" },
          { href: "/dashboard/property/assignments", label: "My Assignments" },
          { href: "/dashboard/property/verification", label: "Verification" },
          { href: "/dashboard/property/gis", label: "GIS Workbench" },
          { href: "/dashboard/property/certificates", label: "Certificates" },
        ],
      });
    }
  }

  const allowedGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !(isPlatformAdmin(role) && item.href === "/dashboard/property"))
        .filter((item) => canAccessRoute(role, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-72 shrink-0 border-r bg-slate-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{ROLE_LABEL[role]} Portal</p>
      <p className="mb-4 text-sm font-semibold uppercase text-slate-500">Core Workflows</p>
      <SidebarNav groups={allowedGroups} />
    </aside>
  );
}
