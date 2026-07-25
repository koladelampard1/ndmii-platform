import type { WorkspaceDataClassification } from "@/lib/workspaces/workspace-types";

export type WorkspaceDataClassificationMeta = {
  classification: WorkspaceDataClassification;
  label: string;
  description?: string;
  updatedAt?: string;
  source?: string;
};

export const WORKSPACE_CLASSIFICATION_LABELS: Record<WorkspaceDataClassification, string> = {
  operational: "Operational Data",
  reference: "Reference Dataset",
  estimate: "Governed Estimate",
  target: "Configured Target",
  aggregate: "Aggregate Intelligence",
  public: "Public Information",
  external: "External Integration Data",
  unavailable: "Unavailable Data",
};

export function workspaceClassification(input: WorkspaceDataClassification | WorkspaceDataClassificationMeta): WorkspaceDataClassificationMeta {
  if (typeof input === "string") {
    return {
      classification: input,
      label: WORKSPACE_CLASSIFICATION_LABELS[input],
    };
  }
  return {
    ...input,
    label: input.label || WORKSPACE_CLASSIFICATION_LABELS[input.classification],
  };
}
