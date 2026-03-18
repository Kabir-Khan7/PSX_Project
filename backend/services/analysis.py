"""
PSX Stock Analysis Engine — Extended v2
20 analysis modules from OHLCV price history.
"""
from typing import Optional, List, Dict
import pandas as pd
import numpy as np


def _safe(val, decimals=2):
    try:
        if val is None: return None
        f = float(val)
        if np.isnan(f) or np.isinf(f): return None
        return round(f, decimals)
    except Exception: return None

def _series(closes): return pd.Series(closes, dtype=float)


# ── 1. Price Performance ──────────────────────────────────────────────────────
def price_performance(history):
    if not history or len(history) < 2: return {}
    df = pd.DataFrame(history)
    df["date"]  = pd.to_datetime(df["date"])
    df["close"] = df["close"].astype(float)
    df = df.sort_values("date").reset_index(drop=True)
    now = df["close"].iloc[-1]
    def pct_return(days):
        cutoff = df["date"].iloc[-1] - pd.Timedelta(days=days)
        sub = df[df["date"] >= cutoff]
        if len(sub) < 2: return None
        start = sub["close"].iloc[0]
        return _safe(((now - start) / start) * 100) if start else None
    daily_ret = df["close"].pct_change().dropna() * 100
    return {
        "ret_1w": pct_return(7), "ret_1m": pct_return(30),
        "ret_3m": pct_return(90), "ret_1y": pct_return(365),
        "best_day": _safe(daily_ret.max()) if not daily_ret.empty else None,
        "worst_day": _safe(daily_ret.min()) if not daily_ret.empty else None,
        "avg_daily_return": _safe(daily_ret.mean()) if not daily_ret.empty else None,
        "positive_days": int((daily_ret > 0).sum()),
        "total_days": int(len(daily_ret)),
    }


# ── 2. RSI ────────────────────────────────────────────────────────────────────
def compute_rsi(closes, period=14):
    if len(closes) < period + 1: return None
    s = _series(closes)
    delta = s.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss.replace(0, np.nan)
    return _safe((100 - (100 / (1 + rs))).iloc[-1])

def rsi_signal(rsi):
    if rsi is None: return {"value": None, "signal": "Insufficient data", "zone": "unknown"}
    zone, signal = (
        ("overbought", "Stock may be overpriced — potential pullback ahead") if rsi >= 70 else
        ("oversold",   "Stock may be oversold — potential bounce ahead")      if rsi <= 30 else
        ("bullish",    "Momentum positive — buyers in control")               if rsi >= 55 else
        ("bearish",    "Momentum weakening — sellers have the edge")          if rsi <= 45 else
        ("neutral",    "Balanced market — no strong signal")
    )
    return {"value": rsi, "signal": signal, "zone": zone}


# ── 3. MACD ───────────────────────────────────────────────────────────────────
def compute_macd(closes):
    if len(closes) < 35:
        return {"macd": None, "signal_line": None, "histogram": None, "crossover": "insufficient data"}
    s = _series(closes)
    macd = s.ewm(span=12, adjust=False).mean() - s.ewm(span=26, adjust=False).mean()
    sig  = macd.ewm(span=9, adjust=False).mean()
    hist = macd - sig
    if len(hist) >= 2:
        p, c = float(hist.iloc[-2]), float(hist.iloc[-1])
        crossover = ("bullish_crossover" if p < 0 and c > 0 else
                     "bearish_crossover" if p > 0 and c < 0 else
                     "bullish" if c > 0 else "bearish")
    else: crossover = "unknown"
    return {"macd": _safe(macd.iloc[-1]), "signal_line": _safe(sig.iloc[-1]),
            "histogram": _safe(hist.iloc[-1]), "crossover": crossover}


