"""
PSX Stock Analysis Engine
Computes 12 analysis modules from OHLCV price history.
All calculations are pure Python/pandas — no external financial API needed.
"""
from typing import Optional, List, Dict
import pandas as pd
import numpy as np


# ── helpers ───────────────────────────────────────────────────────────────────

def _safe(val, decimals=2):
    try:
        if val is None:
            return None
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, decimals)
    except Exception:
        return None


def _series(closes: List[float]) -> pd.Series:
    return pd.Series(closes, dtype=float)


# ── 1. Price Performance ──────────────────────────────────────────────────────

def price_performance(history: List[Dict]) -> Dict:
    if not history or len(history) < 2:
        return {}

    df = pd.DataFrame(history)
    df["date"]  = pd.to_datetime(df["date"])
    df["close"] = df["close"].astype(float)
    df = df.sort_values("date").reset_index(drop=True)

    now = df["close"].iloc[-1]

    def pct_return(days):
        cutoff = df["date"].iloc[-1] - pd.Timedelta(days=days)
        sub = df[df["date"] >= cutoff]
        if len(sub) < 2:
            return None
        start = sub["close"].iloc[0]
        return _safe(((now - start) / start) * 100) if start else None

    daily_ret = df["close"].pct_change().dropna() * 100
    best_day  = _safe(daily_ret.max()) if not daily_ret.empty else None
    worst_day = _safe(daily_ret.min()) if not daily_ret.empty else None
    avg_daily = _safe(daily_ret.mean()) if not daily_ret.empty else None

    return {
        "ret_1w":           pct_return(7),
        "ret_1m":           pct_return(30),
        "ret_3m":           pct_return(90),
        "ret_1y":           pct_return(365),
        "best_day":         best_day,
        "worst_day":        worst_day,
        "avg_daily_return": avg_daily,
        "positive_days":    int((daily_ret > 0).sum()),
        "total_days":       int(len(daily_ret)),
    }


# ── 2. RSI ────────────────────────────────────────────────────────────────────

def compute_rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    s     = _series(closes)
    delta = s.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss.replace(0, np.nan)
    rsi   = 100 - (100 / (1 + rs))
    val   = rsi.iloc[-1]
    return _safe(val)


def rsi_signal(rsi: Optional[float]) -> Dict:
    if rsi is None:
        return {"value": None, "signal": "Insufficient data to calculate RSI", "zone": "unknown"}
    if rsi >= 70:
        zone   = "overbought"
        signal = "Consider waiting — stock may be overpriced right now"
    elif rsi <= 30:
        zone   = "oversold"
        signal = "Potential opportunity — stock may be undervalued right now"
    elif rsi >= 55:
        zone   = "bullish"
        signal = "Momentum is positive — buyers are in control"
    elif rsi <= 45:
        zone   = "bearish"
        signal = "Momentum is weakening — sellers have the edge"
    else:
        zone   = "neutral"
        signal = "No strong signal — market is balanced"
    return {"value": rsi, "signal": signal, "zone": zone}


# ── 3. MACD ───────────────────────────────────────────────────────────────────

def compute_macd(closes: List[float]) -> Dict:
    if len(closes) < 35:
        return {
            "macd": None, "signal_line": None,
            "histogram": None, "crossover": "insufficient data",
        }
    s     = _series(closes)
    ema12 = s.ewm(span=12, adjust=False).mean()
    ema26 = s.ewm(span=26, adjust=False).mean()
    macd  = ema12 - ema26
    sig   = macd.ewm(span=9, adjust=False).mean()
    hist  = macd - sig

    m_val = _safe(macd.iloc[-1])
    s_val = _safe(sig.iloc[-1])
    h_val = _safe(hist.iloc[-1])

    if len(hist) >= 2:
        prev_h = float(hist.iloc[-2])
        curr_h = float(hist.iloc[-1])
        if prev_h < 0 and curr_h > 0:
            crossover = "bullish_crossover"
        elif prev_h > 0 and curr_h < 0:
            crossover = "bearish_crossover"
        elif curr_h > 0:
            crossover = "bullish"
        else:
            crossover = "bearish"
    else:
        crossover = "unknown"

    return {
        "macd":        m_val,
        "signal_line": s_val,
        "histogram":   h_val,
        "crossover":   crossover,
    }


