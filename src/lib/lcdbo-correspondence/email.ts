import { sha256Hex } from "@/lib/lcdbo-correspondence/security";

export type CorrespondenceEmailPayload = {
  recordId: string;
  reference: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  senderIdentity?: string | null;
  attachments?: Array<{ filename: string; content: string }>;
  idempotencyKey?: string;
};

export type CorrespondenceEmailResult = {
  provider: string;
  providerMessageId: string | null;
  status: "sent_to_provider" | "skipped";
  idempotencyKey: string;
};

export interface CorrespondenceEmailAdapter {
  readonly provider: string;
  send(payload: CorrespondenceEmailPayload): Promise<CorrespondenceEmailResult>;
}

export function correspondenceEmailIdempotencyKey(payload: CorrespondenceEmailPayload) {
  if (payload.idempotencyKey) return payload.idempotencyKey;
  return sha256Hex([
    payload.recordId,
    payload.reference,
    payload.subject,
    payload.to.join(","),
    payload.cc?.join(",") ?? "",
    payload.bcc?.join(",") ?? "",
  ].join("|"));
}

export class DeterministicCorrespondenceEmailAdapter implements CorrespondenceEmailAdapter {
  readonly provider = "deterministic_test_adapter";

  async send(payload: CorrespondenceEmailPayload): Promise<CorrespondenceEmailResult> {
    const idempotencyKey = correspondenceEmailIdempotencyKey(payload);
    return {
      provider: this.provider,
      providerMessageId: `test_${idempotencyKey.slice(0, 24)}`,
      status: "sent_to_provider",
      idempotencyKey,
    };
  }
}

export class ProductionCorrespondenceEmailAdapter implements CorrespondenceEmailAdapter {
  readonly provider = "resend";

  async send(payload: CorrespondenceEmailPayload): Promise<CorrespondenceEmailResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.LCDBO_CORRESPONDENCE_FROM_EMAIL?.trim();
    if (!apiKey || !from) throw new Error("LCDBO email dispatch is unavailable because RESEND_API_KEY or LCDBO_CORRESPONDENCE_FROM_EMAIL is not configured.");
    const idempotencyKey = correspondenceEmailIdempotencyKey(payload);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        cc: payload.cc?.length ? payload.cc : undefined,
        bcc: payload.bcc?.length ? payload.bcc : undefined,
        subject: payload.subject,
        text: payload.body,
        attachments: payload.attachments,
      }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error(`Email provider rejected the dispatch (${response.status}): ${result.message ?? "unknown provider error"}`);
    return { provider: this.provider, providerMessageId: result.id, status: "sent_to_provider", idempotencyKey };
  }
}

export function createCorrespondenceEmailAdapter() {
  if (process.env.NODE_ENV === "production" || process.env.LCDBO_CORRESPONDENCE_EMAIL_ADAPTER === "production") {
    return new ProductionCorrespondenceEmailAdapter();
  }
  return new DeterministicCorrespondenceEmailAdapter();
}