# ── 4. Bollinger Bands ────────────────────────────────────────────────────────
def compute_bollinger(closes, period=20):
    if len(closes) < period: return {}
    s = _series(closes)
    sma, std = s.rolling(period).mean(), s.rolling(period).std()
    upper, lower = sma + 2*std, sma - 2*std
    curr = float(closes[-1])
    u, l, m = _safe(upper.iloc[-1]), _safe(lower.iloc[-1]), _safe(sma.iloc[-1])
    band_pct = _safe(((curr - l) / (u - l)) * 100) if u and l and u != l else None
    bw = _safe(((u - l) / m) * 100) if m and u and l else None
    position = ("near_upper" if band_pct and band_pct > 80 else
                "near_lower" if band_pct and band_pct < 20 else "middle")
    signal   = {"near_upper": "Near upper band — overbought or strong breakout",
                "near_lower": "Near lower band — oversold or breakdown risk",
                "middle":     "Within normal range — no extreme signal"}[position]
    return {"upper": u, "middle": m, "lower": l, "band_position_pct": band_pct,
            "bandwidth_pct": bw, "position": position, "signal": signal}


# ── 5. Volatility ─────────────────────────────────────────────────────────────
def compute_volatility(closes):
    if len(closes) < 5: return {}
    s = _series(closes)
    dr = s.pct_change().dropna()
    dv = _safe(dr.std() * 100)
    av = _safe(dr.std() * np.sqrt(252) * 100)
    if dv is None: return {}
    level = ("low" if dv < 1.0 else "moderate" if dv < 2.0 else "high" if dv < 3.5 else "very_high")
    descs = {"low": "Moves <1%/day — stable", "moderate": "1-2%/day — typical blue chip",
             "high": "2-3.5%/day — elevated risk", "very_high": ">3.5%/day — highly speculative"}
    return {"daily_pct": dv, "annual_pct": av, "level": level,
            "description": descs[level], "risk_score": min(100, int(dv * 25))}


# ── 6. Volume Analysis ────────────────────────────────────────────────────────
def volume_analysis(history):
    df = pd.DataFrame(history)
    if "volume" not in df.columns or df["volume"].isna().all(): return {"available": False}
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
    df["close"]  = pd.to_numeric(df["close"],  errors="coerce")
    if df["volume"].sum() == 0: return {"available": False}
    avg, curr = float(df["volume"].mean()), float(df["volume"].iloc[-1])
    vol_ratio = _safe((curr / avg) * 100) if avg > 0 else None
    vol_trend = "unknown"
    if len(df) >= 10:
        r, p = float(df["volume"].iloc[-5:].mean()), float(df["volume"].iloc[-10:-5].mean())
        vol_trend = "increasing" if r > p*1.1 else "decreasing" if r < p*0.9 else "stable"
    price_up = bool(df["close"].iloc[-1] > df["close"].iloc[-5]) if len(df) >= 5 else None
    vol_up = curr > avg
    if price_up is not None:
        div = ("bullish_confirmation" if price_up and vol_up else
               "weak_rally"           if price_up and not vol_up else
               "bearish_confirmation" if not price_up and vol_up else "weak_decline")
        sig = {"bullish_confirmation": "Price rising + high volume — strong conviction",
               "weak_rally": "Price rising + low volume — weak conviction",
               "bearish_confirmation": "Price falling + high volume — strong selling",
               "weak_decline": "Price falling + low volume — weak selling"}[div]
    else: div, sig = "unknown", "Insufficient data"
    return {"available": True, "current": int(curr), "average": int(avg),
            "ratio_pct": vol_ratio, "trend": vol_trend, "divergence": div, "div_signal": sig}


