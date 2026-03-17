from sqlalchemy.orm import Session
from models.stock import StockCache
from services.psx_stocks import PSX_STOCKS

def seed_psx_stocks(db: Session):
    """Seed PSX stocks — deduplicate in-memory first, then upsert."""
    
    # Deduplicate the list — last entry wins for same symbol
    seen = {}
    for symbol, name, sector in PSX_STOCKS:
        seen[symbol] = (name, sector)
    
    unique_stocks = [(sym, name, sec) for sym, (name, sec) in seen.items()]
    print(f"Seeding {len(unique_stocks)} unique PSX stocks...")

    seeded = 0
    updated = 0

    for symbol, name, sector in unique_stocks:
        try:
            existing = db.query(StockCache).filter(
                StockCache.symbol == symbol
            ).first()
            if not existing:
                db.add(StockCache(symbol=symbol, name=name, sector=sector))
                seeded += 1
            else:
                existing.name   = name
                existing.sector = sector
                updated += 1
        except Exception:
            db.rollback()
            continue

    db.commit()
    print(f"Done — {seeded} added, {updated} updated. Total: {len(unique_stocks)} stocks.")