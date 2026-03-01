# Mini Hackathon Alibaba – Multi-Agent Payment POC

This workspace now follows the 4-application specification:

1. `athena_backend` – FastAPI payment gateway core
2. `athena_frontend` – React dashboard + MCP authorization page
3. `athena_mcp` – MCP payment tool server (`login`, `process_payment`)
4. `shopee_mcp` – MCP shopping tool server (`belanja`, `checkout`)

## Architecture Summary

- A hardcoded user (`admin` / `password`) logs in through the frontend.
- The user creates `Agent Accounts` with `accountId`, `balanceLimit`, and `rule`.
- Athena MCP creates an unauthorized `mcp_token` and asks the user to authorize it using:
  - `http://localhost:5173/authorize?token=<mcp_token>`
- Frontend binds the token to an account through backend `POST /auth/authorize-mcp`.
- Shopee MCP creates transactions with `POST /transactions/create`.
- Athena MCP finalizes payment with `POST /transactions/pay` using its token.
- Backend enforces:
  - token authorization
  - account limit validation
  - Alibaba Qwen-based rule-category relevance check

### Qwen API setup (Athena Backend)

Set these environment variables before running `athena_backend`:

- `DASHSCOPE_API_KEY` (required for live Qwen checks)
- `QWEN_MODEL` (optional, default: `qwen3.5-plus`)
- `QWEN_BASE_URL` (optional, default: DashScope compatible URL)

If `DASHSCOPE_API_KEY` is missing or Qwen is temporarily unavailable, backend falls back to local heuristic rule matching so the demo remains usable.

## Backend API (Spec-aligned)

- `POST /auth/login`
- `GET /accounts`
- `POST /accounts`
- `POST /auth/authorize-mcp`
- `POST /transactions/create`
- `POST /transactions/pay`

## Run All 4 Applications

### 1) Athena Backend

```bash
cd athena_backend
uv sync
uv run uvicorn main:app --reload --port 8000
```

### 2) Athena Frontend

```bash
cd athena_frontend
npm install
npm run dev -- --port 5173
```

### 3) Athena MCP

```bash
cd athena_mcp
uv sync
uv run python main.py
```

Optional environment variables:

- `ATHENA_BACKEND_URL` (default: `http://localhost:8000`)
- `ATHENA_FRONTEND_PORT` (default: `5173`)

### 4) Shopee MCP

```bash
cd shopee_mcp
uv sync
uv run python main.py
```

Optional environment variables:

- `ATHENA_BACKEND_URL` (default: `http://localhost:8000`)
- `SHOPEE_MERCHANT_ID` (default: `ShopeeDummyMerchant`)

## Expected Demo Flow

1. Login as `admin` / `password` in frontend.
2. Create account (example: limit `50`, rule `Only for grocery`).
3. Athena MCP tool calls `login` and gets auth link.
4. User opens link and authorizes token against the account.
5. Shopee MCP tool calls `belanja`, then `checkout`.
6. Athena MCP tool calls `process_payment(transaction_id)`.
7. Backend returns success/failure (`Limit Exceeded` or `Rule Violated` when applicable).

## Demo Assets

- Step-by-step demo walkthrough: `docs/demo_guide.md`
- MCP client server config (Athena + Shopee): `mcp.json`
