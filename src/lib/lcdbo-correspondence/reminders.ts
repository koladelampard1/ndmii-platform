import type { LcdboCorrespondenceRecord } from "@/lib/lcdbo-correspondence/types";

export type PlannedCorrespondenceJob = {
  recordId: string | null;
  jobType: string;
  idempotencyKey: string;
  recipientUserId: string | null;
  scheduledFor: string;
  metadata: Record<string, unknown>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(target: string, now: Date) {
  return Math.ceil((new Date(target).getTime() - now.getTime()) / DAY_MS);
}

export function planCorrespondenceReminderJobs(records: Pick<LcdboCorrespondenceRecord, "id" | "reference" | "status" | "due_at" | "response_required" | "response_due_at" | "current_assignee_id" | "owner_id">[], now = new Date()): PlannedCorrespondenceJob[] {
  const jobs: PlannedCorrespondenceJob[] = [];
  const scheduledFor = now.toISOString();

  for (const record of records) {
    if (record.due_at && ["in_review", "awaiting_approval"].includes(record.status)) {
      const days = daysUntil(record.due_at, now);
      const jobType = days < 0 ? `${record.status === "in_review" ? "review" : "approval"}_overdue` : days <= 1 ? `${record.status === "in_review" ? "review" : "approval"}_due_soon` : null;
      if (jobType) {
        jobs.push({
          recordId: record.id,
          jobType,
          idempotencyKey: `${jobType}:${record.id}:${now.toISOString().slice(0, 10)}`,
          recipientUserId: record.current_assignee_id ?? record.owner_id ?? null,
          scheduledFor,
          metadata: { reference: record.reference, due_at: record.due_at },
        });
      }
    }

    if (record.status === "awaiting_signature") {
      jobs.push({
        recordId: record.id,
        jobType: "awaiting_signature",
        idempotencyKey: `awaiting_signature:${record.id}:${now.toISOString().slice(0, 10)}`,
        recipientUserId: record.current_assignee_id ?? record.owner_id ?? null,
        scheduledFor,
        metadata: { reference: record.reference },
      });
    }

    if (record.status === "delivery_failed") {
      jobs.push({
        recordId: record.id,
        jobType: "delivery_failure",
        idempotencyKey: `delivery_failure:${record.id}:${now.toISOString().slice(0, 10)}`,
        recipientUserId: record.owner_id ?? record.current_assignee_id ?? null,
        scheduledFor,
        metadata: { reference: record.reference },
      });
    }

    if (record.response_required && record.response_due_at && !["response_received", "closed", "cancelled", "revoked"].includes(record.status)) {
      const days = daysUntil(record.response_due_at, now);
      const jobType = days < 0 ? "response_overdue" : days <= 1 ? "response_due_one_day" : days <= 3 ? "response_due_three_days" : null;
      if (jobType) {
        jobs.push({
          recordId: record.id,
          jobType,
          idempotencyKey: `${jobType}:${record.id}:${now.toISOString().slice(0, 10)}`,
          recipientUserId: record.owner_id ?? record.current_assignee_id ?? null,
          scheduledFor,
          metadata: { reference: record.reference, response_due_at: record.response_due_at },
        });
      }
    }
  }

  return jobs;
}
