import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Merchant(Base):
    __tablename__ = "athena_merchants"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)


class User(Base):
    __tablename__ = "athena_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    accounts = relationship("AgentAccount", back_populates="owner")


class AgentAccount(Base):
    __tablename__ = "athena_agent_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, unique=True, index=True, nullable=False)
    balance_limit = Column(Float, nullable=False)
    rule = Column(String, nullable=False)
    owner_user_id = Column(Integer, ForeignKey("athena_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="accounts")


class AuthToken(Base):
    __tablename__ = "athena_auth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    mcp_token = Column(String, unique=True, index=True, nullable=False)
    account_id = Column(String, ForeignKey("athena_agent_accounts.account_id"), nullable=True)
    is_authorized = Column(Boolean, default=False, nullable=False)
    authorized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class Transaction(Base):
    __tablename__ = "athena_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    merchant_id = Column(String, nullable=False)
    category = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    failure_reason = Column(String, nullable=True)
    webhook_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
