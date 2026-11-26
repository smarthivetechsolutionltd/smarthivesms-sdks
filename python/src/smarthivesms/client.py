from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Dict, Literal, Optional, Sequence, Union
from urllib.parse import quote

import httpx

from .errors import (
    SmarthiveAuthError,
    SmarthiveError,
    SmarthiveRateLimitError,
    SmarthiveValidationError,
)

SmsRoute = Literal["MKT", "TRX", "INTL"]

DEFAULT_BASE_URL = "https://api.smarthivesms.com"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 2
SDK_USER_AGENT = "smarthivesms-python/1.0.0"


def _extract_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        for key in ("message", "error", "detail", "msg"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                return val
    if isinstance(payload, str) and payload.strip():
        return payload
    return fallback


def _parse_response(response: httpx.Response) -> Any:
    if not response.text:
        return {}
    try:
        return response.json()
    except ValueError:
        return response.text


def _parse_retry_after(response: httpx.Response) -> Optional[float]:
    raw = response.headers.get("retry-after")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


class _BaseClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        api_key_mkt: Optional[str] = None,
        api_key_trx: Optional[str] = None,
        api_key_intl: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._default_api_key = api_key if api_key is not None else os.getenv("SMARTHIVE_API_KEY", "")
        self._mkt_api_key = api_key_mkt if api_key_mkt is not None else os.getenv("SMARTHIVE_API_KEY_MKT")
        self._trx_api_key = api_key_trx if api_key_trx is not None else os.getenv("SMARTHIVE_API_KEY_TRX")
        self._intl_api_key = api_key_intl if api_key_intl is not None else os.getenv("SMARTHIVE_API_KEY_INTL")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_sandbox(self) -> bool:
        """True when the resolved default API key is a SmarthiveSMS Sandbox key (`SMTSBX_...`)."""
        return self.resolve_key().startswith("SMTSBX_")

    def resolve_key(self, route: Optional[str] = None, explicit_key: Optional[str] = None) -> str:
        if explicit_key:
            return explicit_key
        normalized = (route or "").upper()
        if normalized == "TRX" and self._trx_api_key:
            return self._trx_api_key
        if normalized == "MKT" and self._mkt_api_key:
            return self._mkt_api_key
        if normalized == "INTL" and self._intl_api_key:
            return self._intl_api_key
        return (
            self._default_api_key
            or self._trx_api_key
            or self._mkt_api_key
            or self._intl_api_key
            or ""
        )

    def _build_headers(self, key: str) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-api-key": key,
            "User-Agent": SDK_USER_AGENT,
        }


