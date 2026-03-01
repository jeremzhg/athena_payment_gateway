# Demo Guide: Mini Hackathon Alibaba

This guide shows the fastest way to demo the full 4-app flow:

1. `athena_backend` (payment gateway API)
2. `athena_frontend` (user dashboard)
3. `athena_mcp` (payment MCP tools)
4. `shopee_mcp` (shopping MCP tools)

## Prerequisites

- Python `>=3.11`
- Node.js `>=20`
- `uv` installed
- `npm` installed

Optional (for live Qwen checks):

- `DASHSCOPE_API_KEY`

If `DASHSCOPE_API_KEY` is not set, backend falls back to local heuristic checks so the demo can still run.

## 1) Start Athena Backend

From workspace root:

```bash
cd athena_backend
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health check:

```bash
curl http://localhost:8000/docs
```

## 2) Start Athena Frontend

In a new terminal:

```bash
cd athena_frontend
npm install
npm run dev -- --port 5173
```

Open:

- `http://localhost:5173`

## 3) Start MCP Servers (for agent client)

You can run MCP servers manually, or use `mcp.json` (provided at workspace root).

Manual run:

```bash
cd athena_mcp
uv sync
uv run python main.py
```

```bash
cd shopee_mcp
uv sync
uv run python main.py
```

## 4) Demo Script (End-to-End)

### A. User setup (Frontend)

1. Login with:
   - username: `admin`
   - password: `password`
2. Create an account with:
   - `balanceLimit`: `50`
   - `rule`: `Only for grocery`

### B. Agent authorization flow

1. In your MCP client, call Athena MCP tool `login` (or `authenticate_agent`).
2. It returns an authorization URL like:
   - `http://localhost:5173/authorize?token=mcp_<...>`
3. Open the URL in browser.
4. Select the account created in step A and authorize.

### C. Shopping and payment flow

1. Call Shopee MCP `belanja` (or `browse_items`) to get item list.
2. Call Shopee MCP `checkout` with selected items and category.
3. Copy returned `transaction_id`.
4. Call Athena MCP `process_payment` with that `transaction_id`.

Expected outcomes:

- Success when amount is within limit and category matches rule.
- Failure (`Limit Exceeded`) when transaction amount is above `balanceLimit`.
- Failure (`Rule Violated`) when category conflicts with rule.

## 5) Quick Failure Scenarios (recommended in demo)

- **Limit failure:** buy electronics totaling above `50`.
- **Rule failure:** keep rule as grocery, then checkout electronics and attempt `process_payment`.

## 6) Useful Endpoints (Backend)

- `POST /auth/login`
- `GET /accounts`
- `POST /accounts`
- `POST /auth/authorize-mcp`
- `POST /transactions/create`
- `POST /transactions/pay`

## 7) Troubleshooting

- `error: Failed to spawn: uvicorn`
  - Run from `athena_backend` and ensure dependencies are synced:
  - `cd athena_backend && uv sync`

- Frontend cannot reach backend:
  - Ensure backend is running on `http://localhost:8000`

- MCP payments always fail with missing token:
  - Ensure Athena MCP `login` is called first in the same MCP server session.