# ── 4. Bollinger Bands ────────────────────────────────────────────────────────

def compute_bollinger(closes: List[float], period: int = 20) -> Dict:
    if len(closes) < period:
        return {}
    s     = _series(closes)
    sma   = s.rolling(period).mean()
    std   = s.rolling(period).std()
    upper = sma + 2 * std
    lower = sma - 2 * std

    curr  = float(closes[-1])
    u_val = _safe(upper.iloc[-1])
    l_val = _safe(lower.iloc[-1])
    m_val = _safe(sma.iloc[-1])

    if u_val and l_val and u_val != l_val:
        band_pct = _safe(((curr - l_val) / (u_val - l_val)) * 100)
    else:
        band_pct = None

    if band_pct is not None:
        if band_pct > 80:
            position = "near_upper"
            signal   = "Price is near the upper band — could be overbought or breaking out"
        elif band_pct < 20:
            position = "near_lower"
            signal   = "Price is near the lower band — could be oversold or breaking down"
        else:
            position = "middle"
            signal   = "Price is within normal range — no extreme signal"
    else:
        position = "unknown"
        signal   = "Insufficient data"

    return {
        "upper":             u_val,
        "middle":            m_val,
        "lower":             l_val,
        "band_position_pct": band_pct,
        "position":          position,
        "signal":            signal,
    }


# ── 5. Volatility ─────────────────────────────────────────────────────────────

def compute_volatility(closes: List[float]) -> Dict:
    if len(closes) < 5:
        return {}
    s          = _series(closes)
    daily_ret  = s.pct_change().dropna()
    daily_vol  = _safe(daily_ret.std() * 100)
    annual_vol = _safe(daily_ret.std() * np.sqrt(252) * 100)

    if daily_vol is None:
        return {}

    if daily_vol < 1.0:
        level       = "low"
        description = "This stock moves less than 1% per day on average — relatively stable"
    elif daily_vol < 2.0:
        level       = "moderate"
        description = "Moderate movement of 1-2% per day — typical for mid-cap stocks"
    elif daily_vol < 3.5:
        level       = "high"
        description = "High volatility — significant price swings of 2-3.5% daily"
    else:
        level       = "very_high"
        description = "Very high volatility — large swings above 3.5% daily, higher risk"

    risk_score = min(100, int(daily_vol * 25))

    return {
        "daily_pct":   daily_vol,
        "annual_pct":  annual_vol,
        "level":       level,
        "description": description,
        "risk_score":  risk_score,
    }


# ── 6. Volume Analysis ────────────────────────────────────────────────────────

def volume_analysis(history: List[Dict]) -> Dict:
    df = pd.DataFrame(history)
    if "volume" not in df.columns or df["volume"].isna().all():
        return {"available": False}

    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
    df["close"]  = pd.to_numeric(df["close"],  errors="coerce")

    # Skip if all volumes are zero
    if df["volume"].sum() == 0:
        return {"available": False}

    avg_vol   = float(df["volume"].mean())
    curr_vol  = float(df["volume"].iloc[-1])
    vol_ratio = _safe((curr_vol / avg_vol) * 100) if avg_vol > 0 else None

    if len(df) >= 10:
        recent    = float(df["volume"].iloc[-5:].mean())
        prior     = float(df["volume"].iloc[-10:-5].mean())
        vol_trend = "increasing" if recent > prior * 1.1 else \
                    "decreasing" if recent < prior * 0.9 else "stable"
    else:
        vol_trend = "unknown"

    price_up = bool(df["close"].iloc[-1] > df["close"].iloc[-5]) if len(df) >= 5 else None
    vol_up   = curr_vol > avg_vol

    if price_up is not None:
        if price_up and vol_up:
            divergence = "bullish_confirmation"
            div_signal = "Price rising with high volume — strong buying interest"
        elif price_up and not vol_up:
            divergence = "weak_rally"
            div_signal = "Price rising but volume is low — rally may not be sustainable"
        elif not price_up and vol_up:
            divergence = "bearish_confirmation"
            div_signal = "Price falling with high volume — strong selling pressure"
        else:
            divergence = "weak_decline"
            div_signal = "Price falling but volume is low — weak selling pressure"
    else:
        divergence = "unknown"
        div_signal = "Insufficient data"

    return {
        "available":  True,
        "current":    int(curr_vol),
        "average":    int(avg_vol),
        "ratio_pct":  vol_ratio,
        "trend":      vol_trend,
        "divergence": divergence,
        "div_signal": div_signal,
    }


