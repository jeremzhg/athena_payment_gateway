# Mini Hackathon Alibaba – Multi-Agent Payment POC

For quick demo of this flow/protocol, please refer to the [Demo Guide](docs/demo_guide.md).

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

## Run the Applications

### Prerequisites

- Python `>=3.11`, `uv` installed
- Node.js `>=20`, `npm` installed
- Gemini CLI (`gemini`) installed (`npm install -g @google/gemini-cli`)

### 1) Athena Backend

```bash
cd athena_backend
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Athena Frontend

```bash
cd athena_frontend
npm install
npm run dev -- --port 5173
```

### 3) Start Gemini CLI (Agent)

Your Gemini MCP config is already set in `.gemini/settings.json` (inside the `demo` folder). This config auto-starts both `athena_mcp` and `shopee_mcp`.

```bash
cd demo
gemini
```

> **Note:** You do **not** need to manually start `athena_mcp` and `shopee_mcp` if you are using the Gemini CLI config.

### Manual MCP Startup (Optional)

If you are using a different MCP client that requires manual server startup:

#### Athena MCP

```bash
cd athena_mcp
uv sync
uv run python main.py
```

Optional environment variables:

- `ATHENA_BACKEND_URL` (default: `http://localhost:8000`)
- `ATHENA_FRONTEND_PORT` (default: `5173`)

#### Shopee MCP

```bash
cd shopee_mcp
uv sync
uv run python main.py
```

Optional environment variables:

- `ATHENA_BACKEND_URL` (default: `http://localhost:8000`)
- `SHOPEE_MERCHANT_ID` (default: `ShopeeDummyMerchant`)

## Expected Demo Flow

1. Login as `admin` / `password` in the frontend (http://localhost:5173).
2. Create account (example: limit `50`, rule `Only for grocery`).
3. In Gemini chat, prompt the agent to call `authenticate_agent` (Athena MCP) to retrieve the authorization URL.
4. User opens the returned link and authorizes the token against the account.
5. In Gemini chat, prompt the agent to browse and pick items (`browse_items`), then call `checkout` (Shopee MCP).
6. Once the agent receives the `transaction_id`, prompt it to call `process_payment` (Athena MCP) to finalize the payment.
7. Backend validation returns success or failure (e.g. `Limit Exceeded` or `Rule Violated`).

## Demo Assets

- Step-by-step demo walkthrough: `docs/demo_guide.md`
- MCP client server config (Athena + Shopee): `mcp.json`
