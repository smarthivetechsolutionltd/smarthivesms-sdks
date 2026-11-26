export type SmsRoute = "MKT" | "TRX" | "INTL";

export interface SmarthiveConfig {
  /** Default API key (live or `SMTSBX_...` sandbox key). Falls back to `SMARTHIVE_API_KEY`. */
  apiKey?: string;
  /** Optional Marketing (MKT) route-specific API key. Falls back to `SMARTHIVE_API_KEY_MKT`. */
  apiKeyMkt?: string;
  /** Optional Transactional (TRX / DND-bypass) route-specific API key. Falls back to `SMARTHIVE_API_KEY_TRX`. */
  apiKeyTrx?: string;
  /** Optional International (INTL) route-specific API key. Falls back to `SMARTHIVE_API_KEY_INTL`. */
  apiKeyIntl?: string;
  /** Base API URL. Defaults to `https://api.smarthivesms.com`. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to `30000`. */
  timeoutMs?: number;
  /** Max automatic retries for transient network, 429, or 5xx responses. Defaults to `2`. */
  maxRetries?: number;
  /** Optional custom `fetch` implementation (useful for testing or custom runtimes). */
  fetch?: typeof globalThis.fetch;
}

export interface BalanceResponse {
  balance?: number;
  sms_mkt_credits?: number;
  sms_trx_credits?: number;
  sandbox_balance?: number;
  [key: string]: unknown;
}

export interface SendSmsParams {
  /** Approved alphanumeric Sender ID (e.g. `Smarthive`, `MyApp`). */
  sender: string;
  /** Recipient phone number in E.164 without `+` or local format (e.g. `2348012345678`). */
  recipients: string;
  /** SMS text body. */
  msg: string;
  /** Routing channel: `"TRX"` (DND-bypass OTP/alerts), `"MKT"` (marketing), or `"INTL"`. Defaults to `"MKT"`. */
  route?: SmsRoute;
  /** `1` = Plain text GSM-7 (default), `2` = Unicode. */
  type?: 1 | 2;
  /** Optional external correlation reference ID. */
  ext_ref?: string;
  /** Optional per-request API key override. */
  apiKey?: string;
}

export interface SendSmsResponse {
  status?: string;
  message_id?: string;
  cost?: number;
  [key: string]: unknown;
}

export interface SendBulkSmsParams {
  /** Approved alphanumeric Sender ID. */
  sender: string;
  /** Array of phone numbers or comma-separated string. */
  recipients: string | string[];
  /** SMS text body. */
  msg: string;
  /** Routing channel (`"MKT"`, `"TRX"`, or `"INTL"`). Defaults to `"MKT"`. */
  route?: SmsRoute;
  /** `1` = Plain text (default), `2` = Unicode. */
  type?: 1 | 2;
  /** Optional per-request API key override. */
  apiKey?: string;
}

export interface SendBulkSmsResponse {
  status?: string;
  total_sent?: number;
  [key: string]: unknown;
}

export interface SmsStatusResponse {
  message_id?: string;
  status?: "DELIVRD" | "UNDELIV" | "EXPIRED" | "REJECTD" | "PENDING" | string;
  recipient?: string;
  delivered_at?: string;
  [key: string]: unknown;
}

export interface SendWhatsappOtpParams {
  /** Recipient WhatsApp phone number (e.g. `2348012345678`). */
  recipient: string;
  /** Verification OTP code (e.g. `"849204"`). */
  code: string;
  /** Brand / sender name. Defaults to `"SmarthiveSMS"`. */
  sender?: string;
  /** Optional per-request API key override. */
  apiKey?: string;
}

export interface SendWhatsappOtpResponse {
  status?: string;
  message_id?: string;
  [key: string]: unknown;
}

export interface SendVoiceOtpParams {
  /** Recipient phone number (e.g. `2348012345678`). */
  phone: string;
  /** Numeric OTP code read out during the automated voice call. */
  otp: string;
  /** Optional per-request API key override. */
  apiKey?: string;
}

export interface SendVoiceOtpResponse {
  status?: string;
  call_id?: string;
  [key: string]: unknown;
}

export interface VoiceStatusResponse {
  call_id?: string;
  status?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface SendEmailParams {
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** HTML email content. */
  html: string;
  /** Verified sender email address. Defaults to `"support@smarthivesms.com"`. */
  from?: string;
  /** Sender display name. Defaults to `"Smarthive Notification"`. */
  fromName?: string;
  /** Optional campaign/email label. Defaults to `"Transactional Email"`. */
  name?: string;
  /** Optional per-request API key override. */
  apiKey?: string;
}

export interface SendEmailResponse {
  status?: string;
  message_id?: string;
  [key: string]: unknown;
}