# ── 7. Support & Resistance ───────────────────────────────────────────────────
def support_resistance(closes):
    if len(closes) < 20: return {}
    s = pd.Series(closes)
    curr = float(closes[-1])
    window = min(10, len(closes) // 4)
    highs, lows = s.rolling(window, center=True).max(), s.rolling(window, center=True).min()
    res = sorted(set(round(float(v), 0) for v in highs.dropna().unique() if float(v) > curr))[:3]
    sup = sorted(set(round(float(v), 0) for v in lows.dropna().unique()  if float(v) < curr), reverse=True)[:3]
    hp, lp = float(s.max()), float(s.min())
    pivot = _safe((hp + lp + curr) / 3)
    nr = res[0] if res else None
    ns = sup[0] if sup else None
    return {"pivot": pivot,
            "resistance_1": _safe(2*pivot - lp) if pivot else None,
            "support_1":    _safe(2*pivot - hp) if pivot else None,
            "nearest_resistance": nr, "nearest_support": ns,
            "pct_to_resistance": _safe(((nr - curr) / curr) * 100) if nr else None,
            "pct_to_support":    _safe(((curr - ns)  / curr) * 100) if ns else None}


# ── 8. Moving Averages ────────────────────────────────────────────────────────
def moving_averages(closes):
    s = _series(closes)
    curr = float(closes[-1])
    result = {}
    for p in [10, 20, 50, 200]:
        if len(closes) >= p:
            ma = _safe(s.rolling(p).mean().iloc[-1])
            result[f"ma{p}"]     = ma
            result[f"ma{p}_pct"] = _safe(((curr - ma) / ma) * 100) if ma else None
    if "ma50" in result and "ma200" in result and len(closes) >= 201:
        m50p  = _safe(s.rolling(50).mean().iloc[-2])
        m200p = _safe(s.rolling(200).mean().iloc[-2])
        m50c, m200c = result["ma50"], result["ma200"]
        if all(v is not None for v in [m50p, m200p, m50c, m200c]):
            result["cross"] = ("golden_cross"      if m50p < m200p and m50c > m200c else
                               "death_cross"       if m50p > m200p and m50c < m200c else
                               "bullish_alignment" if m50c > m200c else "bearish_alignment")
    above = sum(1 for p in [10, 20, 50] if result.get(f"ma{p}") and curr > result[f"ma{p}"])
    sigs = ["strongly_bearish","bearish","bullish","strongly_bullish"]
    desc = ["Below all MAs — strong downtrend","Below most MAs — mild downtrend",
            "Above most MAs — mild uptrend","Above all MAs — strong uptrend"]
    result["trend_signal"] = sigs[above]
    result["trend_description"] = desc[above]
    return result


# ── 9. ADX ────────────────────────────────────────────────────────────────────
def compute_adx(history, period=14):
    if len(history) < period * 2:
        return {"adx": None, "strength": "insufficient data", "direction": "unknown", "description": "Need more data."}
    df = pd.DataFrame(history)
    for col in ["high", "low", "close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    plus_dm  = df["high"].diff().clip(lower=0)
    minus_dm = (-df["low"].diff()).clip(lower=0)
    tr  = pd.concat([df["high"]-df["low"], (df["high"]-df["close"].shift()).abs(),
                     (df["low"]-df["close"].shift()).abs()], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()
    plus_di  = 100 * (plus_dm.rolling(period).mean()  / atr.replace(0, np.nan))
    minus_di = 100 * (minus_dm.rolling(period).mean() / atr.replace(0, np.nan))
    adx = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)).rolling(period).mean()
    av, pdi, mdi = _safe(adx.iloc[-1]), _safe(plus_di.iloc[-1]), _safe(minus_di.iloc[-1])
    if av is None: return {"adx": None, "strength": "insufficient data", "direction": "unknown", "description": ""}
    strength = ("very_strong" if av > 50 else "strong" if av > 25 else "developing" if av > 20 else "weak")
    return {"adx": av, "plus_di": pdi, "minus_di": mdi, "strength": strength,
            "direction": "up" if pdi and mdi and pdi > mdi else "down",
            "description": {"very_strong":"Very strong trend","strong":"Strong trend",
                            "developing":"Developing trend","weak":"Weak/no trend — ranging"}[strength]}


# ── 10. 52-Week ───────────────────────────────────────────────────────────────
def week52_analysis(closes):
    if len(closes) < 2: return {}
    yr = closes[-252:] if len(closes) >= 252 else closes
    hi, lo, curr = float(max(yr)), float(min(yr)), float(closes[-1])
    if hi == lo: return {}
    pos = _safe(((curr - lo) / (hi - lo)) * 100)
    zone = "near_highs" if pos and pos > 80 else "near_lows" if pos and pos < 20 else "middle_range"
    return {"high_52w": _safe(hi), "low_52w": _safe(lo), "position_pct": pos,
            "from_high_pct": _safe(((curr - hi) / hi) * 100),
            "from_low_pct":  _safe(((curr - lo) / lo) * 100), "zone": zone,
            "description": {"near_highs":"Near 52W highs — strong momentum","near_lows":"Near 52W lows — potential value zone","middle_range":"Mid yearly range — neutral"}[zone]}


# ── 11. Momentum Score ────────────────────────────────────────────────────────
def momentum_score(closes):
    if len(closes) < 20: return {}
    curr, parts, weights = float(closes[-1]), [], []
    for period, weight in [(5,0.2),(10,0.2),(20,0.3),(60,0.3)]:
        if len(closes) >= period:
            past = float(closes[-period])
            parts.append(min(100.0, max(0.0, 50.0 + (((curr-past)/past)*100 if past else 0)*2.0)) * weight)
            weights.append(weight)
    if not parts: return {}
    score = _safe(sum(parts) / sum(weights))
    if score is None: return {}
    level = ("strong_positive" if score >= 65 else "positive" if score >= 55 else
             "neutral" if score >= 45 else "negative" if score >= 35 else "strong_negative")
    return {"score": score, "level": level,
            "description": {"strong_positive":"Price consistently rising","positive":"Upward bias",
                            "neutral":"No clear bias","negative":"Downward bias",
                            "strong_negative":"Price consistently falling"}[level],
            "roc_5d":  _safe(((curr-closes[-5])/closes[-5])*100)  if len(closes)>=5  else None,
            "roc_20d": _safe(((curr-closes[-20])/closes[-20])*100) if len(closes)>=20 else None}


# ── 12. Stochastic Oscillator ─────────────────────────────────────────────────
def compute_stochastic(history, k_period=14, d_period=3):
    if len(history) < k_period + d_period:
        return {"k": None, "d": None, "zone": "unknown", "signal": "Insufficient data"}
    df = pd.DataFrame(history)
    for col in ["high","low","close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    lo = df["low"].rolling(k_period).min()
    hi = df["high"].rolling(k_period).max()
    k = 100 * (df["close"] - lo) / (hi - lo).replace(0, np.nan)
    d = k.rolling(d_period).mean()
    kv, dv = _safe(k.iloc[-1]), _safe(d.iloc[-1])
    if kv is None: return {"k": None, "d": None, "zone": "unknown", "signal": "Insufficient data"}
    zone = "overbought" if kv > 80 else "oversold" if kv < 20 else "bullish" if kv > 50 else "bearish"
    crossover = "none"
    if len(k) >= 2 and len(d) >= 2:
        if float(k.iloc[-2]) < float(d.iloc[-2]) and kv > dv: crossover = "bullish_crossover"
        elif float(k.iloc[-2]) > float(d.iloc[-2]) and kv < dv: crossover = "bearish_crossover"
    return {"k": kv, "d": dv, "zone": zone, "crossover": crossover,
            "signal": (f"Overbought at {kv:.1f} — selling may increase" if zone == "overbought" else
                       f"Oversold at {kv:.1f} — buying opportunity may form" if zone == "oversold" else
                       f"Bullish crossover at {kv:.1f}" if crossover == "bullish_crossover" else
                       f"Bearish crossover at {kv:.1f}" if crossover == "bearish_crossover" else
                       f"Stochastic at {kv:.1f}")}


# ── 13. Williams %R ───────────────────────────────────────────────────────────
def compute_williams_r(history, period=14):
    if len(history) < period: return {"value": None, "zone": "unknown", "signal": "Insufficient data"}
    df = pd.DataFrame(history)
    for col in ["high","low","close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    hi = df["high"].rolling(period).max()
    lo = df["low"].rolling(period).min()
    wr = -100 * (hi - df["close"]) / (hi - lo).replace(0, np.nan)
    val = _safe(wr.iloc[-1])
    if val is None: return {"value": None, "zone": "unknown", "signal": "Insufficient data"}
    zone = "overbought" if val > -20 else "oversold" if val < -80 else "neutral"
    return {"value": val, "zone": zone,
            "signal": (f"Overbought ({val:.1f}) — near period highs, possible reversal" if val > -20 else
                       f"Oversold ({val:.1f}) — near period lows, possible bounce" if val < -80 else
                       f"Neutral ({val:.1f}) — between extremes")}


# ── 14. ATR ───────────────────────────────────────────────────────────────────
def compute_atr(history, period=14):
    if len(history) < period + 1: return {"atr": None, "signal": "Insufficient data"}
    df = pd.DataFrame(history)
    for col in ["high","low","close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    tr = pd.concat([df["high"]-df["low"], (df["high"]-df["close"].shift()).abs(),
                    (df["low"]-df["close"].shift()).abs()], axis=1).max(axis=1)
    val = _safe(tr.rolling(period).mean().iloc[-1])
    curr = float(df["close"].iloc[-1])
    pct  = _safe((val / curr) * 100) if val and curr else None
    return {"atr": val, "atr_pct": pct,
            "signal": f"Expected daily move: PKR {val:.2f} ({pct:.1f}% of price). {'High movement' if pct and pct > 3 else 'Normal range'}." if val else "Insufficient data"}


# ── 15. OBV ───────────────────────────────────────────────────────────────────
def compute_obv(history):
    df = pd.DataFrame(history)
    if "volume" not in df.columns or df["volume"].sum() == 0: return {"available": False}
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
    df["close"]  = pd.to_numeric(df["close"],  errors="coerce")
    running, obv = 0, []
    for i in range(len(df)):
        if i == 0: obv.append(0); continue
        if df["close"].iloc[i] > df["close"].iloc[i-1]: running += df["volume"].iloc[i]
        elif df["close"].iloc[i] < df["close"].iloc[i-1]: running -= df["volume"].iloc[i]
        obv.append(running)
    obv_s = pd.Series(obv)
    if len(obv_s) < 10: return {"available": False}
    pt = "up" if df["close"].iloc[-1] > df["close"].iloc[-10] else "down"
    ot = "up" if obv_s.iloc[-1] > obv_s.iloc[-10] else "down"
    conf = ("confirmed" if pt == ot else "divergence" if pt == "up" else "bullish_divergence")
    sigs = {"confirmed":           "Volume confirms the price trend",
            "divergence":          "Price rising but OBV falling — rally lacks conviction ⚠️",
            "bullish_divergence":  "Price falling but OBV rising — possible accumulation"}
    return {"available": True, "current_obv": int(obv_s.iloc[-1]),
            "price_trend": pt, "obv_trend": ot, "confirmation": conf, "signal": sigs.get(conf, "")}


# ── 16. Fibonacci Levels ──────────────────────────────────────────────────────
def fibonacci_levels(closes):
    if len(closes) < 20: return {}
    s = pd.Series(closes)
    hi, lo, curr = float(s.max()), float(s.min()), float(closes[-1])
    diff = hi - lo
    levels = {k: _safe(hi - r*diff) for k, r in
              [("0.0",0),("23.6",0.236),("38.2",0.382),("50.0",0.5),("61.8",0.618),("78.6",0.786),("100.0",1)]}
    nearest_key, nearest_val, nearest_dist = "", None, float("inf")
    for k, v in levels.items():
        if v and abs(curr-v) < nearest_dist:
            nearest_dist, nearest_val, nearest_key = abs(curr-v), v, k
    return {"levels": levels, "nearest_level": nearest_val, "nearest_key": nearest_key,
            "pct_to_nearest": _safe((nearest_dist/curr)*100) if nearest_val else None,
            "high": _safe(hi), "low": _safe(lo),
            "signal": f"Near {nearest_key}% Fibonacci level (PKR {nearest_val:.2f}) — key zone watched by traders worldwide" if nearest_val else ""}


# ── 17. Candlestick Patterns ──────────────────────────────────────────────────
def candlestick_patterns(history):
    if len(history) < 3: return {"patterns": [], "overall": "neutral", "signal": "Insufficient data"}
    df = pd.DataFrame(history)
    for col in ["open","high","low","close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    patterns = []
    o,h,l,c  = float(df["open"].iloc[-1]),float(df["high"].iloc[-1]),float(df["low"].iloc[-1]),float(df["close"].iloc[-1])
    body, rng = abs(c-o), h-l
    if rng > 0 and body/rng < 0.1:
        patterns.append({"name":"Doji","type":"neutral","description":"Open≈Close — market indecision. Reversal may follow."})
    if rng > 0 and body/rng < 0.3 and (min(o,c)-l) > 2*body and (h-max(o,c)) < body:
        patterns.append({"name":"Hammer","type":"bullish","description":"Long lower wick — buyers rejected the lows. Bullish reversal signal."})
    if rng > 0 and body/rng < 0.3 and (h-max(o,c)) > 2*body and (min(o,c)-l) < body:
        patterns.append({"name":"Shooting Star","type":"bearish","description":"Long upper wick — sellers took control at highs. Bearish reversal."})
    if len(df) >= 2:
        o2, c2 = float(df["open"].iloc[-2]), float(df["close"].iloc[-2])
        if c2 < o2 and c > o and c > o2 and o < c2:
            patterns.append({"name":"Bullish Engulfing","type":"bullish","description":"Green candle engulfs prior red — strong bullish reversal."})
        if c2 > o2 and c < o and c < o2 and o > c2:
            patterns.append({"name":"Bearish Engulfing","type":"bearish","description":"Red candle engulfs prior green — strong bearish reversal."})
    if rng > 0 and body/rng > 0.95:
        typ = "bullish" if c > o else "bearish"
        patterns.append({"name":f"{'Bullish' if typ=='bullish' else 'Bearish'} Marubozu","type":typ,
                         "description":f"No wicks — {'buyers' if typ=='bullish' else 'sellers'} dominated entire session."})
    bull_c = sum(1 for p in patterns if p["type"]=="bullish")
    bear_c = sum(1 for p in patterns if p["type"]=="bearish")
    overall = "bullish" if bull_c > bear_c else "bearish" if bear_c > bull_c else "neutral"
    return {"patterns": patterns, "overall": overall,
            "signal": f"{len(patterns)} pattern(s) detected in latest candles" if patterns else "No major candlestick patterns detected"}


# ── 18. Risk-Adjusted Return ──────────────────────────────────────────────────
def risk_adjusted_return(closes):
    if len(closes) < 20: return {}
    dr = _series(closes).pct_change().dropna()
    avg, std = float(dr.mean()), float(dr.std())
    ann_ret = avg * 252 * 100
    ann_vol = std * np.sqrt(252) * 100
    rf = 12.0  # Pakistan risk-free rate ~12%
    sharpe = _safe((ann_ret - rf) / ann_vol) if ann_vol > 0 else None
    if sharpe is None: return {}
    grade = "excellent" if sharpe > 1 else "good" if sharpe > 0.5 else "fair" if sharpe > 0 else "poor"
    descs = {"excellent":"Excellent — reward far exceeds risk","good":"Good risk-adjusted return",
             "fair":"Fair — some reward for the risk","poor":"Poor — not compensated for volatility"}
    return {"sharpe": sharpe, "ann_return_pct": _safe(ann_ret), "ann_vol_pct": _safe(ann_vol),
            "grade": grade, "description": descs[grade]}


# ── 19. Price Channel (Donchian) ──────────────────────────────────────────────
def price_channel(history, period=20):
    if len(history) < period: return {}
    df = pd.DataFrame(history)
    for col in ["high","low","close"]:
        df[col] = pd.to_numeric(df.get(col, df["close"]), errors="coerce")
    upper = float(df["high"].rolling(period).max().iloc[-1])
    lower = float(df["low"].rolling(period).min().iloc[-1])
    mid   = (upper + lower) / 2
    curr  = float(df["close"].iloc[-1])
    if upper == lower: return {}
    pos = _safe(((curr - lower) / (upper - lower)) * 100)
    sig = ("Near channel HIGH — potential upward breakout" if pos and pos > 80 else
           "Near channel LOW — potential bounce or breakdown" if pos and pos < 20 else
           "Middle of channel — no clear breakout signal")
    return {"upper": _safe(upper), "lower": _safe(lower), "middle": _safe(mid), "position_pct": pos, "signal": sig}


# ── 20. VWAP ─────────────────────────────────────────────────────────────────
def compute_vwap(history):
    df = pd.DataFrame(history)
    if "volume" not in df.columns or df["volume"].sum() == 0: return {"available": False}
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
    df["close"]  = pd.to_numeric(df["close"],  errors="coerce")
    df["high"]   = pd.to_numeric(df.get("high",  df["close"]), errors="coerce")
    df["low"]    = pd.to_numeric(df.get("low",   df["close"]), errors="coerce")
    tp = (df["high"] + df["low"] + df["close"]) / 3
    vwap_val = _safe((tp * df["volume"]).cumsum().iloc[-1] / df["volume"].cumsum().iloc[-1])
    curr = float(df["close"].iloc[-1])
    if vwap_val is None: return {"available": False}
    pct = _safe(((curr - vwap_val) / vwap_val) * 100)
    above = curr > vwap_val
    return {"available": True, "vwap": vwap_val, "above_vwap": above, "pct_from_vwap": pct,
            "signal": f"Price {'above' if above else 'below'} VWAP (PKR {vwap_val:.2f}) by {abs(pct or 0):.1f}%. {'Bullish institutional bias' if above else 'Bearish — price below average traded price'}"}


# ── Composite Score ───────────────────────────────────────────────────────────
def composite_score(modules):
    scores = []
    rv = modules.get("rsi",{}).get("value")
    if rv is not None:
        rs = float(min(100, max(0, rv)))
        if rv > 75 or rv < 25: rs = 50.0
        scores.append(("RSI", rs, 0.10))
    macd_map = {"bullish_crossover":85,"bullish":65,"bearish_crossover":15,"bearish":35}
    scores.append(("MACD", float(macd_map.get(modules.get("macd",{}).get("crossover",""),50)), 0.10))
    ma_map = {"strongly_bullish":85,"bullish":65,"bearish":35,"strongly_bearish":15}
    scores.append(("MA Trend", float(ma_map.get(modules.get("moving_averages",{}).get("trend_signal",""),50)), 0.12))
    mom = modules.get("momentum",{}).get("score")
    if mom is not None: scores.append(("Momentum", float(mom), 0.12))
    stoch = modules.get("stochastic",{})
    sm = {"overbought":25,"oversold":75,"bullish":65,"bearish":35,"neutral":50}
    if stoch.get("k") is not None: scores.append(("Stochastic", float(sm.get(stoch.get("zone",""),50)), 0.08))
    wr = modules.get("williams_r",{}).get("value")
    if wr is not None:
        wr_score = 75 if wr < -80 else 25 if wr > -20 else 50
        scores.append(("Williams %R", float(wr_score), 0.06))
    vol_map = {"low":75,"moderate":60,"high":40,"very_high":20}
    scores.append(("Volatility", float(vol_map.get(modules.get("volatility",{}).get("level",""),50)), 0.07))
    div_map = {"bullish_confirmation":80,"weak_rally":55,"weak_decline":45,"bearish_confirmation":20}
    scores.append(("Volume", float(div_map.get(modules.get("volume",{}).get("divergence",""),50)), 0.07))
    w52_map = {"near_highs":75,"middle_range":55,"near_lows":35}
    scores.append(("52W Zone", float(w52_map.get(modules.get("week52",{}).get("zone",""),50)), 0.07))
    adx = modules.get("trend_strength",{})
    as_ = {"very_strong":75,"strong":70,"developing":55,"weak":40}
    if adx.get("adx"):
        base = float(as_.get(adx.get("strength",""),50))
        scores.append(("ADX", base if adx.get("direction")=="up" else 100-base, 0.06))
    obv = modules.get("obv",{})
    om = {"confirmed":70,"divergence":30,"bullish_divergence":70}
    if obv.get("available"): scores.append(("OBV", float(om.get(obv.get("confirmation",""),50)), 0.07))
    vwap = modules.get("vwap",{})
    if vwap.get("available"): scores.append(("VWAP", 65 if vwap.get("above_vwap") else 35, 0.08))

    if not scores:
        return {"score":50,"grade":"C","color":"amber","verdict":"Neutral","breakdown":[],
                "suggestion":{"outlook":"Insufficient data.","signals":[],"disclaimer":""}}
    tw = sum(i[2] for i in scores)
    final = round(sum(i[1]*i[2] for i in scores)/tw, 1) if tw > 0 else 50.0
    grade, color, verdict = (
        ("A","green","Strong")   if final >= 75 else
        ("B","teal","Positive")  if final >= 60 else
        ("C","amber","Neutral")  if final >= 45 else
        ("D","orange","Weak")    if final >= 30 else
        ("F","red","Bearish")
    )
    return {"score": final, "grade": grade, "color": color, "verdict": verdict,
            "breakdown": [{"factor":i[0],"score":round(i[1]),"weight":i[2]} for i in scores],
            "suggestion": _build_suggestion(modules, final)}


def _build_suggestion(modules, score):
    signals = []
    rv = modules.get("rsi",{}).get("value")
    if rv: signals.append(f"RSI {rv:.1f}: {'overbought' if rv>70 else 'oversold' if rv<30 else 'positive momentum' if rv>55 else 'neutral'}")
    mc = modules.get("macd",{}).get("crossover","")
    if mc: signals.append({"bullish_crossover":"MACD bullish crossover — new uptrend","bearish_crossover":"MACD bearish crossover — downtrend","bullish":"MACD positive momentum","bearish":"MACD negative momentum"}.get(mc, ""))
    stoch = modules.get("stochastic",{})
    if stoch.get("k"): signals.append(f"Stochastic %K={stoch['k']:.1f} — {stoch.get('zone','').replace('_',' ')}")
    wr = modules.get("williams_r",{}).get("value")
    if wr: signals.append(f"Williams %R={wr:.1f}: {'overbought' if wr>-20 else 'oversold' if wr<-80 else 'neutral'}")
    obv = modules.get("obv",{})
    if obv.get("available") and obv.get("confirmation")=="divergence": signals.append("OBV divergence — volume does not confirm price ⚠️")
    vwap = modules.get("vwap",{})
    if vwap.get("available"): signals.append(f"Price {'above' if vwap.get('above_vwap') else 'below'} VWAP — {'bullish' if vwap.get('above_vwap') else 'bearish'} institutional bias")
    cp = modules.get("candlestick",{}).get("patterns",[])
    if cp: signals.append(f"Candlestick: {cp[0]['name']} detected — {cp[0]['description'][:60]}")
    outlook = (
        "Strong technical setup — most indicators aligned bullish." if score >= 70 else
        "Mildly positive — more bullish than bearish signals." if score >= 55 else
        "Mixed signals — no clear direction. Wait for confirmation." if score >= 45 else
        "Technical weakness — majority of signals lean bearish." if score >= 30 else
        "Strong bearish alignment — high risk environment."
    )
    return {"outlook": outlook, "signals": [s for s in signals if s][:5],
            "disclaimer": "Educational analysis only. Not financial advice. Always do your own research."}


# ── MASTER ────────────────────────────────────────────────────────────────────
def run_full_analysis(history, fundamentals=None):
    if not history or len(history) < 5:
        return {"error": "Insufficient price history"}
    closes = [float(h["close"]) for h in history]
    modules = {
        "performance":        price_performance(history),
        "rsi":                rsi_signal(compute_rsi(closes)),
        "macd":               compute_macd(closes),
        "bollinger":          compute_bollinger(closes),
        "volatility":         compute_volatility(closes),
        "volume":             volume_analysis(history),
        "support_resistance": support_resistance(closes),
        "moving_averages":    moving_averages(closes),
        "trend_strength":     compute_adx(history),
        "week52":             week52_analysis(closes),
        "momentum":           momentum_score(closes),
        "stochastic":         compute_stochastic(history),
        "williams_r":         compute_williams_r(history),
        "atr":                compute_atr(history),
        "obv":                compute_obv(history),
        "fibonacci":          fibonacci_levels(closes),
        "candlestick":        candlestick_patterns(history),
        "risk_adjusted":      risk_adjusted_return(closes),
        "price_channel":      price_channel(history),
        "vwap":               compute_vwap(history),
    }
    if fundamentals: modules["fundamentals"] = fundamentals
    modules["composite"] = composite_score(modules)
    return modules