# ── 7. Support & Resistance ───────────────────────────────────────────────────

def support_resistance(closes: List[float]) -> Dict:
    if len(closes) < 20:
        return {}

    s    = pd.Series(closes)
    curr = float(closes[-1])

    window = min(10, len(closes) // 4)
    highs  = s.rolling(window, center=True).max()
    lows   = s.rolling(window, center=True).min()

    resistance_levels = sorted(set(
        round(float(v), 0) for v in highs.dropna().unique() if float(v) > curr
    ))[:3]
    support_levels = sorted(set(
        round(float(v), 0) for v in lows.dropna().unique() if float(v) < curr
    ), reverse=True)[:3]

    high_p = float(s.max())
    low_p  = float(s.min())
    pivot  = _safe((high_p + low_p + curr) / 3)
    r1     = _safe(2 * pivot - low_p)  if pivot else None
    s1     = _safe(2 * pivot - high_p) if pivot else None

    nearest_res = resistance_levels[0] if resistance_levels else None
    nearest_sup = support_levels[0]    if support_levels    else None

    pct_to_res = _safe(((nearest_res - curr) / curr) * 100) if nearest_res else None
    pct_to_sup = _safe(((curr - nearest_sup) / curr) * 100) if nearest_sup else None

    return {
        "pivot":               pivot,
        "resistance_1":        r1,
        "support_1":           s1,
        "nearest_resistance":  nearest_res,
        "nearest_support":     nearest_sup,
        "pct_to_resistance":   pct_to_res,
        "pct_to_support":      pct_to_sup,
    }


# ── 8. Moving Averages ────────────────────────────────────────────────────────

def moving_averages(closes: List[float]) -> Dict:
    s    = _series(closes)
    curr = float(closes[-1])

    result: Dict = {}
    for p in [10, 20, 50, 200]:
        if len(closes) >= p:
            ma  = _safe(s.rolling(p).mean().iloc[-1])
            pct = _safe(((curr - ma) / ma) * 100) if ma else None
            result[f"ma{p}"]     = ma
            result[f"ma{p}_pct"] = pct

    # Golden / Death cross (needs 201 data points)
    if "ma50" in result and "ma200" in result and len(closes) >= 201:
        ma50_prev  = _safe(s.rolling(50).mean().iloc[-2])
        ma200_prev = _safe(s.rolling(200).mean().iloc[-2])
        ma50_curr  = result["ma50"]
        ma200_curr = result["ma200"]
        if all(v is not None for v in [ma50_prev, ma200_prev, ma50_curr, ma200_curr]):
            if ma50_prev < ma200_prev and ma50_curr > ma200_curr:
                result["cross"] = "golden_cross"
            elif ma50_prev > ma200_prev and ma50_curr < ma200_curr:
                result["cross"] = "death_cross"
            elif ma50_curr > ma200_curr:
                result["cross"] = "bullish_alignment"
            else:
                result["cross"] = "bearish_alignment"

    # Trend signal based on how many MAs price is above
    above_count = sum(
        1 for p in [10, 20, 50]
        if result.get(f"ma{p}") is not None and curr > result[f"ma{p}"]
    )
    if above_count == 3:
        result["trend_signal"]      = "strongly_bullish"
        result["trend_description"] = "Price is above all major moving averages — strong uptrend"
    elif above_count == 2:
        result["trend_signal"]      = "bullish"
        result["trend_description"] = "Price is above most moving averages — mild uptrend"
    elif above_count == 1:
        result["trend_signal"]      = "bearish"
        result["trend_description"] = "Price is below most moving averages — mild downtrend"
    else:
        result["trend_signal"]      = "strongly_bearish"
        result["trend_description"] = "Price is below all major moving averages — strong downtrend"

    return result


# ── 9. Trend Strength (ADX) ───────────────────────────────────────────────────

def compute_adx(history: List[Dict], period: int = 14) -> Dict:
    if len(history) < period * 2:
        return {"adx": None, "strength": "insufficient data", "direction": "unknown",
                "description": "Not enough data to calculate trend strength."}

    df = pd.DataFrame(history)
    for col in ["high", "low", "close"]:
        if col not in df.columns:
            df[col] = pd.to_numeric(df["close"], errors="coerce")
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    high  = df["high"]
    low   = df["low"]
    close = df["close"]

    plus_dm  = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)

    atr      = tr.rolling(period).mean()
    plus_di  = 100 * (plus_dm.rolling(period).mean()  / atr.replace(0, np.nan))
    minus_di = 100 * (minus_dm.rolling(period).mean() / atr.replace(0, np.nan))
    dx       = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx      = dx.rolling(period).mean()

    adx_val = _safe(adx.iloc[-1])
    pdi_val = _safe(plus_di.iloc[-1])
    mdi_val = _safe(minus_di.iloc[-1])

    if adx_val is None:
        return {"adx": None, "strength": "insufficient data", "direction": "unknown",
                "description": "Not enough data to calculate ADX."}

    if adx_val > 50:
        strength    = "very_strong"
        description = "Very strong trend in place — high conviction directional move"
    elif adx_val > 25:
        strength    = "strong"
        description = "Strong trend — good momentum, trend is likely to continue"
    elif adx_val > 20:
        strength    = "developing"
        description = "Trend is developing — watch for confirmation"
    else:
        strength    = "weak"
        description = "Weak or no trend — stock is ranging sideways"

    direction = "up" if (pdi_val and mdi_val and pdi_val > mdi_val) else "down"

    return {
        "adx":         adx_val,
        "plus_di":     pdi_val,
        "minus_di":    mdi_val,
        "strength":    strength,
        "direction":   direction,
        "description": description,
    }


