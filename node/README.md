# smarthivesms (Official Node.js & TypeScript SDK)

Official Node.js and TypeScript SDK for [SmarthiveSMS](https://smarthivesms.com) — Nigerian & African omnichannel messaging API for **Transactional DND-bypass SMS (TRX)**, **Marketing Bulk SMS (MKT)**, **WhatsApp OTP**, **Automated Voice OTP**, and **Transactional Email**.

- Zero runtime dependencies (uses native `fetch` on Node 18+, Bun, Deno, Cloudflare Workers)
- Full TypeScript definitions + Dual ESM & CommonJS support
- Built-in support for the **free ₦50,000 auto-replenishing Developer Sandbox** (`SMTSBX_...` keys)
- Automatic retries on transient network / 5xx / 429 errors

## Installation

```bash
npm install smarthivesms
```

## Quick Start

```ts
import { SmarthiveSMS } from "smarthivesms";

// Reads SMARTHIVE_API_KEY automatically, or pass explicitly.
// Use a Sandbox key (SMTSBX_...) for free ₦50,000 simulated testing.
const client = new SmarthiveSMS({
  apiKey: process.env.SMARTHIVE_API_KEY,
});

// Send a DND-bypass Transactional OTP SMS
const sms = await client.sms.send({
  sender: "MyApp",
  recipients: "2348012345678",
  msg: "Your verification code is 492041.",
  route: "TRX",
});

console.log(sms.message_id);
```

## Usage Examples

### Bulk SMS

```ts
await client.sms.sendBulk({
  sender: "MyApp",
  recipients: ["2348012345678", "2348098765432"],
  msg: "Flash sale starts at noon!",
  route: "MKT",
});
```

### Check SMS Delivery Status (DLR)

```ts
const status = await client.sms.status("msg_9041284");
console.log(status.status); // DELIVRD | UNDELIV | PENDING
```

### WhatsApp OTP

```ts
await client.whatsapp.sendOtp({
  recipient: "2348012345678",
  code: "849204",
  sender: "MyApp",
});
```

### Automated Voice OTP

```ts
const call = await client.voice.sendOtp({
  phone: "2348012345678",
  otp: "8429",
});

const callStatus = await client.voice.status(call.call_id!);
```

### Transactional Email

```ts
await client.email.send({
  to: "user@example.com",
  subject: "Welcome to MyApp",
  html: "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
  from: "no-reply@myapp.com",
  fromName: "MyApp",
});
```

### Check Balance & Credits

```ts
const bal = await client.balance.get();
console.log(bal.balance, bal.sms_mkt_credits, bal.sms_trx_credits);
```

### Route-Specific API Keys

```ts
const client = new SmarthiveSMS({
  apiKeyMkt: process.env.SMARTHIVE_API_KEY_MKT,
  apiKeyTrx: process.env.SMARTHIVE_API_KEY_TRX,
});
```

### Error Handling

```ts
import {
  SmarthiveAuthError,
  SmarthiveValidationError,
  SmarthiveRateLimitError,
  SmarthiveError,
} from "smarthivesms";

try {
  await client.sms.send({ sender: "MyApp", recipients: "2348012345678", msg: "Hi", route: "TRX" });
} catch (err) {
  if (err instanceof SmarthiveAuthError) {
    console.error("Invalid API key:", err.message);
  } else if (err instanceof SmarthiveValidationError) {
    console.error("Validation error:", err.message);
  } else if (err instanceof SmarthiveRateLimitError) {
    console.error("Rate limited, retry after:", err.retryAfterSeconds);
  } else if (err instanceof SmarthiveError) {
    console.error("API error:", err.statusCode, err.message);
  }
}
```

## Documentation & Links

- API Docs: https://docs.smarthivesms.com
- Dashboard & Free Sandbox: https://app.smarthivesms.com/signup
- OpenAPI 3.1 Spec: https://smarthivesms.com/openapi.json
- Official MCP Server for AI Agents: `npx -y smarthivesms-mcp`

## License

MIT © Smarthive Tech Solution
