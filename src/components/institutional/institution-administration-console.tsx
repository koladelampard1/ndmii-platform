"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2, CircleAlert, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";

type Institution = { id: string; name: string; institution_type: string; status: string };
type Membership = { id: string; institution_id: string; role: string; status: string; expires_at: string | null };
type Member = { id: string; user_id: string; role: string; status: string; users?: { email?: string; full_name?: string } | null };
type Bdsp = { id: string; name: string; status: string; service_states: string[] };
type Agent = { id: string; member_id: string; bdsp_organisation_id: string | null; service_states: string[]; member?: Member | null };
type Assignment = { id: string; engagement_id: string; agent_member_id: string; assigned_at: string };
type Engagement = { id: string; relationship_status: string };
type BusinessEngagement = Engagement & { passport_access_status: string };
type Passport = { msme_id: string; business_name: string; state: string; sector: string; verification_status: string };
type Setting = { setting_key: string; setting_value: { value?: unknown } };
type JsonResult = Record<string, unknown> & { error?: string };

async function api(path: string, method = "GET", body?: Record<string, unknown>): Promise<JsonResult> {
  const response = await fetch(path, { method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json().catch(() => ({})) as JsonResult;
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

const institutionTypes = [
  ["microfinance_bank", "Microfinance bank"], ["development_finance_institution", "Development finance institution"],
  ["association", "Association"], ["private_company", "Private organisation"],
  ["federal_agency", "Federal agency"], ["state_government", "State government"],
  ["technical_partner", "Technical partner"],
] as const;
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const field = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const button = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const label = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600";
const statesFrom = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);

export function InstitutionAdministrationConsole() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [bdsps, setBdsps] = useState<Bdsp[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [businessEngagements, setBusinessEngagements] = useState<BusinessEngagement[]>([]);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newType, setNewType] = useState("microfinance_bank");
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState("institution_officer");
  const [bdspName, setBdspName] = useState("");
  const [bdspStates, setBdspStates] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentBdsp, setAgentBdsp] = useState("");
  const [agentStates, setAgentStates] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [assignmentAgent, setAssignmentAgent] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [sector, setSector] = useState("");
  const selectionGeneration = useRef(0);

  const loadInstitutions = useCallback(async (preferred?: string) => {
    const data = await api("/api/institutions");
    const rows = (data.institutions ?? []) as Institution[];
    setInstitutions(rows);
    setMemberships((data.memberships ?? []) as Membership[]);
    setPlatformAdmin(Boolean(data.platformAdmin));
    setSelected((current) => {
      if (preferred && rows.some((row) => row.id === preferred)) return preferred;
      return rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "";
    });
  }, []);

  const loadSelected = useCallback(async (id: string, isAdmin: boolean, membershipsForUser: Membership[]) => {
    if (!id) return;
    const generation = ++selectionGeneration.current;
    setMembers([]); setBdsps([]); setAgents([]); setAssignments([]); setEngagements([]); setBusinessEngagements([]); setPassport(null);
    const pending = !isAdmin && !membershipsForUser.some((row) => row.institution_id === id && row.status === "active");
    if (pending) return;
    const manager = isAdmin || membershipsForUser.some((row) => row.institution_id === id && row.status === "active" && row.role === "institution_admin");
    const base = `/api/institutions/${id}`;
    const results = await Promise.all([
      api(`${base}/settings`), api(`${base}/assignments`),
      manager ? api(`${base}/members`) : Promise.resolve({ members: [] }),
      manager ? api(`${base}/bdsps`) : Promise.resolve({ bdsps: [] }),
      manager ? api(`${base}/agents`) : Promise.resolve({ agents: [] }),
      api(`${base}/engagements`),
    ]);
    if (generation !== selectionGeneration.current) return;
    setAssignments((results[1].assignments ?? []) as Assignment[]);
    setEngagements((results[1].engagements ?? []) as Engagement[]);
    setMembers((results[2].members ?? []) as Member[]);
    setBdsps((results[3].bdsps ?? []) as Bdsp[]);
    setAgents((results[4].agents ?? []) as Agent[]);
    setBusinessEngagements((results[5].engagements ?? []) as BusinessEngagement[]);
    const support = ((results[0].settings ?? []) as Setting[]).find((row) => row.setting_key === "support_email");
    setSupportEmail(typeof support?.setting_value?.value === "string" ? support.setting_value.value : "");
  }, []);

  useEffect(() => {
    loadInstitutions().catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  }, [loadInstitutions]);
  useEffect(() => {
    loadSelected(selected, platformAdmin, memberships).catch((cause) => setError(cause.message));
  }, [selected, platformAdmin, memberships, loadSelected]);

  async function act(task: () => Promise<unknown>, message: string) {
    setWorking(true); setError(""); setNotice("");
    try {
      await task();
      await loadInstitutions();
      setNotice(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed."); }
    finally { setWorking(false); }
  }
  const selectedInstitution = institutions.find((row) => row.id === selected);
  const activeMembership = memberships.find((row) => row.institution_id === selected && row.status === "active");
  const pending = !platformAdmin && !activeMembership;
  const manager = platformAdmin || activeMembership?.role === "institution_admin";
  const canEnrol = manager || ["institution_officer", "institution_agent"].includes(activeMembership?.role ?? "");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900 sm:px-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-7 text-white sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-200"><ShieldCheck className="h-4 w-4" /> Institution operations</span>
        <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">One business identity. Clear institutional boundaries.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Set up your institution, manage trusted people and BDSPs, and direct work to agents. Each bank has its own roster and assignment queue.</p>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert className="h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}
      {loading ? <p className="text-sm text-slate-600">Loading your institutions…</p> : (
        <>
        {selected && !pending && <Link href={`/dashboard/institutions/${selected}/diagnostics`} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white">Open diagnostics and development plans <ArrowRight size={17}/></Link>}
        {selected && !pending && <Link href={`/dashboard/institutions/${selected}/finance-readiness`} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-teal-800 px-5 py-3 text-sm font-bold text-teal-900">Open finance preparation <ArrowRight size={17}/></Link>}
        <div className="grid gap-6 xl:grid-cols-[19rem_1fr]">
          <div className="space-y-5">
            <section className={card}>
              <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-teal-700" /> Institutions</h2>
              <p className="mt-1 text-xs text-slate-500">Select the organisation whose work you are viewing.</p>
              <div className="mt-5 space-y-2">
                {institutions.map((institution) => {
                  const membership = memberships.find((row) => row.institution_id === institution.id);
                  return <button key={institution.id} type="button" onClick={() => {
                    selectionGeneration.current++;
                    setMembers([]); setBdsps([]); setAgents([]); setAssignments([]); setEngagements([]); setBusinessEngagements([]); setPassport(null); setSupportEmail("");
                    setSelected(institution.id);
                  }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${selected === institution.id ? "border-teal-700 bg-teal-50 text-teal-950" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="min-w-0"><span className="block truncate font-bold">{institution.name}</span><span className="text-xs capitalize text-slate-500">{membership?.status === "invited" ? "Invitation pending" : institution.institution_type.replaceAll("_", " ")}</span></span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>;
                })}
                {!institutions.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No institution is linked to your account yet.</p>}
              </div>
            </section>
            {platformAdmin && <section className={card}>
              <h2 className="font-bold">Register an institution</h2>
              <p className="mt-1 text-xs text-slate-500">Set up an independent bank or partner workspace.</p>
              <form className="mt-4 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void act(async () => {
                const data = await api("/api/institutions", "POST", { name: newName, slug: newSlug, institutionType: newType });
                setNewName(""); setNewSlug("");
                await loadInstitutions((data.institution as Institution & { id: string }).id);
              }, "Institution created. Invite an existing verified DBIN account as its administrator."); }}>
                <label><span className={label}>Name</span><input className={field} required minLength={3} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Example Microfinance Bank" /></label>
                <label><span className={label}>URL slug</span><input className={field} required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} placeholder="example-mfb" /></label>
                <label><span className={label}>Type</span><select className={field} value={newType} onChange={(e) => setNewType(e.target.value)}>{institutionTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
                <button className={button} disabled={working}><Plus className="h-4 w-4" /> Create institution</button>
              </form>
            </section>}
          </div>
          <div className="space-y-5">
            {!selectedInstitution ? <section className={card}><p className="text-sm text-slate-600">Choose an institution to continue.</p></section> : pending ? <section className={card}>
              <h2 className="text-xl font-bold">Invitation to {selectedInstitution.name}</h2>
              <p className="mt-2 text-sm text-slate-600">Accept this invitation to enter the institution workspace. Your access remains private to this institution.</p>
              <button className={`${button} mt-5`} disabled={working} onClick={() => void act(async () => {
                await api(`/api/institutions/${selected}/membership/accept`, "POST"); await loadInstitutions();
              }, "Invitation accepted.")}>Accept invitation <ArrowRight className="h-4 w-4" /></button>
            </section> : <>
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Current institution</p><h2 className="mt-1 text-2xl font-black">{selectedInstitution.name}</h2><p className="mt-1 text-sm capitalize text-slate-500">{selectedInstitution.institution_type.replaceAll("_", " ")} · {activeMembership?.role?.replaceAll("_", " ") ?? "Platform administrator"}</p></div>
                  <button className={secondary} disabled={working} onClick={() => void loadSelected(selected, platformAdmin, memberships).catch((cause) => setError(cause.message))}><RefreshCw className="h-4 w-4" /> Refresh</button>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[["BDSP organisations", bdsps.length], ["Agent profiles", agents.length], ["Active assignments", assignments.length]].map(([text, value]) =>
                    <div key={text} className="rounded-2xl bg-slate-50 p-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-semibold text-slate-600">{text}</p></div>)}
                </div>
              </section>
              {manager && <section className={card}>
                <h3 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-teal-700" /> Staff access</h3>
                <p className="mt-1 text-sm text-slate-600">Invite a person who already has a verified DBIN account. They will see the invitation when they sign in.</p>
                <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_13rem_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/members`, "POST", { email, role: staffRole });
                  setEmail(""); await loadSelected(selected, platformAdmin, memberships);
                }, "Staff invitation created."); }}>
                  <label><span className={label}>Account email</span><input type="email" className={field} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@bank.ng" /></label>
                  <label><span className={label}>Role</span><select className={field} value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>{(platformAdmin ? ["institution_admin", "institution_officer", "institution_reviewer"] : ["institution_officer", "institution_reviewer"]).map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>
                  <button className={button} disabled={working}>Invite</button>
                </form>
                <div className="mt-5 divide-y divide-slate-100">
                  {members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div><p className="font-semibold">{member.users?.full_name || member.users?.email || "DBIN member"}</p><p className="text-xs text-slate-500">{member.users?.email} · {member.role.replaceAll("_", " ")} · {member.status}</p></div>
                    {["active", "invited"].includes(member.status) && (platformAdmin || member.role !== "institution_admin") &&
                      <button className={secondary} disabled={working} onClick={() => void act(async () => {
                        await api(`/api/institutions/${selected}/members/${member.id}`, "PATCH", { action: "revoke" });
                        await loadSelected(selected, platformAdmin, memberships);
                      }, "Access revoked immediately.")}>Revoke</button>}
                  </div>)}
                </div>
              </section>}
              {manager && <section className={card}>
                <h3 className="text-lg font-bold">BDSP organisations</h3>
                <p className="mt-1 text-sm text-slate-600">These affiliations are private to {selectedInstitution.name}. Service areas are optional.</p>
                <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/bdsps`, "POST", { name: bdspName, serviceStates: statesFrom(bdspStates) });
                  setBdspName(""); setBdspStates(""); await loadSelected(selected, platformAdmin, memberships);
                }, "BDSP organisation added."); }}>
                  <label><span className={label}>BDSP name</span><input className={field} required value={bdspName} onChange={(e) => setBdspName(e.target.value)} /></label>
                  <label><span className={label}>Service states</span><input className={field} value={bdspStates} onChange={(e) => setBdspStates(e.target.value)} placeholder="Lagos, Ogun" /></label>
                  <button className={button} disabled={working}>Add BDSP</button>
                </form>
                <div className="mt-5 divide-y divide-slate-100">{bdsps.map((bdsp) => <div key={bdsp.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><p className="font-semibold">{bdsp.name}</p><p className="text-xs text-slate-500">{bdsp.status} · {bdsp.service_states.join(", ") || "All areas"}</p></div>
                  <button className={secondary} disabled={working} onClick={() => void act(async () => {
                    await api(`/api/institutions/${selected}/bdsps/${bdsp.id}`, "PATCH", { status: bdsp.status === "active" ? "suspended" : "active" });
                    await loadSelected(selected, platformAdmin, memberships);
                  }, "BDSP status updated.")}>{bdsp.status === "active" ? "Suspend" : "Reactivate"}</button>
                </div>)}</div>
              </section>}
              {manager && <section className={card}>
                <h3 className="text-lg font-bold">Individual agents</h3>
                <p className="mt-1 text-sm text-slate-600">An agent can work with multiple banks, but sees only the assignments for the selected bank.</p>
                <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/agents`, "POST", {
                    email: agentEmail, bdspOrganisationId: agentBdsp || null, serviceStates: statesFrom(agentStates),
                  });
                  setAgentEmail(""); setAgentStates(""); await loadSelected(selected, platformAdmin, memberships);
                }, "Agent invitation created."); }}>
                  <label><span className={label}>Verified DBIN account email</span><input type="email" className={field} required value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} /></label>
                  <label><span className={label}>BDSP organisation</span><select className={field} value={agentBdsp} onChange={(e) => setAgentBdsp(e.target.value)}><option value="">Independent agent</option>{bdsps.filter((row) => row.status === "active").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
                  <label><span className={label}>Service states</span><input className={field} value={agentStates} onChange={(e) => setAgentStates(e.target.value)} placeholder="Lagos, Ogun" /></label>
                  <div className="flex items-end"><button className={button} disabled={working}>Invite agent</button></div>
                </form>
                <div className="mt-5 divide-y divide-slate-100">{agents.map((agent) => <div key={agent.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><p className="font-semibold">{agent.member?.users?.full_name || agent.member?.users?.email || "Agent"}</p><p className="text-xs text-slate-500">{agent.member?.status} · {bdsps.find((row) => row.id === agent.bdsp_organisation_id)?.name || "Independent"} · {agent.service_states.join(", ") || "All areas"}</p></div>
                  {["active", "invited"].includes(agent.member?.status || "") && <button className={secondary} disabled={working} onClick={() => void act(async () => {
                    await api(`/api/institutions/${selected}/members/${agent.member_id}`, "PATCH", { action: "revoke" });
                    await loadSelected(selected, platformAdmin, memberships);
                  }, "Agent access revoked immediately.")}>Revoke</button>}
                </div>)}</div>
              </section>}
              <section className={card}>
                <h3 className="text-lg font-bold">Business enrolment and passport access</h3>
                <p className="mt-1 text-sm text-slate-600">Enrol a new business with a verified DBIN owner account. Its passport stays private until that account expressly shares the identity summary.</p>
                {canEnrol && <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/engagements`, "POST", { businessName, ownerName, ownerEmail, state: businessState, sector });
                  setBusinessName(""); setOwnerName(""); setOwnerEmail(""); setBusinessState(""); setSector("");
                  await loadSelected(selected, platformAdmin, memberships);
                }, "Business enrolled. The owner can review and share its passport in their DBIN account."); }}>
                  <label><span className={label}>Business name</span><input className={field} required value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
                  <label><span className={label}>Owner name</span><input className={field} required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></label>
                  <label><span className={label}>Verified owner account email</span><input type="email" className={field} required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></label>
                  <label><span className={label}>State</span><input className={field} required value={businessState} onChange={(e) => setBusinessState(e.target.value)} placeholder="Lagos" /></label>
                  <label><span className={label}>Sector</span><input className={field} required value={sector} onChange={(e) => setSector(e.target.value)} /></label>
                  <div className="flex items-end"><button className={button} disabled={working}>Enrol business</button></div>
                </form>}
                <div className="mt-5 space-y-2">{businessEngagements.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                  <div><p className="font-semibold">Engagement {row.id.slice(0, 8)}…</p><p className="text-xs text-slate-500">{row.relationship_status} · Passport {row.passport_access_status}</p></div>
                  {row.passport_access_status === "granted" && <button className={secondary} disabled={working} onClick={() => {
                    const generation = selectionGeneration.current;
                    setWorking(true); setError(""); setPassport(null);
                    void api(`/api/institutions/${selected}/engagements/${row.id}/passport`)
                      .then((result) => { if (generation === selectionGeneration.current) setPassport(result.passport as Passport); })
                      .catch((cause) => setError(cause.message)).finally(() => setWorking(false));
                  }}>View shared summary</button>}
                </div>)}</div>
                {passport && <div className="mt-4 rounded-2xl bg-teal-50 p-5 text-sm"><p className="font-bold">{passport.business_name} · {passport.msme_id}</p><p className="mt-1 text-slate-700">{passport.state} · {passport.sector} · Verification: {passport.verification_status}</p></div>}
                {!businessEngagements.length && <p className="mt-4 text-sm text-slate-500">No business engagements in your current view yet.</p>}
              </section>
              <section className={card}>
                <h3 className="text-lg font-bold">Business assignment queue</h3>
                <p className="mt-1 text-sm text-slate-600">{manager ? "Assign an existing institution engagement to an active agent. Engagement onboarding arrives in Sprint 3." : "Only your own assignments for this institution appear here."}</p>
                {manager && <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/assignments`, "PUT", { engagementId, agentMemberId: assignmentAgent });
                  setEngagementId(""); await loadSelected(selected, platformAdmin, memberships);
                }, "Business assigned to agent."); }}>
                  <label><span className={label}>Institution engagement</span><select className={field} required value={engagementId} onChange={(e) => setEngagementId(e.target.value)}><option value="">Choose engagement</option>{engagements.map((row) => <option key={row.id} value={row.id}>{row.id.slice(0, 8)}… · {row.relationship_status}</option>)}</select></label>
                  <label><span className={label}>Active agent</span><select className={field} required value={assignmentAgent} onChange={(e) => setAssignmentAgent(e.target.value)}><option value="">Choose agent</option>{agents.filter((row) => row.member?.status === "active").map((row) => <option key={row.id} value={row.member_id}>{row.member?.users?.full_name || row.member?.users?.email || row.member_id}</option>)}</select></label>
                  <button className={button} disabled={working}>Assign</button>
                </form>}
                <div className="mt-5 space-y-2">{assignments.map((assignment) => <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                  <div><p className="font-semibold">Engagement {assignment.engagement_id.slice(0, 8)}…</p><p className="text-xs text-slate-500">Assigned {new Date(assignment.assigned_at).toLocaleDateString("en-NG")}</p></div>
                  {manager && <button className={secondary} disabled={working} onClick={() => void act(async () => {
                    await api(`/api/institutions/${selected}/assignments`, "PATCH", { engagementId: assignment.engagement_id, action: "revoke" });
                    await loadSelected(selected, platformAdmin, memberships);
                  }, "Assignment revoked.")}>Unassign</button>}
                </div>)}</div>
                {!assignments.length && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No active assignments in this institution yet.</p>}
              </section>
              {manager && <section className={card}>
                <h3 className="text-lg font-bold">Institution settings</h3>
                <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void act(async () => {
                  await api(`/api/institutions/${selected}/settings`, "PATCH", { key: "support_email", value: supportEmail });
                  await loadSelected(selected, platformAdmin, memberships);
                }, "Support contact saved."); }}>
                  <label className="min-w-56 flex-1"><span className={label}>Support email</span><input type="email" className={field} value={supportEmail} required onChange={(e) => setSupportEmail(e.target.value)} /></label>
                  <button className={button} disabled={working}>Save settings</button>
                </form>
                <p className="mt-3 text-xs text-slate-500">Settings and rosters remain scoped to this institution. Business passports require explicit sharing in a later sprint.</p>
              </section>}
            </>}
          </div>
        </div>
        </>
      )}
    </main>
  );
}