# ── 10. 52-Week Analysis ──────────────────────────────────────────────────────

def week52_analysis(closes: List[float]) -> Dict:
    if len(closes) < 2:
        return {}

    year_closes = closes[-252:] if len(closes) >= 252 else closes
    high_52w    = float(max(year_closes))
    low_52w     = float(min(year_closes))
    curr        = float(closes[-1])

    if high_52w == low_52w:
        return {}

    position_pct = _safe(((curr - low_52w)  / (high_52w - low_52w)) * 100)
    from_high    = _safe(((curr - high_52w) / high_52w) * 100)
    from_low     = _safe(((curr - low_52w)  / low_52w)  * 100)

    if position_pct is not None and position_pct > 80:
        zone = "near_highs"
        desc = "Trading near 52-week highs — strong momentum but watch for resistance"
    elif position_pct is not None and position_pct < 20:
        zone = "near_lows"
        desc = "Trading near 52-week lows — potential value zone but weak momentum"
    else:
        zone = "middle_range"
        desc = "Trading in the middle of its yearly range — no extreme signal"

    return {
        "high_52w":      _safe(high_52w),
        "low_52w":       _safe(low_52w),
        "position_pct":  position_pct,
        "from_high_pct": from_high,
        "from_low_pct":  from_low,
        "zone":          zone,
        "description":   desc,
    }


# ── 11. Price Momentum Score ──────────────────────────────────────────────────

