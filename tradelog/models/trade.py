from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from tradelog.database import Base
from tradelog.models.tag import trade_tags


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False, index=True)
    direction = Column(String, nullable=False)          # LONG / SHORT
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    size = Column(Float, nullable=False)
    pnl = Column(Float, nullable=True)
    fees = Column(Float, nullable=False, default=0.0)
    net_pnl = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    r_multiple = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    setup_id = Column(Integer, ForeignKey("playbooks.id"), nullable=True)
    status = Column(String, nullable=False, default="closed")
    broker_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

    setup = relationship("Playbook", back_populates="trades")
    tags = relationship("Tag", secondary=trade_tags, back_populates="trades")
