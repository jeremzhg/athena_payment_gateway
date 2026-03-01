import os
import uuid
import httpx
from mcp.server.fastmcp import FastMCP


BACKEND_BASE_URL = os.getenv("ATHENA_BACKEND_URL", "http://localhost:8000")
FRONTEND_PORT = os.getenv("ATHENA_FRONTEND_PORT", "5173")

mcp = FastMCP("athena-mcp")
_current_token: str | None = None


@mcp.tool(name="login")
def login() -> str:
    global _current_token
    _current_token = f"mcp_{uuid.uuid4().hex}"
    return (
        "I need authorization to make payments. Please tell the user to click this link to "
        f"authorize me: http://localhost:{FRONTEND_PORT}/authorize?token={_current_token}"
    )


@mcp.tool(name="authenticate_agent")
def authenticate_agent() -> str:
    return login()


@mcp.tool(name="process_payment")
def process_payment(transaction_id: str) -> dict:
    global _current_token

    if not _current_token:
        return {
            "status": "failure",
            "reason": "No mcp_token available. Call login first.",
        }

    payload = {
        "transaction_id": transaction_id,
        "mcp_token": _current_token,
    }

    with httpx.Client(timeout=15.0) as client:
        response = client.post(f"{BACKEND_BASE_URL}/transactions/pay", json=payload)

    if response.status_code >= 400:
        return {
            "status": "failure",
            "reason": f"Backend error: {response.status_code}",
            "detail": response.text,
        }

    return response.json()


def run() -> None:
    mcp.run()


if __name__ == "__main__":
    run()
