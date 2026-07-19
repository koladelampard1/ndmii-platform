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
  | "risk";

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
};

export function workspaceTerm(language: Partial<WorkspaceLanguage> | undefined, key: WorkspaceTermKey) {
  return language?.[key] ?? DEFAULT_WORKSPACE_LANGUAGE[key];
}