class _SmsResource:
    def __init__(self, client: SmarthiveSMS) -> None:
        self._client = client

    def send(
        self,
        *,
        sender: str,
        recipients: str,
        msg: str,
        route: SmsRoute = "MKT",
        type: int = 1,
        ext_ref: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "sender": sender,
            "recipients": recipients,
            "msg": msg,
            "route": route,
            "type": type,
        }
        if ext_ref is not None:
            payload["ext_ref"] = ext_ref
        return self._client._request(
            "POST",
            "/api/sms/send",
            json_body=payload,
            api_key=self._client.resolve_key(route, api_key),
        )

    def send_bulk(
        self,
        *,
        sender: str,
        recipients: Union[str, Sequence[str]],
        msg: str,
        route: SmsRoute = "MKT",
        type: int = 1,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        recipients_str = recipients if isinstance(recipients, str) else ",".join(recipients)
        return self._client._request(
            "POST",
            "/api/sms/send/multi",
            json_body={
                "sender": sender,
                "recipients": recipients_str,
                "msg": msg,
                "route": route,
                "type": type,
            },
            api_key=self._client.resolve_key(route, api_key),
        )

    def status(self, message_id: str, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return self._client._request(
            "POST",
            "/api/sms/status",
            json_body={"message_id": message_id},
            api_key=self._client.resolve_key(None, api_key),
        )


class _BalanceResource:
    def __init__(self, client: SmarthiveSMS) -> None:
        self._client = client

    def get(self, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return self._client._request(
            "GET",
            "/api/sms/credit",
            api_key=self._client.resolve_key(None, api_key),
        )


class _WhatsappResource:
    def __init__(self, client: SmarthiveSMS) -> None:
        self._client = client

    def send_otp(
        self,
        *,
        recipient: str,
        code: str,
        sender: str = "SmarthiveSMS",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._client._request(
            "POST",
            "/api/whatsapp/send",
            json_body={"recipient": recipient, "code": code, "sender": sender},
            api_key=self._client.resolve_key(None, api_key),
        )


class _VoiceResource:
    def __init__(self, client: SmarthiveSMS) -> None:
        self._client = client

    def send_otp(
        self,
        *,
        phone: str,
        otp: str,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._client._request(
            "POST",
            "/api/voice/otp",
            json_body={"phone": phone, "otp": otp},
            api_key=self._client.resolve_key(None, api_key),
        )

    def status(self, call_id: str, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return self._client._request(
            "GET",
            f"/api/voice/status/{quote(call_id, safe='')}",
            api_key=self._client.resolve_key(None, api_key),
        )


class _EmailResource:
    def __init__(self, client: SmarthiveSMS) -> None:
        self._client = client

    def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        from_email: str = "support@smarthivesms.com",
        from_name: str = "Smarthive Notification",
        name: str = "Transactional Email",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._client._request(
            "POST",
            "/api/email/campaign/send_campaign",
            json_body={
                "name": name,
                "from": from_email,
                "fromName": from_name,
                "to": to,
                "subject": subject,
                "html": html,
            },
            api_key=self._client.resolve_key(None, api_key),
        )


class SmarthiveSMS(_BaseClient):
    """Synchronous SmarthiveSMS Python SDK client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        api_key_mkt: Optional[str] = None,
        api_key_trx: Optional[str] = None,
        api_key_intl: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        super().__init__(
            api_key,
            api_key_mkt=api_key_mkt,
            api_key_trx=api_key_trx,
            api_key_intl=api_key_intl,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(base_url=self.base_url, timeout=self.timeout)

        self.sms = _SmsResource(self)
        self.balance = _BalanceResource(self)
        self.whatsapp = _WhatsappResource(self)
        self.voice = _VoiceResource(self)
        self.email = _EmailResource(self)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> SmarthiveSMS:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        api_key: str,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        is_sandbox = api_key.startswith("SMTSBX_")
        if not api_key:
            raise SmarthiveAuthError(
                "Missing SmarthiveSMS API key. Pass `api_key` or set `SMARTHIVE_API_KEY`.",
                status_code=401,
                is_sandbox=False,
            )

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                res = self._http.request(
                    method,
                    path,
                    json=json_body,
                    headers=self._build_headers(api_key),
                )
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    time.sleep(0.25 * (2**attempt))
                    continue
                raise SmarthiveError(str(exc), status_code=0, response=exc, is_sandbox=is_sandbox) from exc

            data = _parse_response(res)
            if res.is_success:
                return data if isinstance(data, dict) else {"data": data}

            message = _extract_error_message(data, f"Request failed with HTTP {res.status_code}")

            if res.status_code in (401, 403):
                raise SmarthiveAuthError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)
            if res.status_code in (400, 422):
                raise SmarthiveValidationError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)
            if res.status_code == 429:
                retry_after = _parse_retry_after(res)
                if attempt < self.max_retries:
                    time.sleep(retry_after if retry_after is not None else float(2**attempt))
                    continue
                raise SmarthiveRateLimitError(
                    message,
                    status_code=429,
                    response=data,
                    retry_after=retry_after,
                    is_sandbox=is_sandbox,
                )
            if res.status_code >= 500 and attempt < self.max_retries:
                time.sleep(0.25 * (2**attempt))
                continue

            raise SmarthiveError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)

        raise SmarthiveError(
            str(last_exc) if last_exc else "Network request to SmarthiveSMS failed",
            status_code=0,
            response=last_exc,
            is_sandbox=is_sandbox,
        )


class _AsyncSmsResource:
    def __init__(self, client: AsyncSmarthiveSMS) -> None:
        self._client = client

    async def send(
        self,
        *,
        sender: str,
        recipients: str,
        msg: str,
        route: SmsRoute = "MKT",
        type: int = 1,
        ext_ref: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "sender": sender,
            "recipients": recipients,
            "msg": msg,
            "route": route,
            "type": type,
        }
        if ext_ref is not None:
            payload["ext_ref"] = ext_ref
        return await self._client._request(
            "POST",
            "/api/sms/send",
            json_body=payload,
            api_key=self._client.resolve_key(route, api_key),
        )

    async def send_bulk(
        self,
        *,
        sender: str,
        recipients: Union[str, Sequence[str]],
        msg: str,
        route: SmsRoute = "MKT",
        type: int = 1,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        recipients_str = recipients if isinstance(recipients, str) else ",".join(recipients)
        return await self._client._request(
            "POST",
            "/api/sms/send/multi",
            json_body={
                "sender": sender,
                "recipients": recipients_str,
                "msg": msg,
                "route": route,
                "type": type,
            },
            api_key=self._client.resolve_key(route, api_key),
        )

    async def status(self, message_id: str, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return await self._client._request(
            "POST",
            "/api/sms/status",
            json_body={"message_id": message_id},
            api_key=self._client.resolve_key(None, api_key),
        )


class _AsyncBalanceResource:
    def __init__(self, client: AsyncSmarthiveSMS) -> None:
        self._client = client

    async def get(self, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return await self._client._request(
            "GET",
            "/api/sms/credit",
            api_key=self._client.resolve_key(None, api_key),
        )


class _AsyncWhatsappResource:
    def __init__(self, client: AsyncSmarthiveSMS) -> None:
        self._client = client

    async def send_otp(
        self,
        *,
        recipient: str,
        code: str,
        sender: str = "SmarthiveSMS",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._client._request(
            "POST",
            "/api/whatsapp/send",
            json_body={"recipient": recipient, "code": code, "sender": sender},
            api_key=self._client.resolve_key(None, api_key),
        )


class _AsyncVoiceResource:
    def __init__(self, client: AsyncSmarthiveSMS) -> None:
        self._client = client

    async def send_otp(
        self,
        *,
        phone: str,
        otp: str,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._client._request(
            "POST",
            "/api/voice/otp",
            json_body={"phone": phone, "otp": otp},
            api_key=self._client.resolve_key(None, api_key),
        )

    async def status(self, call_id: str, *, api_key: Optional[str] = None) -> Dict[str, Any]:
        return await self._client._request(
            "GET",
            f"/api/voice/status/{quote(call_id, safe='')}",
            api_key=self._client.resolve_key(None, api_key),
        )


class _AsyncEmailResource:
    def __init__(self, client: AsyncSmarthiveSMS) -> None:
        self._client = client

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        from_email: str = "support@smarthivesms.com",
        from_name: str = "Smarthive Notification",
        name: str = "Transactional Email",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._client._request(
            "POST",
            "/api/email/campaign/send_campaign",
            json_body={
                "name": name,
                "from": from_email,
                "fromName": from_name,
                "to": to,
                "subject": subject,
                "html": html,
            },
            api_key=self._client.resolve_key(None, api_key),
        )


class AsyncSmarthiveSMS(_BaseClient):
    """Asynchronous SmarthiveSMS Python SDK client (FastAPI, Starlette, asyncio)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        api_key_mkt: Optional[str] = None,
        api_key_trx: Optional[str] = None,
        api_key_intl: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        super().__init__(
            api_key,
            api_key_mkt=api_key_mkt,
            api_key_trx=api_key_trx,
            api_key_intl=api_key_intl,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._owns_client = http_client is None
        self._http = http_client or httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)

        self.sms = _AsyncSmsResource(self)
        self.balance = _AsyncBalanceResource(self)
        self.whatsapp = _AsyncWhatsappResource(self)
        self.voice = _AsyncVoiceResource(self)
        self.email = _AsyncEmailResource(self)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._http.aclose()

    async def __aenter__(self) -> AsyncSmarthiveSMS:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        api_key: str,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        is_sandbox = api_key.startswith("SMTSBX_")
        if not api_key:
            raise SmarthiveAuthError(
                "Missing SmarthiveSMS API key. Pass `api_key` or set `SMARTHIVE_API_KEY`.",
                status_code=401,
                is_sandbox=False,
            )

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                res = await self._http.request(
                    method,
                    path,
                    json=json_body,
                    headers=self._build_headers(api_key),
                )
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(0.25 * (2**attempt))
                    continue
                raise SmarthiveError(str(exc), status_code=0, response=exc, is_sandbox=is_sandbox) from exc

            data = _parse_response(res)
            if res.is_success:
                return data if isinstance(data, dict) else {"data": data}

            message = _extract_error_message(data, f"Request failed with HTTP {res.status_code}")

            if res.status_code in (401, 403):
                raise SmarthiveAuthError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)
            if res.status_code in (400, 422):
                raise SmarthiveValidationError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)
            if res.status_code == 429:
                retry_after = _parse_retry_after(res)
                if attempt < self.max_retries:
                    await asyncio.sleep(retry_after if retry_after is not None else float(2**attempt))
                    continue
                raise SmarthiveRateLimitError(
                    message,
                    status_code=429,
                    response=data,
                    retry_after=retry_after,
                    is_sandbox=is_sandbox,
                )
            if res.status_code >= 500 and attempt < self.max_retries:
                await asyncio.sleep(0.25 * (2**attempt))
                continue

            raise SmarthiveError(message, status_code=res.status_code, response=data, is_sandbox=is_sandbox)

        raise SmarthiveError(
            str(last_exc) if last_exc else "Network request to SmarthiveSMS failed",
            status_code=0,
            response=last_exc,
            is_sandbox=is_sandbox,
        )
