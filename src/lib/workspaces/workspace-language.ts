export type WorkspaceTermKey =
  | "programme"
  | "programmes"
  | "cohort"
  | "cohorts"
  | "intervention"
  | "interventions"
  | "assessment"
  | "assessments"
  | "evidence"
  | "analytics"
  | "reports"
  | "risk"
  | "participant"
  | "participants"
  | "intelligence"
  | "support";

export type WorkspaceLanguage = Record<WorkspaceTermKey, string>;

export const DEFAULT_WORKSPACE_LANGUAGE: WorkspaceLanguage = {
  programme: "Programme",
  programmes: "Programmes",
  cohort: "Cohort",
  cohorts: "Cohorts",
  intervention: "Intervention",
  interventions: "Interventions",
  assessment: "Assessment",
  assessments: "Assessments",
  evidence: "Evidence",
  analytics: "Analytics",
  reports: "Reports",
  risk: "Risk",
  participant: "Participant",
  participants: "Participants",
  intelligence: "Intelligence",
  support: "Support",
};

export function workspaceTerm(language: Partial<WorkspaceLanguage> | undefined, key: WorkspaceTermKey, options?: { lowercase?: boolean; plural?: boolean }) {
  const resolvedKey = options?.plural && !key.endsWith("s") ? `${key}s` as WorkspaceTermKey : key;
  const term = language?.[resolvedKey] ?? DEFAULT_WORKSPACE_LANGUAGE[resolvedKey] ?? DEFAULT_WORKSPACE_LANGUAGE[key];
  return options?.lowercase ? term.toLowerCase() : term;
}
