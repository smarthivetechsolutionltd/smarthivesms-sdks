import {
  SmarthiveAuthError,
  SmarthiveError,
  SmarthiveRateLimitError,
  SmarthiveValidationError,
} from "./errors.js";
import type {
  BalanceResponse,
  SendBulkSmsParams,
  SendBulkSmsResponse,
  SendEmailParams,
  SendEmailResponse,
  SendSmsParams,
  SendSmsResponse,
  SendVoiceOtpParams,
  SendVoiceOtpResponse,
  SendWhatsappOtpParams,
  SendWhatsappOtpResponse,
  SmarthiveConfig,
  SmsRoute,
  SmsStatusResponse,
  VoiceStatusResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.smarthivesms.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const SDK_USER_AGENT = "smarthivesms-node/1.0.1";

function getEnv(name: string): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[name];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "msg"]) {
      if (typeof obj[key] === "string" && obj[key].trim().length > 0) {
        return obj[key] as string;
      }
    }
  }
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  return fallback;
}

export class SmarthiveSMS {
  public readonly baseUrl: string;
  public readonly timeoutMs: number;
  public readonly maxRetries: number;
  private readonly defaultApiKey: string;
  private readonly mktApiKey?: string;
  private readonly trxApiKey?: string;
  private readonly intlApiKey?: string;
  private readonly fetchFn: typeof globalThis.fetch;

  public readonly sms: {
    send: (params: SendSmsParams) => Promise<SendSmsResponse>;
    sendBulk: (params: SendBulkSmsParams) => Promise<SendBulkSmsResponse>;
    status: (messageId: string, apiKey?: string) => Promise<SmsStatusResponse>;
  };

  public readonly balance: {
    get: (apiKey?: string) => Promise<BalanceResponse>;
  };

  public readonly whatsapp: {
    sendOtp: (params: SendWhatsappOtpParams) => Promise<SendWhatsappOtpResponse>;
  };

  public readonly voice: {
    sendOtp: (params: SendVoiceOtpParams) => Promise<SendVoiceOtpResponse>;
    status: (callId: string, apiKey?: string) => Promise<VoiceStatusResponse>;
  };

  public readonly email: {
    send: (params: SendEmailParams) => Promise<SendEmailResponse>;
  };

