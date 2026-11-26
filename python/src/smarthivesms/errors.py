from __future__ import annotations

from typing import Any, Optional


class SmarthiveError(Exception):
    """Base exception for all SmarthiveSMS API errors."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 0,
        response: Any = None,
        is_sandbox: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response = response
        self.is_sandbox = is_sandbox


class SmarthiveAuthError(SmarthiveError):
    """Raised on HTTP 401/403 or missing API key."""


class SmarthiveValidationError(SmarthiveError):
    """Raised on HTTP 400/422 validation or insufficient credit errors."""


class SmarthiveRateLimitError(SmarthiveError):
    """Raised on HTTP 429 rate limit responses."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 429,
        response: Any = None,
        retry_after: Optional[float] = None,
        is_sandbox: bool = False,
    ) -> None:
        super().__init__(
            message,
            status_code=status_code,
            response=response,
            is_sandbox=is_sandbox,
        )
        self.retry_after = retry_after
