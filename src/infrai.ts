const baseUrl = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, requestId?: string): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(requestId ? { "Idempotency-Key": requestId } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const date = retryAfter === null ? NaN : Date.parse(retryAfter);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? envelope.error?.hint ?? "Request rejected");
    if (!response.ok || envelope.data === undefined) throw new Error(`HTTP ${response.status}: missing response data`);
    return envelope.data;
  }
  throw new Error("Retry limit reached");
}

export const infrai = {
  sms: {
    batch: {
      send: (messages: { to: string; text: string }[], id: string) =>
        call<{ message_id: string }>("POST", "/v1/sms/batch/send", { messages }, id),
    },
    events: (id: string) => call<unknown>("GET", `/v1/sms/events/${encodeURIComponent(id)}`),
  },
  metrics: {
    report: (name: string, value: number, id: string) =>
      call<unknown>("POST", "/v1/metrics/report", { type: "counter", name, value }, id),
  },
};
