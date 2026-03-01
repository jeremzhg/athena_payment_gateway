# Demo Guide: Mini Hackathon Alibaba

This guide shows the fastest way to demo the full 4-app flow with Qwen Code CLI:

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

## 3) Start Qwen Code CLI (MCP already configured)

Your Qwen MCP config is already set in:

- `.qwen/settings.json`

It includes both servers:

- `athena-mcp`
- `shopee-mcp`

Verify they are available:

```bash
cd /home/kris/Documents/projects/mini_hackathon_alibaba
qwen mcp list
```

Then launch Qwen in interactive mode:

```bash
cd /home/kris/Documents/projects/mini_hackathon_alibaba
qwen
```

> You do **not** need to manually start `athena_mcp` and `shopee_mcp` if Qwen is using `.qwen/settings.json`.

## 4) Demo Script (End-to-End in Qwen)

### A. User setup (Frontend)

1. Login with:
   - username: `admin`
   - password: `password`
2. Create an account with:
   - `balanceLimit`: `50`
   - `rule`: `Only for grocery`

### B. Agent authorization flow (Qwen prompt)

In Qwen chat, send this prompt:

```text
Call Athena MCP login (or authenticate_agent) now and show me only the authorization URL.
```

Then:

1. Open returned URL in browser (format: `http://localhost:5173/authorize?token=mcp_<...>`)
2. Select the account from step A and authorize.

### C. Shopping and payment flow (Qwen prompts)

In Qwen chat, run prompts below in order.

1) Browse items:

```text
Call Shopee MCP belanja (or browse_items) and summarize the items with price and category.
```

2) Successful payment scenario (grocery within limit):

```text
Pick grocery items totaling <= 50, then call Shopee MCP checkout with category grocery. After you get transaction_id, immediately call Athena MCP process_payment using that transaction_id. Return final payment result only.
```

Expected outcome: Success.

Expected outcomes:

- Success when amount is within limit and category matches rule.
- Failure (`Limit Exceeded`) when transaction amount is above `balanceLimit`.
- Failure (`Rule Violated`) when category conflicts with rule.

## 5) Quick Failure Scenarios (recommended prompts)

Run these in Qwen chat:

### A) Limit failure

```text
Keep using my authorized token/account. Choose electronics items totaling > 50, call Shopee MCP checkout with category electronics, then call Athena MCP process_payment with the returned transaction_id. Return the final error status.
```

Expected outcome: `Limit Exceeded`.

### B) Rule failure

```text
Keep using my authorized token/account (rule is Only for grocery). Choose electronics items totaling <= 50, call Shopee MCP checkout with category electronics, then call Athena MCP process_payment with the returned transaction_id. Return the final error status.
```

Expected outcome: `Rule Violated`.

## 6) Useful Endpoints (Backend)

- `POST /auth/login`
- `GET /accounts`
- `POST /accounts`
- `POST /auth/authorize-mcp`
- `POST /transactions/create`
- `POST /transactions/pay`

## 7) Troubleshooting

- Qwen cannot find MCP servers:
   - Ensure you launch Qwen from workspace root so `.qwen/settings.json` is loaded:
   - `cd /home/kris/Documents/projects/mini_hackathon_alibaba && qwen`
   - Confirm server registration:
   - `qwen mcp list`

- `error: Failed to spawn: uvicorn`
  - Run from `athena_backend` and ensure dependencies are synced:
  - `cd athena_backend && uv sync`

- Frontend cannot reach backend:
  - Ensure backend is running on `http://localhost:8000`

- MCP payments always fail with missing token:
   - Ensure Athena MCP `login` is called first in the same Qwen session.

## 8) One-shot Qwen command examples (optional)

You can also run one-shot prompts without entering interactive mode:

```bash
qwen "Call Shopee MCP belanja and list items in a compact table."
```

For multi-step tool flows, interactive mode (`qwen`) is recommended.
