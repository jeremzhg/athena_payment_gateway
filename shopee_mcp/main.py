import os
import httpx
from mcp.server.fastmcp import FastMCP


BACKEND_BASE_URL = os.getenv("ATHENA_BACKEND_URL", "http://localhost:8000")
MERCHANT_ID = os.getenv("SHOPEE_MERCHANT_ID", "ShopeeDummyMerchant")

mcp = FastMCP("shopee-mcp")


MOCK_ITEMS = [
    {"id": "item_1", "name": "Fresh Apples", "price": 12.5, "category": "Groceries"},
    {"id": "item_2", "name": "Rice 5kg", "price": 18.0, "category": "Groceries"},
    {"id": "item_3", "name": "Wireless Headset", "price": 79.0, "category": "Electronics"},
    {"id": "item_4", "name": "Mechanical Keyboard", "price": 95.0, "category": "Electronics"},
]


@mcp.tool(name="belanja")
def belanja() -> list[dict]:
    return MOCK_ITEMS


@mcp.tool(name="browse_items")
def browse_items() -> list[dict]:
    return belanja()


@mcp.tool(name="checkout")
def checkout(items: list[dict], category: str) -> dict:
    amount = 0.0
    for item in items:
        price = item.get("price", 0)
        quantity = item.get("quantity", 1)
        amount += float(price) * float(quantity)

    payload = {
        "Amount": amount,
        "MerchantId": MERCHANT_ID,
        "Category": category,
    }

    with httpx.Client(timeout=15.0) as client:
        response = client.post(f"{BACKEND_BASE_URL}/transactions/create", json=payload)

    if response.status_code >= 400:
        return {
            "status": "failure",
            "reason": f"Backend error: {response.status_code}",
            "detail": response.text,
        }

    body = response.json()
    transaction_id = body.get("transaction_id")
    return {
        "transaction_id": transaction_id,
        "instruction": "Please use the Athena MCP tool's process_payment to finalize this transaction using transaction_id: "
        + str(transaction_id),
    }


def run() -> None:
    mcp.run()


if __name__ == "__main__":
    run()
