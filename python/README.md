# smarthivesms (Official Python SDK)

Official Python SDK for [SmarthiveSMS](https://smarthivesms.com) — Nigerian & African omnichannel messaging API for **Transactional DND-bypass SMS (TRX)**, **Marketing Bulk SMS (MKT)**, **WhatsApp OTP**, **Automated Voice OTP**, and **Transactional Email**.

- Both **Synchronous (`SmarthiveSMS`)** and **Asynchronous (`AsyncSmarthiveSMS`)** clients powered by `httpx`
- Full type annotations (`py.typed`)
- Built-in support for the **free ₦50,000 auto-replenishing Developer Sandbox** (`SMTSBX_...` keys)
- Automatic retries on transient network / 5xx / 429 errors

## Installation

```bash
pip install smarthivesms
```

## Quick Start

```python
import os
from smarthivesms import SmarthiveSMS

# Reads SMARTHIVE_API_KEY automatically, or pass explicitly.
# Use a Sandbox key (SMTSBX_...) for free ₦50,000 simulated testing.
client = SmarthiveSMS(api_key=os.getenv("SMARTHIVE_API_KEY"))

# Send a DND-bypass Transactional OTP SMS
res = client.sms.send(
    sender="MyApp",
    recipients="2348012345678",
    msg="Your verification code is 492041.",
    route="TRX",
)
print(res["message_id"])
```

## Async Usage (FastAPI / asyncio)

```python
from smarthivesms import AsyncSmarthiveSMS

async with AsyncSmarthiveSMS(api_key="SMTSBX_your_sandbox_key") as client:
    res = await client.sms.send(
        sender="MyApp",
        recipients="2348012345678",
        msg="Your login code is 849204.",
        route="TRX",
    )
```

## Usage Examples

### Bulk SMS

```python
client.sms.send_bulk(
    sender="MyApp",
    recipients=["2348012345678", "2348098765432"],
    msg="Flash sale starts at noon!",
    route="MKT",
)
```

### Check SMS Delivery Status (DLR)

```python
status = client.sms.status("msg_9041284")
print(status["status"])  # DELIVRD | UNDELIV | PENDING
```

### WhatsApp OTP

```python
client.whatsapp.send_otp(
    recipient="2348012345678",
    code="849204",
    sender="MyApp",
)
```

### Automated Voice OTP

```python
call = client.voice.send_otp(phone="2348012345678", otp="8429")
status = client.voice.status(call["call_id"])
```

### Transactional Email

```python
client.email.send(
    to="user@example.com",
    subject="Welcome to MyApp",
    html="<h1>Welcome!</h1><p>Thanks for signing up.</p>",
    from_email="no-reply@myapp.com",
    from_name="MyApp",
)
```

### Check Balance & Credits

```python
bal = client.balance.get()
print(bal)
```

### Error Handling

```python
from smarthivesms import (
    SmarthiveAuthError,
    SmarthiveValidationError,
    SmarthiveRateLimitError,
    SmarthiveError,
)

try:
    client.sms.send(sender="MyApp", recipients="2348012345678", msg="Hi", route="TRX")
except SmarthiveAuthError as e:
    print("Invalid API key:", e.message)
except SmarthiveValidationError as e:
    print("Validation error:", e.message)
except SmarthiveRateLimitError as e:
    print("Rate limited, retry after:", e.retry_after)
except SmarthiveError as e:
    print("API error:", e.status_code, e.message)
```

## Documentation & Links

- API Docs: https://docs.smarthivesms.com
- Dashboard & Free Sandbox: https://app.smarthivesms.com/signup
- OpenAPI 3.1 Spec: https://smarthivesms.com/openapi.json
- Official MCP Server for AI Agents: `npx -y smarthivesms-mcp`

## License

MIT © Smarthive Tech Solution
