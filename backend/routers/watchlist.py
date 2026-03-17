from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import yfinance as yf

from database import get_db
from models.watchlist import Watchlist
from models.stock import StockCache
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

class AddRequest(BaseModel):
    symbol: str

@router.get("/")
def get_watchlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()
    result = []
    for item in items:
        # Try to get live price
        price_data = {}
        try:
            t = yf.Ticker(f"{item.symbol}.KA")
            hist = t.history(period="2d", interval="1d")
            if not hist.empty:
                close = round(float(hist["Close"].iloc[-1]), 2)
                ldcp  = round(float(hist["Close"].iloc[-2]) if len(hist) > 1 else close, 2)
                change = round(close - ldcp, 2)
                chg_pct = round((change / ldcp) * 100, 2) if ldcp else 0
                price_data = {
                    "price": close,
                    "ldcp": ldcp,
                    "change": change,
                    "change_pct": chg_pct,
                }
        except Exception:
            price_data = {"price": None, "ldcp": None, "change": None, "change_pct": None}

        result.append({
            "id": item.id,
            "symbol": item.symbol,
            "name": item.name,
            "sector": item.sector,
            "added_at": item.created_at,
            **price_data,
        })
    return result

@router.post("/")
def add_to_watchlist(
    body: AddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    symbol = body.symbol.upper()

    # Check limit
    count = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).count()
    if count >= 20:
        raise HTTPException(status_code=400, detail="Watchlist limit reached (20 stocks max).")

    # Check duplicate
    existing = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.symbol == symbol,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"{symbol} is already in your watchlist.")

    # Get name/sector from stock cache
    stock = db.query(StockCache).filter(StockCache.symbol == symbol).first()

    item = Watchlist(
        user_id=current_user.id,
        symbol=symbol,
        name=stock.name if stock else symbol,
        sector=stock.sector if stock else "N/A",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": f"{symbol} added to watchlist.", "symbol": symbol}

@router.delete("/{symbol}")
def remove_from_watchlist(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.symbol == symbol.upper(),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stock not in watchlist.")
    db.delete(item)
    db.commit()
    return {"message": f"{symbol.upper()} removed from watchlist."}

@router.get("/check/{symbol}")
def check_watchlist(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exists = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.symbol == symbol.upper(),
    ).first()
    return {"in_watchlist": exists is not None}