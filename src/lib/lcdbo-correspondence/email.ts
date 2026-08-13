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
  readonly provider = "production_email_provider";

  async send(): Promise<CorrespondenceEmailResult> {
    throw new Error("LCDBO production email provider is not configured. Set the approved provider credentials before enabling live email dispatch.");
  }
}

export function createCorrespondenceEmailAdapter() {
  if (process.env.LCDBO_CORRESPONDENCE_EMAIL_ADAPTER === "production") {
    return new ProductionCorrespondenceEmailAdapter();
  }
  return new DeterministicCorrespondenceEmailAdapter();
}
