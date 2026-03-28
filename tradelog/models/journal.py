from sqlalchemy import Column, Integer, String, Text, Date, DateTime
from sqlalchemy.sql import func
from tradelog.database import Base


class DailyJournal(Base):
    __tablename__ = "daily_journals"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False, index=True)
    mood = Column(String, nullable=True)       # GREAT/GOOD/NEUTRAL/BAD/TERRIBLE
    notes = Column(Text, nullable=True)
    mistakes = Column(Text, nullable=True)     # JSON string
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