def momentum_score(closes: List[float]) -> Dict:
    if len(closes) < 20:
        return {}

    curr         = float(closes[-1])
    score_parts  = []
    weight_parts = []

    for period, weight in [(5, 0.2), (10, 0.2), (20, 0.3), (60, 0.3)]:
        if len(closes) >= period:
            past = float(closes[-period])
            roc  = ((curr - past) / past) * 100 if past != 0 else 0
            norm = min(100.0, max(0.0, 50.0 + roc * 2.0))
            score_parts.append(norm * weight)
            weight_parts.append(weight)

    if not score_parts:
        return {}

    total_weight = sum(weight_parts)
    momentum     = _safe(sum(score_parts) / total_weight) if total_weight > 0 else None

    if momentum is None:
        return {}

    if momentum >= 65:
        level = "strong_positive"
        desc  = "Strong positive momentum — price has been consistently rising"
    elif momentum >= 55:
        level = "positive"
        desc  = "Positive momentum — upward bias in recent weeks"
    elif momentum >= 45:
        level = "neutral"
        desc  = "Neutral momentum — no clear directional bias"
    elif momentum >= 35:
        level = "negative"
        desc  = "Negative momentum — downward bias in recent weeks"
    else:
        level = "strong_negative"
        desc  = "Strong negative momentum — price has been consistently falling"

    roc_5d  = _safe(((curr - closes[-5])  / closes[-5])  * 100) if len(closes) >= 5  else None
    roc_20d = _safe(((curr - closes[-20]) / closes[-20]) * 100) if len(closes) >= 20 else None

    return {
        "score":       momentum,
        "level":       level,
        "description": desc,
        "roc_5d":      roc_5d,
        "roc_20d":     roc_20d,
    }


# ── 12. Composite Score ───────────────────────────────────────────────────────

def composite_score(modules: Dict) -> Dict:
    # Each entry: (label, score_0_to_100, weight)
    scores: List[tuple] = []

    # RSI
    rsi_val = modules.get("rsi", {}).get("value")
    if rsi_val is not None:
        rsi_score = float(min(100, max(0, rsi_val)))
        if rsi_val > 75 or rsi_val < 25:
            rsi_score = 50.0  # extreme = reset to neutral
        scores.append(("RSI", rsi_score, 0.15))

    # MACD
    macd_map = {
        "bullish_crossover": 80.0, "bullish": 65.0,
        "bearish_crossover": 20.0, "bearish": 35.0,
    }
    macd_score = macd_map.get(modules.get("macd", {}).get("crossover", ""), 50.0)
    scores.append(("MACD", macd_score, 0.15))

    # Moving averages trend
    ma_map = {
        "strongly_bullish": 85.0, "bullish": 65.0,
        "bearish": 35.0,          "strongly_bearish": 15.0,
    }
    ma_score = ma_map.get(modules.get("moving_averages", {}).get("trend_signal", ""), 50.0)
    scores.append(("MA Trend", ma_score, 0.20))

    # Momentum
    mom_val = modules.get("momentum", {}).get("score")
    if mom_val is not None:
        scores.append(("Momentum", float(mom_val), 0.20))

    # Volatility (lower vol = safer = higher score)
    vol_map = {"low": 75.0, "moderate": 60.0, "high": 40.0, "very_high": 20.0}
    vol_score = vol_map.get(modules.get("volatility", {}).get("level", ""), 50.0)
    scores.append(("Volatility", vol_score, 0.10))

    # Volume divergence
    div_map = {
        "bullish_confirmation": 80.0, "weak_rally": 55.0,
        "weak_decline": 45.0,         "bearish_confirmation": 20.0,
    }
    div_score = div_map.get(modules.get("volume", {}).get("divergence", ""), 50.0)
    scores.append(("Volume", div_score, 0.10))

    # 52-week position
    w52_map = {"near_highs": 75.0, "middle_range": 55.0, "near_lows": 35.0}
    w52_score = w52_map.get(modules.get("week52", {}).get("zone", ""), 50.0)
    scores.append(("52W Position", w52_score, 0.10))

    if not scores:
        return {
            "score": 50, "grade": "C", "color": "amber", "verdict": "Neutral",
            "breakdown": [],
            "suggestion": {
                "outlook":    "Insufficient data for analysis.",
                "signals":    [],
                "disclaimer": "Educational purposes only. Not financial advice.",
            },
        }

    total_weight = sum(item[2] for item in scores)
    weighted_sum = sum(item[1] * item[2] for item in scores)
    final_score  = round(weighted_sum / total_weight, 1) if total_weight > 0 else 50.0

    if final_score >= 75:
        grade, color, verdict = "A", "green",  "Strong"
    elif final_score >= 60:
        grade, color, verdict = "B", "teal",   "Positive"
    elif final_score >= 45:
        grade, color, verdict = "C", "amber",  "Neutral"
    elif final_score >= 30:
        grade, color, verdict = "D", "orange", "Weak"
    else:
        grade, color, verdict = "F", "red",    "Bearish"

    suggestion = _build_suggestion(modules, final_score, grade)

    return {
        "score":     final_score,
        "grade":     grade,
        "color":     color,
        "verdict":   verdict,
        "breakdown": [
            {"factor": item[0], "score": round(item[1]), "weight": item[2]}
            for item in scores
        ],
        "suggestion": suggestion,
    }