  constructor(config?: SmarthiveConfig | string) {
    if (typeof config === "string") {
      this.defaultApiKey = config;
      this.mktApiKey = getEnv("SMARTHIVE_API_KEY_MKT");
      this.trxApiKey = getEnv("SMARTHIVE_API_KEY_TRX");
      this.intlApiKey = getEnv("SMARTHIVE_API_KEY_INTL");
      this.baseUrl = DEFAULT_BASE_URL;
      this.timeoutMs = DEFAULT_TIMEOUT_MS;
      this.maxRetries = DEFAULT_MAX_RETRIES;
      this.fetchFn = globalThis.fetch;
    } else {
      this.defaultApiKey = config?.apiKey ?? getEnv("SMARTHIVE_API_KEY") ?? "";
      this.mktApiKey = config?.apiKeyMkt ?? getEnv("SMARTHIVE_API_KEY_MKT");
      this.trxApiKey = config?.apiKeyTrx ?? getEnv("SMARTHIVE_API_KEY_TRX");
      this.intlApiKey = config?.apiKeyIntl ?? getEnv("SMARTHIVE_API_KEY_INTL");
      this.baseUrl = (config?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
      this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      this.maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
      this.fetchFn = config?.fetch ?? globalThis.fetch;
    }

    if (typeof this.fetchFn !== "function") {
      throw new SmarthiveError(
        "No fetch implementation available. Use Node.js 18+ or pass a custom `fetch` option."
      );
    }

    this.sms = {
      send: (params) => this.sendSms(params),
      sendBulk: (params) => this.sendBulkSms(params),
      status: (messageId, apiKey) => this.checkSmsStatus(messageId, apiKey),
    };

    this.balance = {
      get: (apiKey) => this.getBalance(apiKey),
    };

    this.whatsapp = {
      sendOtp: (params) => this.sendWhatsappOtp(params),
    };

    this.voice = {
      sendOtp: (params) => this.sendVoiceOtp(params),
      status: (callId, apiKey) => this.checkVoiceStatus(callId, apiKey),
    };

    this.email = {
      send: (params) => this.sendEmail(params),
    };
  }

  /** Returns true when the configured default key is a SmarthiveSMS Sandbox key (`SMTSBX_...`). */
  public get isSandbox(): boolean {
    const key = this.resolveKey();
    return key.startsWith("SMTSBX_");
  }

  public resolveKey(route?: SmsRoute | string, explicitKey?: string): string {
    if (explicitKey) return explicitKey;
    const normalized = (route ?? "").toUpperCase();
    if (normalized === "TRX" && this.trxApiKey) return this.trxApiKey;
    if (normalized === "MKT" && this.mktApiKey) return this.mktApiKey;
    if (normalized === "INTL" && this.intlApiKey) return this.intlApiKey;
    return this.defaultApiKey || this.trxApiKey || this.mktApiKey || this.intlApiKey || "";
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: {
      body?: Record<string, unknown>;
      apiKey: string;
    }
  ): Promise<T> {
    const key = options.apiKey;
    const isSandbox = key.startsWith("SMTSBX_");

    if (!key) {
      throw new SmarthiveAuthError(
        "Missing SmarthiveSMS API key. Pass `apiKey` to `new SmarthiveSMS({ apiKey })` or set `SMARTHIVE_API_KEY`.",
        401,
        undefined,
        false
      );
    }

    const url = `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchFn(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "User-Agent": SDK_USER_AGENT,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        const rawText = await res.text();
        let data: unknown = rawText;
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          // Keep raw text when response is non-JSON
        }

        if (res.ok) {
          return data as T;
        }

        const message = extractErrorMessage(data, `Request failed with HTTP ${res.status}`);

        if (res.status === 401 || res.status === 403) {
          throw new SmarthiveAuthError(message, res.status, data, isSandbox);
        }

        if (res.status === 400 || res.status === 422) {
          throw new SmarthiveValidationError(message, res.status, data, isSandbox);
        }

        if (res.status === 429) {
          const retryHeader = res.headers.get("retry-after");
          const retryAfter = retryHeader ? Number(retryHeader) : undefined;
          const err = new SmarthiveRateLimitError(
            message,
            res.status,
            data,
            Number.isFinite(retryAfter) ? retryAfter : undefined,
            isSandbox
          );
          if (attempt < this.maxRetries) {
            await sleep((err.retryAfterSeconds ?? 2 ** attempt) * 1000);
            continue;
          }
          throw err;
        }

        const err = new SmarthiveError(message, res.status, data, isSandbox);
        if (res.status >= 500 && attempt < this.maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw err;
      } catch (err) {
        clearTimeout(timer);
        if (
          err instanceof SmarthiveAuthError ||
          err instanceof SmarthiveValidationError ||
          err instanceof SmarthiveRateLimitError ||
          (err instanceof SmarthiveError && err.statusCode > 0 && err.statusCode < 500)
        ) {
          throw err;
        }
        lastError = err;
        if (attempt < this.maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
      }
    }

    if (lastError instanceof SmarthiveError) {
      throw lastError;
    }

    const msg =
      lastError instanceof Error ? lastError.message : "Network request to SmarthiveSMS failed";
    throw new SmarthiveError(msg, 0, lastError, isSandbox);
  }

  public async getBalance(apiKey?: string): Promise<BalanceResponse> {
    return this.request<BalanceResponse>("GET", "/api/sms/credit", {
      apiKey: this.resolveKey(undefined, apiKey),
    });
  }

  public async sendSms(params: SendSmsParams): Promise<SendSmsResponse> {
    const body: Record<string, unknown> = {
      sender: params.sender,
      recipients: params.recipients,
      msg: params.msg,
      route: params.route ?? "MKT",
      type: params.type ?? 1,
    };
    if (params.ext_ref !== undefined) {
      body.ext_ref = params.ext_ref;
    }
    return this.request<SendSmsResponse>("POST", "/api/sms/send", {
      body,
      apiKey: this.resolveKey(params.route ?? "MKT", params.apiKey),
    });
  }

  public async sendBulkSms(params: SendBulkSmsParams): Promise<SendBulkSmsResponse> {
    const recipientsStr = Array.isArray(params.recipients)
      ? params.recipients.join(",")
      : params.recipients;

    return this.request<SendBulkSmsResponse>("POST", "/api/sms/send/multi", {
      body: {
        sender: params.sender,
        recipients: recipientsStr,
        msg: params.msg,
        route: params.route ?? "MKT",
        type: params.type ?? 1,
      },
      apiKey: this.resolveKey(params.route ?? "MKT", params.apiKey),
    });
  }

  public async checkSmsStatus(messageId: string, apiKey?: string): Promise<SmsStatusResponse> {
    return this.request<SmsStatusResponse>("POST", "/api/sms/status", {
      body: { message_id: messageId },
      apiKey: this.resolveKey(undefined, apiKey),
    });
  }

  public async sendWhatsappOtp(params: SendWhatsappOtpParams): Promise<SendWhatsappOtpResponse> {
    return this.request<SendWhatsappOtpResponse>("POST", "/api/whatsapp/send", {
      body: {
        recipient: params.recipient,
        code: params.code,
        sender: params.sender ?? "SmarthiveSMS",
      },
      apiKey: this.resolveKey(undefined, params.apiKey),
    });
  }

  public async sendVoiceOtp(params: SendVoiceOtpParams): Promise<SendVoiceOtpResponse> {
    return this.request<SendVoiceOtpResponse>("POST", "/api/voice/otp", {
      body: {
        phone: params.phone,
        otp: params.otp,
      },
      apiKey: this.resolveKey(undefined, params.apiKey),
    });
  }

  public async checkVoiceStatus(callId: string, apiKey?: string): Promise<VoiceStatusResponse> {
    return this.request<VoiceStatusResponse>(
      "GET",
      `/api/voice/status/${encodeURIComponent(callId)}`,
      {
        apiKey: this.resolveKey(undefined, apiKey),
      }
    );
  }

  public async sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
    return this.request<SendEmailResponse>("POST", "/api/email/campaign/send_campaign", {
      body: {
        name: params.name ?? "Transactional Email",
        from: params.from ?? "support@smarthivesms.com",
        fromName: params.fromName ?? "Smarthive Notification",
        to: params.to,
        subject: params.subject,
        html: params.html,
      },
      apiKey: this.resolveKey(undefined, params.apiKey),
    });
  }
}
