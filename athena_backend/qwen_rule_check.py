import os
from functools import lru_cache

from openai import OpenAI


QWEN_BASE_URL = os.getenv(
    "QWEN_BASE_URL",
    "https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1",
)
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3.5-plus")


@lru_cache(maxsize=1)
def get_qwen_client() -> OpenAI:
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")

    return OpenAI(api_key=api_key, base_url=QWEN_BASE_URL)


def check_rule_with_qwen(rule: str, category: str) -> bool:
    prompt = (
        "You are a strict policy checker for payments. "
        "Decide if the transaction category is allowed under the rule. "
        "Reply with exactly one word: yes or no.\n"
        f"Rule: {rule}\n"
        f"Transaction category: {category}"
    )

    client = get_qwen_client()
    response = client.responses.create(model=QWEN_MODEL, input=prompt)
    output_text = (response.output_text or "").strip().lower()

    if output_text == "yes":
        return True
    if output_text == "no":
        return False

    return output_text.startswith("yes")