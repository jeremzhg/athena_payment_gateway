import datetime
import hashlib
import re
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import AgentAccount, AuthToken, Merchant, Transaction, User


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Athena Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def ensure_seed_data(db: Session) -> None:
    merchant = db.query(Merchant).filter(Merchant.merchant_id == "ShopeeDummyMerchant").first()
    if not merchant:
        db.add(Merchant(merchant_id="ShopeeDummyMerchant", name="Shopee Dummy Merchant"))

    user = db.query(User).filter(User.username == "admin").first()
    if not user:
        db.add(User(username="admin", password_hash=hash_password("password")))

    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    db = next(get_db())
    try:
        ensure_seed_data(db)
    finally:
        db.close()


class LoginRequest(BaseModel):
    username: str
    password: str


class AccountPayload(BaseModel):
    accountId: Optional[str] = None
    balanceLimit: float
    rule: str


class AccountResponse(BaseModel):
    accountId: str
    balanceLimit: float
    rule: str


class AuthorizeMcpRequest(BaseModel):
    mcp_token: str
    accountId: str


class CreateTransactionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    amount: float = Field(alias="Amount")
    merchant_id: str = Field(alias="MerchantId")
    category: str = Field(alias="Category")


class CreateTransactionResponse(BaseModel):
    transaction_id: str


class PayTransactionRequest(BaseModel):
    transaction_id: str
    mcp_token: Optional[str] = None


def mock_qwen_rule_check(rule: str, category: str) -> bool:
    normalized_rule = rule.strip().lower()
    normalized_category = category.strip().lower()

    def normalize_word(word: str) -> str:
        word = word.strip().lower()
        if word.endswith("ies") and len(word) > 3:
            return word[:-3] + "y"
        if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
            return word[:-1]
        return word

    def tokenize(text: str) -> set[str]:
        raw = re.findall(r"[a-z0-9]+", text.lower())
        return {normalize_word(token) for token in raw if token}

    only_for_match = re.search(r"only\s+for\s+([a-z0-9\s_-]+)", normalized_rule)
    if only_for_match:
        rule_category = only_for_match.group(1).strip()
        rule_terms = tokenize(rule_category)
        category_terms = tokenize(normalized_category)
        if rule_terms and category_terms and rule_terms.intersection(category_terms):
            return True
        return rule_category in normalized_category or normalized_category in rule_category

    allow_match = re.search(r"allow\s+([a-z0-9\s_-]+)", normalized_rule)
    if allow_match:
        allowed_topic = allow_match.group(1).strip()
        allowed_terms = tokenize(allowed_topic)
        category_terms = tokenize(normalized_category)
        if allowed_terms and category_terms and allowed_terms.intersection(category_terms):
            return True
        return allowed_topic in normalized_category or normalized_category in allowed_topic

    blocked_patterns = ["never", "forbidden", "deny", "block"]
    if any(pattern in normalized_rule for pattern in blocked_patterns):
        return False

    rule_terms = tokenize(normalized_rule)
    category_terms = tokenize(normalized_category)
    if rule_terms and category_terms and rule_terms.intersection(category_terms):
        return True

    return normalized_category in normalized_rule or normalized_rule in normalized_category


@app.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    ensure_seed_data(db)
    user = db.query(User).filter(User.username == request.username).first()

    if not user or user.password_hash != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "status": "success",
        "username": user.username,
        "message": "Login successful",
    }


@app.get("/accounts", response_model=list[AccountResponse])
def get_accounts(db: Session = Depends(get_db)):
    ensure_seed_data(db)
    owner = db.query(User).filter(User.username == "admin").first()
    if not owner:
        return []

    accounts = db.query(AgentAccount).filter(AgentAccount.owner_user_id == owner.id).order_by(AgentAccount.created_at.desc()).all()
    return [
        {
            "accountId": account.account_id,
            "balanceLimit": account.balance_limit,
            "rule": account.rule,
        }
        for account in accounts
    ]


