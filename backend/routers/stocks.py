from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.stock import StockCache
import yfinance as yf

router = APIRouter(prefix="/stocks", tags=["stocks"])
KSE100_TICKERS = [
    "OGDC.KA", "HBL.KA", "LUCK.KA", "PSO.KA", "ENGRO.KA",
    "MCB.KA", "UBL.KA", "HUBC.KA", "PPL.KA", "MEBL.KA",
    "EFERT.KA", "FFC.KA", "BAHL.KA", "NESTLE.KA", "SEARL.KA",
]

# Static fallback metadata for PSX stocks yfinance doesn't cover well
STOCK_META = {
    "OGDC":   {"name": "Oil & Gas Dev. Co.",        "sector": "Energy"},
    "HBL":    {"name": "Habib Bank Limited",         "sector": "Banking"},
    "LUCK":   {"name": "Lucky Cement",               "sector": "Cement"},
    "PSO":    {"name": "Pakistan State Oil",         "sector": "Energy"},
    "ENGRO":  {"name": "Engro Corporation",          "sector": "Fertilizer"},
    "MCB":    {"name": "MCB Bank Limited",           "sector": "Banking"},
    "UBL":    {"name": "United Bank Limited",        "sector": "Banking"},
    "HUBC":   {"name": "Hub Power Company",          "sector": "Power"},
    "PPL":    {"name": "Pakistan Petroleum Ltd.",    "sector": "Energy"},
    "MEBL":   {"name": "Meezan Bank Limited",        "sector": "Banking"},
    "EFERT":  {"name": "Engro Fertilizers",          "sector": "Fertilizer"},
    "FFC":    {"name": "Fauji Fertilizer Co.",       "sector": "Fertilizer"},
    "BAHL":   {"name": "Bank Al-Habib",              "sector": "Banking"},
    "NESTLE": {"name": "Nestle Pakistan",            "sector": "Consumer"},
    "SEARL":  {"name": "The Searle Company",         "sector": "Pharma"},
}


def get_meta(symbol: str):
    return STOCK_META.get(symbol, {"name": symbol, "sector": "N/A"})


def fmt_large(val):
    if val is None:
        return None, ""
    if val >= 1_000_000_000:
        return round(val / 1_000_000_000, 2), "B PKR"
    if val >= 1_000_000:
        return round(val / 1_000_000, 2), "M PKR"
    return val, "PKR"


