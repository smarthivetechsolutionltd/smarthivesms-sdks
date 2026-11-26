# SmarthiveSMS Official SDKs

Official, developer-first SDKs for [SmarthiveSMS](https://smarthivesms.com) — Nigerian & African omnichannel messaging and telecom API for **Transactional DND-bypass SMS (TRX)**, **Marketing Bulk SMS (MKT)**, **WhatsApp OTP**, **Automated Voice OTP**, and **Transactional Email**.

## Packages

| Language | Package | Registry | Install |
| --- | --- | --- | --- |
| **Node.js / TypeScript** | [`smarthivesms`](./node) | [npm](https://www.npmjs.com/package/smarthivesms) | `npm install smarthivesms` |
| **Python (Sync & Async)** | [`smarthivesms`](./python) | [PyPI](https://pypi.org/project/smarthivesms/) | `pip install smarthivesms` |
| **AI Agents (MCP Server)** | `smarthivesms-mcp` | [npm](https://www.npmjs.com/package/smarthivesms-mcp) | `npx -y smarthivesms-mcp` |

## Free Developer Sandbox

Every SmarthiveSMS account includes a **₦50,000 auto-replenishing Developer Sandbox** with simulated carrier delivery receipts (DLRs). Just pass your `SMTSBX_...` API key to either SDK and test with zero wallet charges.

## Quick Start

### Node.js / TypeScript

```ts
import { SmarthiveSMS } from "smarthivesms";

const client = new SmarthiveSMS({ apiKey: process.env.SMARTHIVE_API_KEY });

await client.sms.send({
  sender: "MyApp",
  recipients: "2348012345678",
  msg: "Your verification code is 492041.",
  route: "TRX",
});
```

### Python

```python
import os
from smarthivesms import SmarthiveSMS

client = SmarthiveSMS(api_key=os.getenv("SMARTHIVE_API_KEY"))

client.sms.send(
    sender="MyApp",
    recipients="2348012345678",
    msg="Your verification code is 492041.",
    route="TRX",
)
```

## Links

- Website: https://smarthivesms.com
- API Documentation: https://docs.smarthivesms.com
- OpenAPI 3.1 Spec: https://smarthivesms.com/openapi.json
- Pricing (NGN / USD / EUR): https://smarthivesms.com/pricing
- Support: support@smarthivesms.com

## License

MIT © Smarthive Tech Solution
