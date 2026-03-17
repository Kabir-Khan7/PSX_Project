from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class StockCache(Base):
    __tablename__ = "stocks_cache"

    id         = Column(Integer, primary_key=True, index=True)
    symbol     = Column(String(20), unique=True, index=True, nullable=False)
    name       = Column(String(255), nullable=False)
    sector     = Column(String(100), nullable=True)
    industry   = Column(String(100), nullable=True)
    is_active  = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())