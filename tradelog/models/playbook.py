from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from tradelog.database import Base


class Playbook(Base):
    __tablename__ = "playbooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(Text, nullable=True)       # JSON string list of rules
    criteria = Column(Text, nullable=True)    # JSON string
    created_at = Column(DateTime, default=func.now())

    trades = relationship("Trade", back_populates="setup")