@router.get("/kse100")
def get_kse100_index(period: str = "3mo"):
    period_map = {"1wk": "5d", "1mo": "1mo", "3mo": "3mo", "1y": "1y"}
    yf_period = period_map.get(period, "3mo")

    # Try all known Yahoo Finance tickers for KSE-100
    symbols_to_try = ["^KSE", "^KSE100", "KSE100.KA"]
    hist = None
    used_sym = None

    for sym in symbols_to_try:
        try:
            t = yf.Ticker(sym)
            h = t.history(period=yf_period, interval="1d")
            if not h.empty and float(h["Close"].iloc[-1]) > 1000:
                # Sanity check: KSE-100 should be > 10,000 points
                # If value is < 1000 it's probably a stock price not index
                hist = h
                used_sym = sym
                break
        except Exception:
            continue

    if hist is None or hist.empty:
        raise HTTPException(
            status_code=503,
            detail="KSE-100 index data temporarily unavailable. Yahoo Finance does not reliably serve this index."
        )

    points = [
        {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iterrows()
    ]

    latest = points[-1]["close"]
    prev   = points[-2]["close"] if len(points) > 1 else latest
    change     = round(latest - prev, 2)
    change_pct = round((change / prev) * 100, 2) if prev else 0

    return {
        "current":    latest,
        "change":     change,
        "change_pct": change_pct,
        "history":    points,
        "source":     used_sym,
        "note":       None,
    }
    
    
@router.get("/top")
def get_top_stocks():
    """
    Fetch top PSX stocks using bulk download for speed,
    then enrich with static metadata.
    """
    symbols = [s for s in KSE100_TICKERS]
    results = []

    try:
        # Bulk download — much faster than individual calls
        data = yf.download(
            tickers=" ".join(symbols),
            period="5d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Data fetch failed: {str(e)}")

    for sym in symbols:
        clean = sym.replace(".KA", "")
        try:
            # Handle both single and multi-ticker dataframes
            if len(symbols) == 1:
                hist = data
            else:
                if sym not in data.columns.get_level_values(0):
                    continue
                hist = data[sym]

            hist = hist.dropna(subset=["Close"])
            if hist.empty or len(hist) < 1:
                continue

            close = round(float(hist["Close"].iloc[-1]), 2)
            ldcp  = round(float(hist["Close"].iloc[-2]) if len(hist) > 1 else close, 2)
            change    = round(close - ldcp, 2)
            chg_pct   = round((change / ldcp) * 100, 2) if ldcp else 0
            volume    = int(hist["Volume"].iloc[-1]) if "Volume" in hist.columns else 0

            # 52-week range from available history
            high_52w = round(float(hist["Close"].max()), 2)
            low_52w  = round(float(hist["Close"].min()), 2)

            meta = get_meta(clean)
            results.append({
                "symbol":     clean,
                "name":       meta["name"],
                "sector":     meta["sector"],
                "close":      close,
                "ldcp":       ldcp,
                "change":     change,
                "change_pct": chg_pct,
                "volume":     volume,
                "high_52w":   high_52w,
                "low_52w":    low_52w,
            })
        except Exception:
            continue

    # Sort by absolute % change descending
    results.sort(key=lambda x: abs(x["change_pct"]), reverse=True)
    return results


@router.get("/search")
def search_stocks(q: str, db: Session = Depends(get_db)):
    """Search all PSX stocks from database."""
    q_lower = q.lower().strip()
    if not q_lower:
        return []

    results = db.query(StockCache).filter(
        (StockCache.symbol.ilike(f"%{q_lower}%")) |
        (StockCache.name.ilike(f"%{q_lower}%")) |
        (StockCache.sector.ilike(f"%{q_lower}%"))
    ).filter(StockCache.is_active == 1).limit(10).all()

    return [
        {
            "symbol": r.symbol,
            "name":   r.name,
            "sector": r.sector or "N/A",
        }
        for r in results
    ]


@router.get("/{symbol}")
def get_stock_detail(symbol: str, period: str = "3mo", db: Session = Depends(get_db)):
    symbol_upper = symbol.upper()
    yf_symbol    = f"{symbol_upper}.KA"

    # Look up in DB first, fall back to static meta
    db_stock = db.query(StockCache).filter(
        StockCache.symbol == symbol_upper
    ).first()

    if db_stock:
        meta = {"name": db_stock.name, "sector": db_stock.sector or "N/A"}
    else:
        meta = get_meta(symbol_upper)

    period_map = {
        "1wk": "5d",
        "1mo": "1mo",
        "3mo": "3mo",
        "1y":  "1y",
    }
    yf_period = period_map.get(period, "3mo")

    try:
        t    = yf.Ticker(yf_symbol)
        hist = t.history(period=yf_period, interval="1d")

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data found for {symbol_upper}")

        hist = hist.dropna(subset=["Close"])

        # ── Price history ──────────────────────────────────────────
        history = [
            {
                "date":   str(idx.date()),
                "close":  round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] else 0,
            }
            for idx, row in hist.iterrows()
        ]

        current_price = round(float(hist["Close"].iloc[-1]), 2)
        ldcp          = round(float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_price, 2)
        change        = round(current_price - ldcp, 2)
        change_pct    = round((change / ldcp) * 100, 2) if ldcp else 0

        # ── Calculated from history ────────────────────────────────
        closes        = hist["Close"]
        high_period   = round(float(closes.max()), 2)
        low_period    = round(float(closes.min()), 2)
        avg_price     = round(float(closes.mean()), 2)

        # Simple volatility: std dev of daily % returns
        daily_returns = closes.pct_change().dropna()
        volatility    = round(float(daily_returns.std() * 100), 2) if len(daily_returns) > 1 else None

        # Price vs period average (momentum signal)
        above_avg     = current_price > avg_price

        # Volume stats
        volumes       = hist["Volume"].dropna()
        avg_vol       = int(volumes.mean()) if len(volumes) > 0 else 0
        latest_vol    = int(hist["Volume"].iloc[-1]) if len(hist) > 0 else 0
        vol_vs_avg    = round((latest_vol / avg_vol) * 100, 1) if avg_vol > 0 else None

        # ── Try yfinance info (may be partial for PSX) ─────────────
        info          = {}
        try:
            info = t.info or {}
        except Exception:
            pass

        pe_ratio       = info.get("trailingPE")
        eps            = info.get("trailingEps")
        pb_ratio       = info.get("priceToBook")
        market_cap     = info.get("marketCap")
        dividend_yield = info.get("dividendYield")
        dividend_rate  = info.get("dividendRate")
        beta           = info.get("beta")
        profit_margin  = info.get("profitMargins")
        roe            = info.get("returnOnEquity")
        debt_to_equity = info.get("debtToEquity")
        current_ratio  = info.get("currentRatio")
        revenue        = info.get("totalRevenue")
        description    = info.get("longBusinessSummary") or ""
        high_52w       = info.get("fiftyTwoWeekHigh")
        low_52w        = info.get("fiftyTwoWeekLow")

        mc_val, mc_unit = fmt_large(market_cap)
        rev_val, _      = fmt_large(revenue)

        # ── Plain-language explainers ──────────────────────────────
        def pe_explainer():
            if not pe_ratio:
                return "P/E ratio not available from data source. This is common for PSX stocks on Yahoo Finance."
            val = round(pe_ratio, 1)
            if val < 6:
                mood = "Very cheap relative to earnings — could be undervalued or facing challenges."
            elif val < 10:
                mood = "Reasonably valued by PSX standards."
            elif val < 15:
                mood = "Fair value — investors expect steady growth."
            else:
                mood = "Higher valuation — market expects strong future growth."
            return f"Investors pay PKR {val} for every PKR 1 of profit. {mood}"

        def div_explainer():
            if not dividend_yield:
                return "No dividend data available. The company may reinvest profits instead of paying dividends."
            pct = round(dividend_yield * 100, 2)
            rate = round(dividend_rate, 2) if dividend_rate else "N/A"
            mood = "Strong income stock — above average PSX yield." if pct > 5 else "Moderate dividend — balanced growth and income."
            return f"Pays PKR {rate}/share annually ({pct}% yield). {mood}"

        def volatility_explainer():
            if not volatility:
                return "Volatility data not available."
            if volatility < 1:
                return f"Daily price moves ~{volatility}% on average. Very stable — low risk."
            elif volatility < 2:
                return f"Daily price moves ~{volatility}% on average. Moderate volatility — normal for PSX."
            else:
                return f"Daily price moves ~{volatility}% on average. High volatility — higher risk but potential for bigger gains."

        def momentum_explainer():
            diff = round(((current_price - avg_price) / avg_price) * 100, 1)
            direction = "above" if above_avg else "below"
            mood = "Positive momentum — currently trading strong." if above_avg else "Currently trading weak — watch for recovery."
            return f"Price is {abs(diff)}% {direction} the {period} average of PKR {avg_price}. {mood}"

        def volume_explainer():
            if not vol_vs_avg:
                return "Volume data not available."
            if vol_vs_avg > 150:
                return f"Today's volume is {vol_vs_avg}% of average — unusually high activity. Something may be moving this stock."
            elif vol_vs_avg < 50:
                return f"Today's volume is {vol_vs_avg}% of average — very quiet trading day."
            return f"Trading volume is normal ({vol_vs_avg}% of average)."

        return {
            # Identity
            "symbol":      symbol_upper,
            "name":        meta["name"],
            "sector":      meta["sector"],
            "industry":    info.get("industry") or "N/A",
            "description": description,
            "website":     info.get("website") or "",

            # Current price
            "current_price": current_price,
            "ldcp":          ldcp,
            "change":        change,
            "change_pct":    change_pct,

            # Period range (from history)
            "high_period":  high_period,
            "low_period":   low_period,
            "avg_price":    avg_price,

            # 52-week (from yfinance info — may be null)
            "high_52w": round(high_52w, 2) if high_52w else None,
            "low_52w":  round(low_52w, 2) if low_52w else None,

            # Volume
            "volume_today": latest_vol,
            "avg_volume":   avg_vol,
            "vol_vs_avg":   vol_vs_avg,

            # Valuation (may be null for PSX)
            "pe_ratio":           round(pe_ratio, 2) if pe_ratio else None,
            "eps":                round(eps, 2) if eps else None,
            "pb_ratio":           round(pb_ratio, 2) if pb_ratio else None,
            "market_cap_val":     mc_val,
            "market_cap_unit":    mc_unit,
            "dividend_yield_pct": round(dividend_yield * 100, 2) if dividend_yield else None,
            "dividend_rate":      round(dividend_rate, 2) if dividend_rate else None,
            "beta":               round(beta, 2) if beta else None,

            # Financials (may be null for PSX)
            "revenue_val":       rev_val,
            "profit_margin_pct": round(profit_margin * 100, 2) if profit_margin else None,
            "roe_pct":           round(roe * 100, 2) if roe else None,
            "debt_to_equity":    round(debt_to_equity, 2) if debt_to_equity else None,
            "current_ratio":     round(current_ratio, 2) if current_ratio else None,

            # Calculated metrics (always available from history)
            "volatility_pct": volatility,
            "above_avg":      above_avg,

            # Chart
            "history": history,

            # Explainers — plain language for young investors
            "explainers": {
                "pe_ratio":   pe_explainer(),
                "dividend":   div_explainer(),
                "volatility": volatility_explainer(),
                "momentum":   momentum_explainer(),
                "volume":     volume_explainer(),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
