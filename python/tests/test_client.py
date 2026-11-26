import json
import httpx
import pytest

from smarthivesms import (
    AsyncSmarthiveSMS,
    SmarthiveAuthError,
    SmarthiveRateLimitError,
    SmarthiveSMS,
    SmarthiveValidationError,
)


def test_sandbox_detection():
    assert SmarthiveSMS("SMTSBX_test_123").is_sandbox is True
    assert SmarthiveSMS("SMT_live_123").is_sandbox is False


def test_sync_send_sms_with_trx_key():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["key"] = request.headers.get("x-api-key")
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"status": "success", "message_id": "msg_1", "cost": 1})

    http = httpx.Client(base_url="https://api.smarthivesms.com", transport=httpx.MockTransport(handler))
    with SmarthiveSMS("default_key", api_key_trx="trx_key", http_client=http) as client:
        res = client.sms.send(
            sender="MyApp",
            recipients="2348012345678",
            msg="Your OTP is 492041",
            route="TRX",
            ext_ref="ref_01",
        )

    assert res["message_id"] == "msg_1"
    assert captured["url"] == "https://api.smarthivesms.com/api/sms/send"
    assert captured["key"] == "trx_key"
    assert captured["body"] == {
        "sender": "MyApp",
        "recipients": "2348012345678",
        "msg": "Your OTP is 492041",
        "route": "TRX",
        "type": 1,
        "ext_ref": "ref_01",
    }


def test_sync_all_endpoints():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        return httpx.Response(200, json={"status": "success"})

    http = httpx.Client(base_url="https://api.smarthivesms.com", transport=httpx.MockTransport(handler))
    client = SmarthiveSMS("SMTSBX_key", http_client=http)

    client.balance.get()
    client.sms.send_bulk(sender="MyApp", recipients=["2348012345678", "2348098765432"], msg="Hi")
    client.sms.status("msg_123")
    client.whatsapp.send_otp(recipient="2348012345678", code="849204")
    client.voice.send_otp(phone="2348012345678", otp="8429")
    client.voice.status("call_999")
    client.email.send(to="dev@example.com", subject="Welcome", html="<p>Hello</p>")

    assert calls == [
        "GET /api/sms/credit",
        "POST /api/sms/send/multi",
        "POST /api/sms/status",
        "POST /api/whatsapp/send",
        "POST /api/voice/otp",
        "GET /api/voice/status/call_999",
        "POST /api/email/campaign/send_campaign",
    ]


def test_typed_errors_and_retry():
    def auth_handler(_req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "Invalid API key"})

    with pytest.raises(SmarthiveAuthError):
        SmarthiveSMS(
            "bad",
            max_retries=0,
            http_client=httpx.Client(
                base_url="https://api.smarthivesms.com",
                transport=httpx.MockTransport(auth_handler),
            ),
        ).balance.get()

    def val_handler(_req: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"message": "Missing sender"})

    with pytest.raises(SmarthiveValidationError):
        SmarthiveSMS(
            "ok",
            max_retries=0,
            http_client=httpx.Client(
                base_url="https://api.smarthivesms.com",
                transport=httpx.MockTransport(val_handler),
            ),
        ).sms.send(sender="", recipients="234", msg="Hi")

    def rate_handler(_req: httpx.Request) -> httpx.Response:
        return httpx.Response(429, headers={"retry-after": "2"}, json={"message": "Slow down"})

    with pytest.raises(SmarthiveRateLimitError):
        SmarthiveSMS(
            "ok",
            max_retries=0,
            http_client=httpx.Client(
                base_url="https://api.smarthivesms.com",
                transport=httpx.MockTransport(rate_handler),
            ),
        ).balance.get()

    attempts = {"n": 0}

    def retry_handler(_req: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(503, json={"message": "Unavailable"})
        return httpx.Response(200, json={"balance": 50000})

    res = SmarthiveSMS(
        "ok",
        max_retries=2,
        http_client=httpx.Client(
            base_url="https://api.smarthivesms.com",
            transport=httpx.MockTransport(retry_handler),
        ),
    ).balance.get()
    assert attempts["n"] == 2
    assert res["balance"] == 50000


@pytest.mark.asyncio
async def test_async_client():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "queued", "call_id": "call_async_1"})

    http = httpx.AsyncClient(
        base_url="https://api.smarthivesms.com",
        transport=httpx.MockTransport(handler),
    )
    async with AsyncSmarthiveSMS("SMTSBX_key", http_client=http) as client:
        res = await client.voice.send_otp(phone="2348012345678", otp="8429")
    assert res["call_id"] == "call_async_1"
