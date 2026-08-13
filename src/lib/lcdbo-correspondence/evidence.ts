export type CorrespondenceEvidenceStatus = "active" | "superseded" | "invalidated";
export type CorrespondenceEvidenceAction = "replace" | "invalidate" | "download";

export function canOperateDeliveryEvidence(status: CorrespondenceEvidenceStatus, action: CorrespondenceEvidenceAction) {
  if (action === "download") return status === "active";
  return status === "active";
}

export function assertDeliveryEvidenceOperation(status: CorrespondenceEvidenceStatus, action: CorrespondenceEvidenceAction) {
  if (!canOperateDeliveryEvidence(status, action)) {
    throw new Error(`Delivery evidence in ${status} status cannot be ${action}d.`);
  }
}