@app.post("/accounts", response_model=AccountResponse)
def create_or_update_account(payload: AccountPayload, db: Session = Depends(get_db)):
    ensure_seed_data(db)
    owner = db.query(User).filter(User.username == "admin").first()
    if not owner:
        raise HTTPException(status_code=500, detail="Hardcoded user is missing")

    if payload.balanceLimit <= 0:
        raise HTTPException(status_code=400, detail="balanceLimit must be greater than 0")

    if not payload.rule.strip():
        raise HTTPException(status_code=400, detail="rule is required")

    account = None
    if payload.accountId:
        account = db.query(AgentAccount).filter(AgentAccount.account_id == payload.accountId).first()

    if account:
        account.balance_limit = payload.balanceLimit
        account.rule = payload.rule.strip()
    else:
        generated_id = payload.accountId or f"acc_{uuid.uuid4().hex[:8]}"
        account = AgentAccount(
            account_id=generated_id,
            balance_limit=payload.balanceLimit,
            rule=payload.rule.strip(),
            owner_user_id=owner.id,
        )
        db.add(account)

    db.commit()
    db.refresh(account)

    return {
        "accountId": account.account_id,
        "balanceLimit": account.balance_limit,
        "rule": account.rule,
    }


@app.post("/auth/authorize-mcp")
def authorize_mcp(payload: AuthorizeMcpRequest, db: Session = Depends(get_db)):
    account = db.query(AgentAccount).filter(AgentAccount.account_id == payload.accountId).first()
    if not account:
        raise HTTPException(status_code=404, detail="Agent account not found")

    auth_record = db.query(AuthToken).filter(AuthToken.mcp_token == payload.mcp_token).first()
    if not auth_record:
        auth_record = AuthToken(mcp_token=payload.mcp_token)
        db.add(auth_record)

    auth_record.account_id = account.account_id
    auth_record.is_authorized = True
    auth_record.authorized_at = datetime.datetime.utcnow()

    db.commit()

    return {
        "status": "success",
        "mcp_token": payload.mcp_token,
        "accountId": account.account_id,
        "message": "MCP token authorized",
    }


@app.post("/transactions/create", response_model=CreateTransactionResponse)
def create_transaction(payload: CreateTransactionRequest, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.merchant_id == payload.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Unknown merchant '{payload.merchant_id}'")

    tx_id = f"txn_{uuid.uuid4().hex[:12]}"
    transaction = Transaction(
        transaction_id=tx_id,
        amount=payload.amount,
        merchant_id=payload.merchant_id,
        category=payload.category,
        status="pending",
    )

    db.add(transaction)
    db.commit()

    return {"transaction_id": tx_id}


@app.post("/transactions/pay")
def pay_transaction(
    payload: PayTransactionRequest,
    db: Session = Depends(get_db),
    x_mcp_token: Optional[str] = Header(default=None),
):
    token_value = payload.mcp_token or x_mcp_token
    if not token_value:
        raise HTTPException(status_code=400, detail="mcp_token is required")

    auth_record = db.query(AuthToken).filter(AuthToken.mcp_token == token_value).first()
    if not auth_record or not auth_record.is_authorized or not auth_record.account_id:
        return {
            "status": "failure",
            "reason": "Unauthorized token",
        }

    account = db.query(AgentAccount).filter(AgentAccount.account_id == auth_record.account_id).first()
    if not account:
        return {
            "status": "failure",
            "reason": "Token is not linked to a valid account",
        }

    transaction = db.query(Transaction).filter(Transaction.transaction_id == payload.transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="transaction_id not found")

    if transaction.amount > account.balance_limit:
        transaction.status = "failed"
        transaction.failure_reason = "Limit Exceeded"
        db.commit()
        return {
            "status": "failure",
            "reason": "Limit Exceeded",
            "transaction_id": transaction.transaction_id,
        }

    allowed_by_rule = mock_qwen_rule_check(account.rule, transaction.category)
    if not allowed_by_rule:
        transaction.status = "failed"
        transaction.failure_reason = "Rule Violated"
        db.commit()
        return {
            "status": "failure",
            "reason": "Rule Violated",
            "transaction_id": transaction.transaction_id,
        }

    transaction.status = "done"
    transaction.failure_reason = None
    transaction.webhook_status = "mocked: webhook sent to Shopee"
    db.commit()

    return {
        "status": "success",
        "transaction_id": transaction.transaction_id,
        "message": "Transaction paid successfully",
        "webhook": transaction.webhook_status,
    }