def _build_suggestion(modules: Dict, score: float, grade: str) -> Dict:
    rsi  = modules.get("rsi",              {})
    macd = modules.get("macd",             {})
    ma   = modules.get("moving_averages",  {})
    vol  = modules.get("volatility",       {})

    signals = []

    rsi_val = rsi.get("value")
    if rsi_val is not None:
        if rsi_val > 70:
            signals.append("RSI is overbought — the stock has risen fast and may pause or pull back")
        elif rsi_val < 30:
            signals.append("RSI is oversold — selling may be overdone and a bounce is possible")
        elif rsi_val > 55:
            signals.append("RSI shows positive momentum — buyers are in control")
        else:
            signals.append("RSI shows neutral momentum — no strong directional signal")

    macd_c = macd.get("crossover", "")
    if macd_c == "bullish_crossover":
        signals.append("MACD just crossed bullish — a new uptrend may be starting")
    elif macd_c == "bearish_crossover":
        signals.append("MACD just crossed bearish — momentum may be turning negative")
    elif macd_c == "bullish":
        signals.append("MACD confirms upward momentum is active")
    elif macd_c == "bearish":
        signals.append("MACD shows negative momentum is active")

    ma_sig = ma.get("trend_signal", "")
    if ma_sig == "strongly_bullish":
        signals.append("Price is above all major moving averages — strong confirmed uptrend")
    elif ma_sig == "strongly_bearish":
        signals.append("Price is below all major moving averages — strong confirmed downtrend")

    vol_level = vol.get("level", "")
    if vol_level in ("high", "very_high"):
        signals.append(
            f"{vol_level.replace('_', ' ').title()} volatility — bigger price swings, "
            "suitable for experienced investors only"
        )

    if score >= 70:
        outlook = "The overall technical picture looks positive. Multiple indicators are aligned in the bullish direction."
    elif score >= 55:
        outlook = "The technical picture is mildly positive. More signals are bullish than bearish, but confirmation is needed."
    elif score >= 45:
        outlook = "Mixed signals — the stock is in a neutral zone with no clear direction currently."
    elif score >= 30:
        outlook = "The technical picture is showing weakness. More signals are bearish than bullish."
    else:
        outlook = "Multiple indicators are aligned negatively. The technical picture is bearish."

    return {
        "outlook":    outlook,
        "signals":    signals[:4],
        "disclaimer": (
            "This is a technical analysis summary for educational purposes only. "
            "It is not financial advice. Always do your own research before investing."
        ),
    }


# ── MASTER FUNCTION ───────────────────────────────────────────────────────────

def run_full_analysis(history: List[Dict], fundamentals: Optional[Dict] = None) -> Dict:
    """
    Run all 12 analysis modules on price history.
    Returns structured dict ready to serve as API response.
    """
    if not history or len(history) < 5:
        return {"error": "Insufficient price history for analysis"}

    closes = [float(h["close"]) for h in history]

    modules: Dict = {
        "performance":       price_performance(history),
        "rsi":               rsi_signal(compute_rsi(closes)),
        "macd":              compute_macd(closes),
        "bollinger":         compute_bollinger(closes),
        "volatility":        compute_volatility(closes),
        "volume":            volume_analysis(history),
        "support_resistance": support_resistance(closes),
        "moving_averages":   moving_averages(closes),
        "trend_strength":    compute_adx(history),
        "week52":            week52_analysis(closes),
        "momentum":          momentum_score(closes),
    }

    if fundamentals:
        modules["fundamentals"] = fundamentals

    modules["composite"] = composite_score(modules)

    return modules