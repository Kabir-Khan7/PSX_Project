from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from routers import auth, stocks, watchlist
from models import user
from models.stock import StockCache
from models.watchlist import Watchlist
from services.seed import seed_psx_stocks

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    seed_psx_stocks(db)
finally:
    db.close()

app = FastAPI(title="PSX Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(watchlist.router)

@app.get("/")
def root():
    return {"message": "PSX Analysis API is running"}