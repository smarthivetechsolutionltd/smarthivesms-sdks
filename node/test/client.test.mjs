import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SmarthiveSMS,
  SmarthiveAuthError,
  SmarthiveValidationError,
  SmarthiveRateLimitError,
} from "../dist/index.mjs";

function mockFetch(handler) {
  return async (url, init) => {
    const result = await handler(url, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      headers: new Headers(result.headers || {}),
      text: async () =>
        typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? {}),
    };
  };
}

describe("SmarthiveSMS Node.js SDK", () => {
  it("detects sandbox keys automatically", () => {
    const sandbox = new SmarthiveSMS({ apiKey: "SMTSBX_test_123" });
    const live = new SmarthiveSMS({ apiKey: "SMT_live_123" });
    assert.equal(sandbox.isSandbox, true);
    assert.equal(live.isSandbox, false);
  });

  it("sends single SMS with TRX route-specific key", async () => {
    let captured;
    const client = new SmarthiveSMS({
      apiKey: "default_key",
      apiKeyTrx: "trx_key",
      fetch: mockFetch((url, init) => {
        captured = { url, headers: init.headers, body: JSON.parse(init.body) };
        return { status: 200, body: { status: "success", message_id: "msg_1", cost: 1 } };
      }),
    });

    const res = await client.sms.send({
      sender: "MyApp",
      recipients: "2348012345678",
      msg: "Your OTP is 492041",
      route: "TRX",
      ext_ref: "ref_01",
    });

    assert.equal(res.status, "success");
    assert.equal(res.message_id, "msg_1");
    assert.equal(captured.url, "https://api.smarthivesms.com/api/sms/send");
    assert.equal(captured.headers["x-api-key"], "trx_key");
    assert.deepEqual(captured.body, {
      sender: "MyApp",
      recipients: "2348012345678",
      msg: "Your OTP is 492041",
      route: "TRX",
      type: 1,
      ext_ref: "ref_01",
    });
  });

  it("joins recipient arrays for bulk SMS", async () => {
    let capturedBody;
    const client = new SmarthiveSMS({
      apiKey: "SMTSBX_key",
      fetch: mockFetch((_url, init) => {
        capturedBody = JSON.parse(init.body);
        return { status: 200, body: { status: "success", total_sent: 2 } };
      }),
    });

    const res = await client.sms.sendBulk({
      sender: "MyApp",
      recipients: ["2348012345678", "2348098765432"],
      msg: "Hello!",
    });

    assert.equal(res.total_sent, 2);
    assert.equal(capturedBody.recipients, "2348012345678,2348098765432");
  });

  it("checks balance, SMS status, WhatsApp OTP, Voice OTP, Voice status, and Email", async () => {
    const calls = [];
    const client = new SmarthiveSMS({
      apiKey: "SMTSBX_key",
      fetch: mockFetch((url, init) => {
        calls.push({ method: init.method, url });
        return { status: 200, body: { status: "success" } };
      }),
    });

    await client.balance.get();
    await client.sms.status("msg_123");
    await client.whatsapp.sendOtp({ recipient: "2348012345678", code: "849204" });
    await client.voice.sendOtp({ phone: "2348012345678", otp: "8429" });
    await client.voice.status("call_999");
    await client.email.send({
      to: "dev@example.com",
      subject: "Welcome",
      html: "<p>Hello</p>",
    });

    assert.deepEqual(
      calls.map((c) => `${c.method} ${new URL(c.url).pathname}`),
      [
        "GET /api/sms/credit",
        "POST /api/sms/status",
        "POST /api/whatsapp/send",
        "POST /api/voice/otp",
        "GET /api/voice/status/call_999",
        "POST /api/email/campaign/send_campaign",
      ]
    );
  });

  it("throws typed errors for 401, 400, and 429", async () => {
    const authClient = new SmarthiveSMS({
      apiKey: "bad_key",
      maxRetries: 0,
      fetch: mockFetch(() => ({ status: 401, body: { message: "Invalid API key" } })),
    });
    await assert.rejects(() => authClient.balance.get(), SmarthiveAuthError);

    const valClient = new SmarthiveSMS({
      apiKey: "valid_key",
      maxRetries: 0,
      fetch: mockFetch(() => ({ status: 400, body: { message: "Missing sender" } })),
    });
    await assert.rejects(
      () => valClient.sms.send({ sender: "", recipients: "234", msg: "Hi" }),
      SmarthiveValidationError
    );

    const rateClient = new SmarthiveSMS({
      apiKey: "valid_key",
      maxRetries: 0,
      fetch: mockFetch(() => ({
        status: 429,
        headers: { "retry-after": "3" },
        body: { message: "Too many requests" },
      })),
    });
    await assert.rejects(() => rateClient.balance.get(), SmarthiveRateLimitError);
  });

  it("retries transient 5xx responses and succeeds", async () => {
    let attempts = 0;
    const client = new SmarthiveSMS({
      apiKey: "valid_key",
      maxRetries: 2,
      fetch: mockFetch(() => {
        attempts += 1;
        if (attempts === 1) {
          return { status: 503, body: { message: "Service unavailable" } };
        }
        return { status: 200, body: { balance: 50000 } };
      }),
    });

    const res = await client.balance.get();
    assert.equal(attempts, 2);
    assert.equal(res.balance, 50000);
  });
});
