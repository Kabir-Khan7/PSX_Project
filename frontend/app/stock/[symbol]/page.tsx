"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
  BarChart, Bar,
} from "recharts";
import AppLayout from "@/components/AppLayout";
import { apiGet, apiPost } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface AnalysisData {
  symbol: string; name: string; sector: string;
  current_price: number; change: number; change_pct: number;
  history: { date: string; close: number; volume: number }[];
  period: string;
  analysis: {
    performance:       Record<string, number | null>;
    rsi:               { value: number|null; signal: string; zone: string };
    macd:              { macd: number|null; signal_line: number|null; histogram: number|null; crossover: string };
    bollinger:         { upper: number|null; middle: number|null; lower: number|null; band_position_pct: number|null; position: string; signal: string };
    volatility:        { daily_pct: number|null; annual_pct: number|null; level: string; description: string; risk_score: number };
    volume:            { available: boolean; current: number; average: number; ratio_pct: number|null; trend: string; divergence: string; div_signal: string };
    support_resistance:{ pivot: number|null; nearest_resistance: number|null; nearest_support: number|null; pct_to_resistance: number|null; pct_to_support: number|null };
    moving_averages:   Record<string, number | string | null>;
    trend_strength:    { adx: number|null; strength: string; direction: string; description: string };
    week52:            { high_52w: number|null; low_52w: number|null; position_pct: number|null; from_high_pct: number|null; zone: string; description: string };
    momentum:          { score: number|null; level: string; description: string; roc_5d: number|null; roc_20d: number|null };
    fundamentals?:     Record<string, number | null>;
    composite:         {
      score: number; grade: string; color: string; verdict: string;
      breakdown: { factor: string; score: number; weight: number }[];
      suggestion: { outlook: string; signals: string[]; disclaimer: string };
    };
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number|null|undefined, d = 2) {
  if (n == null) return "N/A";
  return n.toLocaleString("en-PK", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number|null|undefined) {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

const ZONE_COLORS: Record<string, string> = {
  overbought: "#dc2626", oversold: "#059669",
  bullish: "#059669", bearish: "#dc2626", neutral: "#64748b",
  near_highs: "#059669", near_lows: "#dc2626", middle_range: "#64748b",
  bullish_confirmation: "#059669", bearish_confirmation: "#dc2626",
  weak_rally: "#f59e0b", weak_decline: "#f59e0b",
  strongly_bullish: "#059669", strongly_bearish: "#dc2626",
  low: "#059669", moderate: "#f59e0b", high: "#f97316", very_high: "#dc2626",
  strong: "#059669", developing: "#f59e0b", weak: "#94a3b8", very_strong: "#059669",
};

const GLOSSARY: Record<string, { short: string; long: string }> = {
  RSI: {
    short: "Relative Strength Index — measures if a stock is overbought or oversold",
    long: "RSI is a number from 0 to 100. Above 70 means the stock has risen too fast and might pull back (overbought). Below 30 means the stock has fallen a lot and might bounce back (oversold). Between 40-60 is neutral.",
  },
  MACD: {
    short: "Moving Average Convergence Divergence — trend-following momentum signal",
    long: "MACD compares two moving averages to see if momentum is building or fading. A 'bullish crossover' means buying pressure is increasing. A 'bearish crossover' means selling pressure is increasing.",
  },
  "Bollinger Bands": {
    short: "Price bands that show normal trading range using standard deviation",
    long: "Bollinger Bands are like a price corridor. When price touches the upper band, it may be overextended. When it touches the lower band, it may be undervalued. Most price movement (95%) happens within the bands.",
  },
  Volatility: {
    short: "How much a stock's price moves day to day",
    long: "A volatile stock can gain or lose 3-5% in a single day. Low volatility (under 1%/day) means steady, predictable movement. High volatility means higher potential gains — but also higher risk of loss.",
  },
  "Moving Averages": {
    short: "Average price over different time periods — shows the trend",
    long: "The 20-day moving average is the average closing price over the last 20 days. When the current price is above its moving average, that's usually bullish. A 'Golden Cross' (50-day crosses above 200-day) is a strong bullish signal.",
  },
  "Support & Resistance": {
    short: "Price levels where buying or selling pressure tends to appear",
    long: "Support is a price floor where buyers tend to step in. Resistance is a price ceiling where sellers tend to appear. When a stock breaks through resistance, it often rallies. When it breaks support, it often falls further.",
  },
  ADX: {
    short: "Average Directional Index — measures trend strength (not direction)",
    long: "ADX measures how strong a trend is, regardless of direction. ADX above 25 means a strong trend. Below 20 means the stock is moving sideways. A high ADX with +DI above -DI confirms an uptrend.",
  },
  Momentum: {
    short: "Rate at which price is changing — like acceleration in a car",
    long: "High positive momentum means the price has been rising quickly and consistently. It's like a car speeding up. High negative momentum means the opposite. Momentum tends to persist — trending stocks often keep trending.",
  },
  "P/E Ratio": {
    short: "Price-to-Earnings — how much you pay per rupee of profit",
    long: "A P/E of 10 means you pay PKR 10 for every PKR 1 the company earns annually. Lower P/E may mean the stock is cheap (value play). Higher P/E may mean growth expectations are high. Compare within the same sector.",
  },
  "Dividend Yield": {
    short: "Annual dividend payment as a percentage of share price",
    long: "If a stock pays PKR 10 dividend and trades at PKR 100, the yield is 10%. Higher yield means more income per rupee invested. In Pakistan, well-established companies like HBL, OGDC often pay good dividends.",
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function GlossaryTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[term];
  if (!g) return null;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={g.short}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%",
          backgroundColor: "#e0f2fe", color: "#0369a1",
          fontSize: "0.6rem", fontWeight: 800, marginLeft: 4,
          flexShrink: 0,
          }}>?</button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#0a1628", color: "#ffffff",
          padding: "10px 14px", borderRadius: 10,
          fontSize: "0.72rem", lineHeight: 1.65,
          width: 260, zIndex: 999,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <p style={{ fontWeight: 600, marginBottom: 5, color: "#0fd4b4", fontSize: "0.68rem" }}>{term}</p>
          {g.long}
        </div>
      )}
    </span>
  );
}

function ScoreRing({ score, grade, color }: { score: number; grade: string; color: string }) {
  const C = 2 * Math.PI * 36;
  const fill = (score / 100) * C;
  const colorMap: Record<string, string> = {
    green: "#059669", teal: "#0fd4b4",
    amber: "#f59e0b", orange: "#f97316", red: "#dc2626",
  };
  const c = colorMap[color] || "#94a3b8";

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
      <circle cx="48" cy="48" r="36" fill="none"
        stroke={c} strokeWidth="8"
        strokeDasharray={`${fill} ${C}`}
        strokeDashoffset={C / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text x="48" y="44" textAnchor="middle"
        style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "20px",
          fontWeight: 700, fill: c }}>
        {Math.round(score)}
      </text>
      <text x="48" y="60" textAnchor="middle"
        style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "12px",
          fontWeight: 700, fill: c }}>
        {grade}
      </text>
    </svg>
  );
}

function AnalysisCard({
  title, glossaryTerm, children, badge, badgeColor,
}: {
  title: string; glossaryTerm?: string;
  children: React.ReactNode;
  badge?: string; badgeColor?: string;
}) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 1.1rem",
        borderBottom: "1px solid #f1f5f9",
        background: "#fafbfc",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: "0.75rem", fontWeight: 700, color: "#334155",
            letterSpacing: "-0.01em",
          }}>{title}</span>
          {glossaryTerm && <GlossaryTip term={glossaryTerm}/>}
        </div>
        {badge && (
          <span style={{
            fontSize: "0.6rem", fontWeight: 700,
            letterSpacing: "0.07em", textTransform: "uppercase",
            color: badgeColor || "#64748b",
            background: `${badgeColor}18` || "#f1f5f9",
            padding: "2px 8px", borderRadius: 6,
          }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: "0.9rem 1.1rem" }}>
        {children}
      </div>
    </div>
  );
}

function MetricRow({ label, value, color, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 0", borderBottom: "1px solid #f8fafc",
    }}>
      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.82rem", fontWeight: 600,
          color: color || "#0a1628",
        }}>{value}</span>
        {sub && <p style={{ fontSize: "0.62rem", color: "#94a3b8", margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%",
        background: color, borderRadius: 999,
        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
      }}/>
    </div>
  );
}

const PERIODS = [
  { k: "1wk", l: "1W" }, { k: "1mo", l: "1M" },
  { k: "3mo", l: "3M" }, { k: "1y",  l: "1Y" },
];

const TABS = [
  { k: "overview",     l: "Overview"    },
  { k: "technical",    l: "Technical"   },
  { k: "momentum",     l: "Momentum"    },
  { k: "fundamental",  l: "Fundamentals"},
  { k: "suggestion",   l: "AI Summary"  },
];

// ── Main Page ──────────────────────────────────────────────────────────────
export default function StockAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params?.symbol as string)?.toUpperCase() ?? "";

  const [data, setData]       = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [period, setPeriod]   = useState("3mo");
  const [tab, setTab]         = useState("overview");
  const [inWatch, setInWatch] = useState(false);
  const [wLoad, setWLoad]     = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (p: string) => {
    setLoading(true); setError("");
    try {
      const d = await apiGet<AnalysisData>(`/stocks/${symbol}/analysis?period=${p}`);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analysis");
    } finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    load(period);
    apiGet<{ in_watchlist: boolean }>(`/watchlist/check/${symbol}`)
      .then(r => setInWatch(r.in_watchlist)).catch(() => {});
  }, [symbol, load, period]);

  const toggleWatch = async () => {
    setWLoad(true);
    try {
      if (inWatch) {
        await fetch(`http://localhost:8000/watchlist/${symbol}`,
          { method: "DELETE", credentials: "include" });
        setInWatch(false); showToast(`${symbol} removed from watchlist`);
      } else {
        await apiPost("/watchlist/", { symbol });
        setInWatch(true); showToast(`${symbol} added to watchlist ★`);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", false);
    } finally { setWLoad(false); }
  };

  const isUp      = (data?.change ?? 0) >= 0;
  const a         = data?.analysis;
  const chartData = (data?.history ?? []).map(d => ({
    d: d.date.slice(5), v: d.close, vol: d.volume,
  }));

  return (
    <AppLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .anal-wrap * { box-sizing: border-box; }
        .anal-wrap { font-family: 'Instrument Sans','Plus Jakarta Sans',sans-serif; }
        @keyframes toastIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        .toast { animation: toastIn 0.2s ease; }
        @keyframes skpulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .sk { background:#e8edf4; border-radius:6px; animation:skpulse 1.5s ease infinite; }
        .period-btn,.tab-btn { cursor:pointer; border:none; font-family:inherit; transition:all 0.15s; }
        .tab-btn:hover { color:#0a1628 !important; }
        @media (max-width:768px) {
          .anal-inner { padding:1rem !important; }
          .quick-grid { grid-template-columns:repeat(2,1fr) !important; }
          .analysis-grid { grid-template-columns:1fr !important; }
          .tabs-row { overflow-x:auto; }
        }
      `}</style>

      {toast && (
        <div className="toast" style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.ok ? "#0a1628" : "#dc2626",
          color: "#fff", padding: "10px 16px", borderRadius: 10,
          fontSize: "0.78rem", fontWeight: 600,
          boxShadow: "0 8px 32px rgba(10,22,40,0.25)",
          fontFamily: "Instrument Sans,sans-serif",
        }}>{toast.msg}</div>
      )}

      <div className="anal-wrap">
        <div className="anal-inner" style={{ padding: "1.25rem 1.5rem", maxWidth: 1200, margin: "0 auto" }}>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="sk" style={{ height: 200, borderRadius: 16 }}/>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.875rem" }}>
                {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 90, borderRadius: 12 }}/>)}
              </div>
              <div className="sk" style={{ height: 400, borderRadius: 16 }}/>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && !loading && (
            <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem",
              textAlign: "center", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</p>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#dc2626", marginBottom: "1.5rem" }}>{error}</p>
              <button onClick={() => router.push("/dashboard")}
                style={{ padding: "8px 20px", background: "#0a1628", color: "#fff",
                  border: "none", borderRadius: 9, fontSize: "0.82rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit" }}>
                ← Back to Dashboard
              </button>
            </div>
          )}

          {data && !loading && a && (
            <>
              {/* ── HERO ── */}
              <div style={{
                background: "#0a1628", borderRadius: 18,
                overflow: "hidden", marginBottom: "1.25rem",
                boxShadow: "0 4px 24px rgba(10,22,40,0.18)",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "radial-gradient(ellipse 50% 80% at 90% 0%, rgba(15,212,180,0.07) 0%, transparent 60%)",
                }}/>

                <div style={{ padding: "1.5rem 1.75rem 0", position: "relative", zIndex: 1 }}>
                  <div style={{
                    display: "flex", alignItems: "flex-start",
                    justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
                    marginBottom: "1rem",
                  }}>
                    {/* Left */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: "0.6rem", fontWeight: 700,
                          color: "#0fd4b4", background: "rgba(15,212,180,0.1)",
                          border: "1px solid rgba(15,212,180,0.2)",
                          padding: "2px 10px", borderRadius: 20,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>{data.sector}</span>
                      </div>
                      <h1 style={{
                        fontSize: "clamp(1.2rem,2.5vw,1.75rem)",
                        fontWeight: 800, color: "#f0f6ff",
                        letterSpacing: "-0.03em", margin: "0 0 4px",
                      }}>{data.name}</h1>
                      <p style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", margin: 0,
                      }}>PSX: {data.symbol}</p>
                    </div>

                    {/* Right: price + watchlist */}
                    <div style={{ textAlign: "right" }}>
                      <p style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "clamp(1.6rem,3vw,2.4rem)",
                        fontWeight: 600, color: "#ffffff",
                        lineHeight: 1, margin: "0 0 8px",
                      }}>PKR {fmt(data.current_price)}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.82rem", fontWeight: 600,
                          padding: "3px 10px", borderRadius: 8,
                          background: isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                          color: isUp ? "#34d399" : "#f87171",
                        }}>
                          {isUp ? "▲" : "▼"} {fmtPct(data.change_pct)}
                        </span>
                        <button onClick={toggleWatch} disabled={wLoad}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                            background: inWatch ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.08)",
                            border: `1px solid ${inWatch ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.12)"}`,
                            color: inWatch ? "#fbbf24" : "rgba(255,255,255,0.6)",
                            fontSize: "0.72rem", fontWeight: 600,
                            fontFamily: "inherit", transition: "all 0.15s",
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24"
                            fill={inWatch ? "#fbbf24" : "none"}
                            stroke={inWatch ? "#fbbf24" : "currentColor"}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          {inWatch ? "Watchlisted" : "Add to Watchlist"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Period selector */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {PERIODS.map(p => (
                      <button key={p.k} className="period-btn"
                        onClick={() => { setPeriod(p.k); load(p.k); }}
                        style={{
                          padding: "5px 13px", borderRadius: 8,
                          fontSize: "0.72rem", fontWeight: 600,
                          background: period === p.k ? "#ffffff" : "rgba(255,255,255,0.08)",
                          color: period === p.k ? "#0a1628" : "rgba(255,255,255,0.4)",
                        }}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price chart */}
                {chartData.length > 2 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 24, left: -4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} domain={["auto","auto"]} width={52} tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}K`:v}/>
                      <Tooltip
                        contentStyle={{ background: "#162035", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                        labelStyle={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                        itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}
                        formatter={(v: unknown) => [`PKR ${Number(v).toLocaleString("en-PK")}`, data.symbol]}
                      />
                      {a.support_resistance?.nearest_resistance && (
                        <ReferenceLine y={a.support_resistance.nearest_resistance}
                          stroke="rgba(239,68,68,0.4)" strokeDasharray="4 3"
                          label={{ value: "R", position: "right", fontSize: 9, fill: "#f87171" }}/>
                      )}
                      {a.support_resistance?.nearest_support && (
                        <ReferenceLine y={a.support_resistance.nearest_support}
                          stroke="rgba(34,197,94,0.4)" strokeDasharray="4 3"
                          label={{ value: "S", position: "right", fontSize: 9, fill: "#4ade80" }}/>
                      )}
                      <Area type="monotone" dataKey="v" stroke={isUp ? "#0fd4b4" : "#f87171"}
                        strokeWidth={2.5} fill="url(#ag)" dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── COMPOSITE SCORE CARD ── */}
              <div style={{
                background: "#ffffff", border: "1px solid #e2e8f0",
                borderRadius: 16, padding: "1.25rem 1.5rem",
                marginBottom: "1.25rem",
                boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center",
                  gap: "1.5rem", flexWrap: "wrap",
                }}>
                  <ScoreRing
                    score={a.composite.score}
                    grade={a.composite.grade}
                    color={a.composite.color}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <h2 style={{
                        fontSize: "1.1rem", fontWeight: 800,
                        color: "#0a1628", margin: 0, letterSpacing: "-0.02em",
                      }}>{data.name}</h2>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700,
                        padding: "2px 10px", borderRadius: 6,
                        background: a.composite.color === "green" ? "#ecfdf5" :
                          a.composite.color === "red" ? "#fef2f2" : "#fefce8",
                        color: a.composite.color === "green" ? "#059669" :
                          a.composite.color === "red" ? "#dc2626" : "#d97706",
                      }}>{a.composite.verdict}</span>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 10px", lineHeight: 1.6 }}>
                      {a.composite.suggestion.outlook}
                    </p>
                    {/* Score breakdown bars */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {a.composite.breakdown.slice(0, 5).map(b => (
                        <div key={b.factor} style={{ minWidth: 90 }}>
                          <div style={{ display: "flex", justifyContent: "space-between",
                            marginBottom: 3 }}>
                            <span style={{ fontSize: "0.58rem", color: "#94a3b8",
                              fontWeight: 600, textTransform: "uppercase",
                              letterSpacing: "0.06em" }}>{b.factor}</span>
                            <span style={{ fontSize: "0.62rem",
                              fontFamily: "JetBrains Mono,monospace",
                              color: b.score >= 60 ? "#059669" :
                                b.score >= 40 ? "#f59e0b" : "#dc2626",
                              fontWeight: 600 }}>{b.score}</span>
                          </div>
                          <GaugeBar value={b.score}
                            color={b.score >= 60 ? "#059669" :
                              b.score >= 40 ? "#f59e0b" : "#dc2626"}/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── QUICK METRICS ── */}
              <div className="quick-grid" style={{
                display: "grid", gridTemplateColumns: "repeat(4,1fr)",
                gap: "0.875rem", marginBottom: "1.25rem",
              }}>
                {[
                  {
                    l: "RSI (14)",
                    v: a.rsi.value != null ? a.rsi.value.toFixed(1) : "N/A",
                    c: a.rsi.zone === "overbought" ? "#dc2626" :
                      a.rsi.zone === "oversold" ? "#059669" : "#0a1628",
                    sub: a.rsi.zone.replace("_", " "),
                    term: "RSI",
                  },
                  {
                    l: "Volatility",
                    v: a.volatility.daily_pct != null ? `${a.volatility.daily_pct.toFixed(2)}%` : "N/A",
                    c: ZONE_COLORS[a.volatility.level] || "#0a1628",
                    sub: a.volatility.level.replace("_", " "),
                    term: "Volatility",
                  },
                  {
                    l: "Momentum",
                    v: a.momentum.score != null ? a.momentum.score.toFixed(0) : "N/A",
                    c: a.momentum.score && a.momentum.score >= 55 ? "#059669" :
                      a.momentum.score && a.momentum.score <= 45 ? "#dc2626" : "#0a1628",
                    sub: a.momentum.level.replace("_", " "),
                    term: "Momentum",
                  },
                  {
                    l: "Trend (ADX)",
                    v: a.trend_strength.adx != null ? a.trend_strength.adx.toFixed(1) : "N/A",
                    c: ZONE_COLORS[a.trend_strength.strength] || "#0a1628",
                    sub: a.trend_strength.strength.replace("_", " "),
                    term: "ADX",
                  },
                ].map(card => (
                  <div key={card.l} style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: 12, padding: "0.9rem 1rem",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center",
                      marginBottom: 6 }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700,
                        letterSpacing: "0.09em", textTransform: "uppercase",
                        color: "#94a3b8" }}>{card.l}</span>
                      <GlossaryTip term={card.term}/>
                    </div>
                    <p style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "1.35rem", fontWeight: 600,
                      color: card.c, margin: "0 0 3px",
                      letterSpacing: "-0.02em",
                    }}>{card.v}</p>
                    <p style={{ fontSize: "0.65rem", color: "#94a3b8", margin: 0,
                      textTransform: "capitalize" }}>{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── TABS ── */}
              <div className="tabs-row" style={{
                display: "flex", gap: 2,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12, padding: 4,
                marginBottom: "1.25rem",
                overflowX: "auto",
              }}>
                {TABS.map(t => (
                  <button key={t.k} className="tab-btn"
                    onClick={() => setTab(t.k)}
                    style={{
                      padding: "6px 16px", borderRadius: 9,
                      fontSize: "0.75rem", fontWeight: 600,
                      background: tab === t.k ? "#0a1628" : "transparent",
                      color: tab === t.k ? "#ffffff" : "#64748b",
                      whiteSpace: "nowrap",
                    }}>{t.l}</button>
                ))}
              </div>

              {/* ── TAB CONTENT ── */}

              {/* OVERVIEW */}
              {tab === "overview" && (
                <div className="analysis-grid" style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "0.875rem",
                }}>
                  {/* Performance */}
                  <AnalysisCard title="Price Performance" glossaryTerm="Momentum"
                    badge={a.performance.ret_3m != null ?
                      `3M: ${fmtPct(a.performance.ret_3m)}` : undefined}
                    badgeColor={a.performance.ret_3m && a.performance.ret_3m >= 0 ? "#059669" : "#dc2626"}>
                    {[
                      { l: "1 Week Return",  v: fmtPct(a.performance.ret_1w), c: a.performance.ret_1w && a.performance.ret_1w >= 0 ? "#059669" : "#dc2626" },
                      { l: "1 Month Return", v: fmtPct(a.performance.ret_1m), c: a.performance.ret_1m && a.performance.ret_1m >= 0 ? "#059669" : "#dc2626" },
                      { l: "3 Month Return", v: fmtPct(a.performance.ret_3m), c: a.performance.ret_3m && a.performance.ret_3m >= 0 ? "#059669" : "#dc2626" },
                      { l: "1 Year Return",  v: fmtPct(a.performance.ret_1y), c: a.performance.ret_1y && a.performance.ret_1y >= 0 ? "#059669" : "#dc2626" },
                      { l: "Best Single Day", v: fmtPct(a.performance.best_day), c: "#059669" },
                      { l: "Worst Single Day", v: fmtPct(a.performance.worst_day), c: "#dc2626" },
                      { l: "Positive Days", v: `${a.performance.positive_days} / ${a.performance.total_days}`, c: "#0a1628" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                  </AnalysisCard>

                  {/* 52-Week */}
                  <AnalysisCard title="52-Week Analysis"
                    badge={a.week52.zone?.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.week52.zone || ""] || "#64748b"}>
                    <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 12, lineHeight: 1.65 }}>
                      {a.week52.description}
                    </p>
                    {a.week52.high_52w && a.week52.low_52w && data.current_price && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: "0.68rem", color: "#94a3b8", marginBottom: 5 }}>
                          <span>52W Low: PKR {fmt(a.week52.low_52w, 0)}</span>
                          <span>Current: PKR {fmt(data.current_price, 0)}</span>
                          <span>52W High: PKR {fmt(a.week52.high_52w, 0)}</span>
                        </div>
                        <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, position: "relative" }}>
                          <div style={{
                            position: "absolute",
                            width: `${a.week52.position_pct ?? 50}%`,
                            height: "100%", background: "#0fd4b4", borderRadius: 999,
                            transition: "width 0.8s ease",
                          }}/>
                          <div style={{
                            position: "absolute",
                            left: `${a.week52.position_pct ?? 50}%`,
                            top: "50%", transform: "translate(-50%,-50%)",
                            width: 14, height: 14, borderRadius: "50%",
                            background: "#0a1628", border: "2.5px solid #fff",
                            boxShadow: "0 1px 4px rgba(10,22,40,0.2)",
                          }}/>
                        </div>
                      </div>
                    )}
                    {[
                      { l: "52W High",       v: `PKR ${fmt(a.week52.high_52w)}` },
                      { l: "52W Low",        v: `PKR ${fmt(a.week52.low_52w)}` },
                      { l: "From 52W High",  v: fmtPct(a.week52.from_high_pct), c: "#dc2626" },
                      { l: "Range Position", v: a.week52.position_pct != null ? `${a.week52.position_pct.toFixed(1)}%` : "N/A" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                  </AnalysisCard>

                  {/* Volume */}
                  <AnalysisCard title="Volume Analysis" glossaryTerm="Momentum"
                    badge={a.volume.available ? a.volume.divergence?.replace("_", " ") : "no data"}
                    badgeColor={ZONE_COLORS[a.volume.divergence || ""] || "#64748b"}>
                    {a.volume.available ? (
                      <>
                        <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 12, lineHeight: 1.65 }}>
                          {a.volume.div_signal}
                        </p>
                        {[
                          { l: "Today's Volume",   v: a.volume.current ? (a.volume.current/1000).toFixed(0)+"K shares" : "N/A" },
                          { l: "Average Volume",   v: a.volume.average ? (a.volume.average/1000).toFixed(0)+"K shares" : "N/A" },
                          { l: "Volume vs Avg",    v: a.volume.ratio_pct ? `${a.volume.ratio_pct.toFixed(0)}%` : "N/A",
                            c: a.volume.ratio_pct && a.volume.ratio_pct > 100 ? "#059669" : "#dc2626" },
                          { l: "Volume Trend",     v: a.volume.trend || "N/A" },
                        ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                      </>
                    ) : (
                      <p style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                        Volume data not available for this symbol.
                      </p>
                    )}
                  </AnalysisCard>

                  {/* Support & Resistance */}
                  <AnalysisCard title="Support & Resistance" glossaryTerm="Support & Resistance">
                    <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 12, lineHeight: 1.65 }}>
                      Key price levels where buying or selling pressure historically appears.
                      Red dashed line on chart = resistance. Green dashed line = support.
                    </p>
                    {[
                      { l: "Nearest Resistance", v: `PKR ${fmt(a.support_resistance.nearest_resistance)}`,
                        c: "#dc2626", sub: a.support_resistance.pct_to_resistance ? `${a.support_resistance.pct_to_resistance.toFixed(1)}% away` : undefined },
                      { l: "Nearest Support",    v: `PKR ${fmt(a.support_resistance.nearest_support)}`,
                        c: "#059669", sub: a.support_resistance.pct_to_support ? `${a.support_resistance.pct_to_support.toFixed(1)}% below` : undefined },
                      { l: "Pivot Point",        v: `PKR ${fmt(a.support_resistance.pivot)}` },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c} sub={r.sub}/>)}
                  </AnalysisCard>
                </div>
              )}

              {/* TECHNICAL */}
              {tab === "technical" && (
                <div className="analysis-grid" style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "0.875rem",
                }}>
                  {/* RSI */}
                  <AnalysisCard title="RSI — Relative Strength Index" glossaryTerm="RSI"
                    badge={a.rsi.zone.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.rsi.zone] || "#64748b"}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>RSI Value</span>
                        <span style={{
                          fontFamily: "JetBrains Mono,monospace",
                          fontSize: "1.5rem", fontWeight: 700,
                          color: ZONE_COLORS[a.rsi.zone] || "#0a1628",
                        }}>{a.rsi.value != null ? a.rsi.value.toFixed(1) : "N/A"}</span>
                      </div>
                      {a.rsi.value != null && (
                        <div style={{ position: "relative", height: 12, background: "linear-gradient(90deg, #059669 0%, #34d399 30%, #94a3b8 50%, #f59e0b 70%, #dc2626 100%)", borderRadius: 999 }}>
                          <div style={{
                            position: "absolute",
                            left: `${a.rsi.value}%`,
                            top: "50%", transform: "translate(-50%,-50%)",
                            width: 16, height: 16, borderRadius: "50%",
                            background: "#0a1628", border: "2.5px solid #fff",
                            boxShadow: "0 1px 4px rgba(10,22,40,0.3)",
                          }}/>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between",
                        fontSize: "0.58rem", color: "#94a3b8", marginTop: 4 }}>
                        <span>Oversold (0)</span><span>Neutral (50)</span><span>Overbought (100)</span>
                      </div>
                    </div>
                    <div style={{
                      background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>
                      {a.rsi.signal}
                    </div>
                  </AnalysisCard>

                  {/* MACD */}
                  <AnalysisCard title="MACD" glossaryTerm="MACD"
                    badge={a.macd.crossover.replace("_", " ")}
                    badgeColor={a.macd.crossover.includes("bullish") ? "#059669" :
                      a.macd.crossover.includes("bearish") ? "#dc2626" : "#64748b"}>
                    {[
                      { l: "MACD Line",    v: fmt(a.macd.macd),        c: a.macd.macd && a.macd.macd > 0 ? "#059669" : "#dc2626" },
                      { l: "Signal Line",  v: fmt(a.macd.signal_line) },
                      { l: "Histogram",    v: fmt(a.macd.histogram),    c: a.macd.histogram && a.macd.histogram > 0 ? "#059669" : "#dc2626" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                    <div style={{
                      marginTop: 10, background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>
                      {a.macd.crossover === "bullish_crossover"
                        ? "✅ Bullish crossover just occurred — this is a buy signal in many strategies"
                        : a.macd.crossover === "bearish_crossover"
                        ? "⚠️ Bearish crossover just occurred — this is a sell signal in many strategies"
                        : a.macd.crossover === "bullish"
                        ? "📈 MACD is positive — upward momentum is active"
                        : "📉 MACD is negative — downward momentum is active"}
                    </div>
                  </AnalysisCard>

                  {/* Bollinger Bands */}
                  <AnalysisCard title="Bollinger Bands" glossaryTerm="Bollinger Bands"
                    badge={a.bollinger.position?.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.bollinger.position || ""] || "#64748b"}>
                    {[
                      { l: "Upper Band",    v: `PKR ${fmt(a.bollinger.upper)}`, c: "#dc2626" },
                      { l: "Middle (SMA20)",v: `PKR ${fmt(a.bollinger.middle)}` },
                      { l: "Lower Band",    v: `PKR ${fmt(a.bollinger.lower)}`,  c: "#059669" },
                      { l: "Band Position", v: a.bollinger.band_position_pct != null ? `${a.bollinger.band_position_pct.toFixed(1)}%` : "N/A" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                    {a.bollinger.band_position_pct != null && (
                      <div style={{ marginTop: 10 }}>
                        <GaugeBar value={a.bollinger.band_position_pct}
                          color={a.bollinger.band_position_pct > 80 ? "#dc2626" :
                            a.bollinger.band_position_pct < 20 ? "#059669" : "#0fd4b4"}/>
                      </div>
                    )}
                    <div style={{
                      marginTop: 10, background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>{a.bollinger.signal}</div>
                  </AnalysisCard>

                  {/* Moving Averages */}
                  <AnalysisCard title="Moving Averages" glossaryTerm="Moving Averages"
                    badge={(a.moving_averages.trend_signal as string)?.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.moving_averages.trend_signal as string || ""] || "#64748b"}>
                    {[10,20,50,200].map(p => {
                      const ma = a.moving_averages[`ma${p}`] as number | null;
                      const pct = a.moving_averages[`ma${p}_pct`] as number | null;
                      if (ma == null) return null;
                      const above = data.current_price > ma;
                      return (
                        <MetricRow key={p}
                          label={`MA ${p}`}
                          value={`PKR ${fmt(ma)}`}
                          color={above ? "#059669" : "#dc2626"}
                          sub={pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% vs price` : undefined}
                        />
                      );
                    })}
                    <div style={{
                      marginTop: 10, background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>{a.moving_averages.trend_description as string}</div>
                    {a.moving_averages.cross && (
                      <div style={{
                        marginTop: 8, padding: "6px 10px", borderRadius: 6,
                        background: (a.moving_averages.cross as string).includes("golden") ? "#ecfdf5" : "#fef2f2",
                        fontSize: "0.72rem", fontWeight: 600,
                        color: (a.moving_averages.cross as string).includes("golden") ? "#059669" : "#dc2626",
                      }}>
                        {(a.moving_averages.cross as string).replace("_", " ").toUpperCase()}
                      </div>
                    )}
                  </AnalysisCard>

                  {/* Trend Strength (ADX) */}
                  <AnalysisCard title="Trend Strength (ADX)" glossaryTerm="ADX"
                    badge={a.trend_strength.strength?.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.trend_strength.strength || ""] || "#64748b"}>
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <span style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "2.5rem", fontWeight: 700,
                        color: ZONE_COLORS[a.trend_strength.strength || ""] || "#0a1628",
                      }}>
                        {a.trend_strength.adx != null ? a.trend_strength.adx.toFixed(1) : "N/A"}
                      </span>
                      <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "4px 0 0" }}>
                        ADX · Direction: {a.trend_strength.direction?.toUpperCase() || "N/A"}
                      </p>
                    </div>
                    <GaugeBar
                      value={a.trend_strength.adx ?? 0} max={60}
                      color={ZONE_COLORS[a.trend_strength.strength || ""] || "#94a3b8"}/>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "0.58rem", color: "#94a3b8", marginTop: 4, marginBottom: 10 }}>
                      <span>Sideways</span><span>Developing</span><span>Strong trend</span>
                    </div>
                    <div style={{
                      background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>{a.trend_strength.description}</div>
                  </AnalysisCard>

                  {/* Volatility */}
                  <AnalysisCard title="Volatility & Risk" glossaryTerm="Volatility"
                    badge={a.volatility.level?.replace("_", " ")}
                    badgeColor={ZONE_COLORS[a.volatility.level || ""] || "#64748b"}>
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <span style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "2rem", fontWeight: 700,
                        color: ZONE_COLORS[a.volatility.level || ""] || "#0a1628",
                      }}>
                        {a.volatility.daily_pct != null ? `${a.volatility.daily_pct.toFixed(2)}%` : "N/A"}
                      </span>
                      <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "4px 0 0" }}>avg daily price move</p>
                    </div>
                    {[
                      { l: "Daily Volatility",  v: `${fmt(a.volatility.daily_pct)}%` },
                      { l: "Annual Volatility", v: `${fmt(a.volatility.annual_pct)}%` },
                      { l: "Risk Score",        v: `${a.volatility.risk_score}/100`,
                        c: a.volatility.risk_score > 60 ? "#dc2626" :
                          a.volatility.risk_score > 30 ? "#f59e0b" : "#059669" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                    <div style={{
                      marginTop: 10, background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>{a.volatility.description}</div>
                  </AnalysisCard>
                </div>
              )}

              {/* MOMENTUM */}
              {tab === "momentum" && (
                <div className="analysis-grid" style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "0.875rem",
                }}>
                  <AnalysisCard title="Momentum Score" glossaryTerm="Momentum"
                    badge={a.momentum.level?.replace("_", " ")}
                    badgeColor={a.momentum.score && a.momentum.score >= 55 ? "#059669" :
                      a.momentum.score && a.momentum.score <= 45 ? "#dc2626" : "#64748b"}>
                    <div style={{ textAlign: "center", marginBottom: 14 }}>
                      <span style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "3rem", fontWeight: 700,
                        color: a.momentum.score && a.momentum.score >= 55 ? "#059669" :
                          a.momentum.score && a.momentum.score <= 45 ? "#dc2626" : "#64748b",
                      }}>{a.momentum.score?.toFixed(0) ?? "N/A"}</span>
                      <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "4px 0 0" }}>out of 100</p>
                    </div>
                    <GaugeBar value={a.momentum.score ?? 50}
                      color={a.momentum.score && a.momentum.score >= 55 ? "#059669" :
                        a.momentum.score && a.momentum.score <= 45 ? "#dc2626" : "#94a3b8"}/>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "0.58rem", color: "#94a3b8", marginTop: 4, marginBottom: 10 }}>
                      <span>Bearish</span><span>Neutral</span><span>Bullish</span>
                    </div>
                    {[
                      { l: "5-Day Rate of Change",  v: fmtPct(a.momentum.roc_5d),  c: a.momentum.roc_5d && a.momentum.roc_5d >= 0 ? "#059669" : "#dc2626" },
                      { l: "20-Day Rate of Change", v: fmtPct(a.momentum.roc_20d), c: a.momentum.roc_20d && a.momentum.roc_20d >= 0 ? "#059669" : "#dc2626" },
                    ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} color={r.c}/>)}
                    <div style={{
                      marginTop: 10, background: "#f8fafc", borderRadius: 8,
                      padding: "0.75rem", fontSize: "0.72rem",
                      color: "#334155", lineHeight: 1.65,
                    }}>{a.momentum.description}</div>
                  </AnalysisCard>

                  {/* Volume chart */}
                  {a.volume.available && chartData.length > 5 && (
                    <AnalysisCard title="Volume History">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData.slice(-30)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                          <XAxis dataKey="d" tick={{ fontSize: 8, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={4}/>
                          <YAxis tick={{ fontSize: 8, fill: "#94a3b8", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false}
                            tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                          <Tooltip
                            contentStyle={{ background: "#0a1628", border: "none", borderRadius: 8 }}
                            labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}
                            itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 12 }}
                            formatter={(v: unknown) => [Number(v).toLocaleString(), "Volume"]}
                          />
                          <Bar dataKey="vol" fill="#0fd4b4" fillOpacity={0.7} radius={[3,3,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </AnalysisCard>
                  )}

                  <AnalysisCard title="Price Rate of Change">
                    <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 12, lineHeight: 1.65 }}>
                      Rate of Change (ROC) measures how fast the price is moving compared to a fixed point in the past.
                      Positive = price is higher than it was. Negative = price is lower.
                    </p>
                    {[
                      { l: "5-Day ROC",  v: fmtPct(a.momentum.roc_5d)  },
                      { l: "20-Day ROC", v: fmtPct(a.momentum.roc_20d) },
                      { l: "1 Month",    v: fmtPct(a.performance.ret_1m) },
                      { l: "3 Month",    v: fmtPct(a.performance.ret_3m) },
                    ].map(r => (
                      <MetricRow key={r.l} label={r.l} value={r.v}
                        color={r.v.startsWith("+") ? "#059669" : r.v.startsWith("-") ? "#dc2626" : "#0a1628"}/>
                    ))}
                  </AnalysisCard>

                  <AnalysisCard title="Trend Alignment">
                    <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 12, lineHeight: 1.65 }}>
                      How many signals are aligned in the bullish or bearish direction.
                    </p>
                    {[
                      { l: "RSI Zone",      v: a.rsi.zone.replace("_", " "),           ok: a.rsi.zone.includes("bullish") || a.rsi.zone === "oversold" },
                      { l: "MACD",          v: a.macd.crossover.replace("_", " "),     ok: a.macd.crossover.includes("bullish") },
                      { l: "MA Trend",      v: (a.moving_averages.trend_signal as string || "").replace("_", " "), ok: (a.moving_averages.trend_signal as string || "").includes("bullish") },
                      { l: "Momentum",      v: a.momentum.level.replace("_", " "),     ok: a.momentum.level.includes("positive") },
                      { l: "Volume Signal", v: a.volume.divergence?.replace("_", " ") || "N/A", ok: a.volume.divergence?.includes("bullish") },
                      { l: "52W Zone",      v: a.week52.zone?.replace("_", " ") || "N/A", ok: a.week52.zone === "near_highs" },
                    ].map(r => (
                      <div key={r.l} style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", padding: "6px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.l}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontFamily: "JetBrains Mono,monospace",
                            fontSize: "0.72rem", fontWeight: 600,
                            color: r.ok ? "#059669" : "#dc2626",
                            textTransform: "capitalize",
                          }}>{r.v}</span>
                          <span style={{ fontSize: "0.7rem" }}>{r.ok ? "✅" : "❌"}</span>
                        </div>
                      </div>
                    ))}
                  </AnalysisCard>
                </div>
              )}

              {/* FUNDAMENTALS */}
              {tab === "fundamental" && (
                <div className="analysis-grid" style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "0.875rem",
                }}>
                  {a.fundamentals ? (
                    <>
                      <AnalysisCard title="Valuation Metrics" glossaryTerm="P/E Ratio">
                        {[
                          { l: "P/E Ratio",    v: a.fundamentals.pe_ratio != null ? a.fundamentals.pe_ratio.toFixed(2) : "N/A",
                            sub: "Price ÷ Annual Earnings per share" },
                          { l: "P/B Ratio",    v: a.fundamentals.pb_ratio != null ? a.fundamentals.pb_ratio.toFixed(2) : "N/A",
                            sub: "Price ÷ Book value per share" },
                          { l: "EPS (PKR)",    v: a.fundamentals.eps != null ? fmt(a.fundamentals.eps) : "N/A",
                            sub: "Earnings per share" },
                          { l: "Market Cap",   v: a.fundamentals.market_cap != null ?
                            `PKR ${(a.fundamentals.market_cap/1e9).toFixed(1)}B` : "N/A",
                            sub: "Total market value of all shares" },
                          { l: "Beta",         v: a.fundamentals.beta != null ? a.fundamentals.beta.toFixed(2) : "N/A",
                            sub: "Sensitivity vs market (1 = market, >1 = volatile)" },
                        ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} sub={r.sub}/>)}
                      </AnalysisCard>

                      <AnalysisCard title="Dividends" glossaryTerm="Dividend Yield">
                        {[
                          { l: "Dividend Yield",   v: a.fundamentals.dividend_yield != null ? `${a.fundamentals.dividend_yield.toFixed(2)}%` : "N/A",
                            sub: "Annual dividend ÷ share price" },
                          { l: "Dividend Rate",    v: a.fundamentals.dividend_rate != null ? `PKR ${a.fundamentals.dividend_rate.toFixed(2)}` : "N/A",
                            sub: "Annual dividend per share" },
                        ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} sub={r.sub}/>)}
                        <div style={{
                          marginTop: 10, background: "#fefce8", borderRadius: 8,
                          padding: "0.75rem", fontSize: "0.72rem",
                          color: "#854d0e", lineHeight: 1.65,
                          border: "1px solid #fde68a",
                        }}>
                          💡 Dividend yield shows how much cash a company pays annually per rupee of share price.
                          A yield of 5%+ is considered good in Pakistan's market.
                        </div>
                      </AnalysisCard>

                      <AnalysisCard title="Financial Health">
                        {[
                          { l: "Return on Equity",  v: a.fundamentals.roe != null ? `${a.fundamentals.roe.toFixed(1)}%` : "N/A",
                            sub: "Profit generated per PKR of shareholder equity",
                            c: a.fundamentals.roe && a.fundamentals.roe > 15 ? "#059669" :
                              a.fundamentals.roe && a.fundamentals.roe < 0 ? "#dc2626" : undefined },
                          { l: "Profit Margin",     v: a.fundamentals.profit_margin != null ? `${a.fundamentals.profit_margin.toFixed(1)}%` : "N/A",
                            sub: "% of revenue that becomes profit",
                            c: a.fundamentals.profit_margin && a.fundamentals.profit_margin > 15 ? "#059669" : undefined },
                          { l: "Debt / Equity",     v: a.fundamentals.debt_to_equity != null ? a.fundamentals.debt_to_equity.toFixed(2) : "N/A",
                            sub: "Total debt ÷ equity (lower is safer)",
                            c: a.fundamentals.debt_to_equity && a.fundamentals.debt_to_equity > 1.5 ? "#dc2626" : "#059669" },
                          { l: "Current Ratio",     v: a.fundamentals.current_ratio != null ? a.fundamentals.current_ratio.toFixed(2) : "N/A",
                            sub: "Current assets ÷ current liabilities (>1.5 healthy)",
                            c: a.fundamentals.current_ratio && a.fundamentals.current_ratio > 1.5 ? "#059669" :
                              a.fundamentals.current_ratio && a.fundamentals.current_ratio < 1 ? "#dc2626" : undefined },
                        ].map(r => <MetricRow key={r.l} label={r.l} value={r.v} sub={r.sub} color={r.c}/>)}
                      </AnalysisCard>

                      <AnalysisCard title="52-Week Price Range">
                        {[
                          { l: "52W High", v: a.fundamentals["52w_high"] != null ? `PKR ${fmt(a.fundamentals["52w_high"])}` : "N/A" },
                          { l: "52W Low",  v: a.fundamentals["52w_low"]  != null ? `PKR ${fmt(a.fundamentals["52w_low"])}` : "N/A" },
                          { l: "Current",  v: `PKR ${fmt(data.current_price)}` },
                        ].map(r => <MetricRow key={r.l} label={r.l} value={r.v}/>)}
                      </AnalysisCard>
                    </>
                  ) : (
                    <div style={{
                      gridColumn: "1/-1",
                      background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 14, padding: "3rem 2rem", textAlign: "center",
                    }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📊</div>
                      <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1628", marginBottom: 8 }}>
                        Fundamental data not available
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "#94a3b8", maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>
                        Yahoo Finance does not provide P/E, ROE, and other fundamental metrics for most PSX-listed stocks.
                        All technical analysis above (RSI, MACD, Bollinger Bands, etc.) is calculated directly from price data and is fully accurate.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI SUMMARY */}
              {tab === "suggestion" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

                  {/* Score card */}
                  <div style={{
                    background: "#0a1628", borderRadius: 16,
                    padding: "1.5rem 1.75rem",
                    boxShadow: "0 4px 24px rgba(10,22,40,0.18)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                      <ScoreRing score={a.composite.score} grade={a.composite.grade} color={a.composite.color}/>
                      <div>
                        <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 6px" }}>
                          Overall Technical Score
                        </p>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f0f6ff",
                          letterSpacing: "-0.03em", margin: "0 0 6px" }}>
                          {data.name}
                        </h2>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 700,
                          padding: "3px 12px", borderRadius: 20,
                          background: a.composite.color === "green" ? "rgba(5,150,105,0.15)" :
                            a.composite.color === "red" ? "rgba(220,38,38,0.15)" : "rgba(245,158,11,0.15)",
                          color: a.composite.color === "green" ? "#34d399" :
                            a.composite.color === "red" ? "#f87171" : "#fbbf24",
                        }}>{a.composite.verdict} · Grade {a.composite.grade}</span>
                      </div>
                    </div>
                  </div>

                  {/* Outlook */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: 14, padding: "1.25rem 1.4rem",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                  }}>
                    <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155",
                      margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                      📋 Technical Outlook
                    </h3>
                    <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.75, margin: 0 }}>
                      {a.composite.suggestion.outlook}
                    </p>
                  </div>

                  {/* Key signals */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: 14, padding: "1.25rem 1.4rem",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                  }}>
                    <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155",
                      margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                      🔍 Key Signals Detected
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {a.composite.suggestion.signals.map((sig, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 10, alignItems: "flex-start",
                          padding: "0.65rem 0.85rem",
                          background: "#f8fafc", borderRadius: 10,
                          border: "1px solid #f1f5f9",
                        }}>
                          <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                            {i === 0 ? "📈" : i === 1 ? "📉" : i === 2 ? "⚡" : "💡"}
                          </span>
                          <p style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.65, margin: 0 }}>
                            {sig}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: 14, padding: "1.25rem 1.4rem",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                  }}>
                    <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155",
                      margin: "0 0 14px", letterSpacing: "-0.01em" }}>
                      📊 Score Breakdown
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {a.composite.breakdown.map(b => (
                        <div key={b.factor}>
                          <div style={{ display: "flex", justifyContent: "space-between",
                            marginBottom: 5 }}>
                            <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                              {b.factor}
                            </span>
                            <span style={{
                              fontFamily: "JetBrains Mono,monospace",
                              fontSize: "0.78rem", fontWeight: 700,
                              color: b.score >= 60 ? "#059669" :
                                b.score >= 40 ? "#f59e0b" : "#dc2626",
                            }}>{b.score}/100</span>
                          </div>
                          <GaugeBar value={b.score}
                            color={b.score >= 60 ? "#059669" :
                              b.score >= 40 ? "#f59e0b" : "#dc2626"}/>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Glossary */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: 14, padding: "1.25rem 1.4rem",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                  }}>
                    <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155",
                      margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                      📚 Glossary — What do these terms mean?
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {Object.entries(GLOSSARY).map(([term, def]) => (
                        <GlossaryItem key={term} term={term} def={def}/>
                      ))}
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div style={{
                    background: "#fefce8", border: "1px solid #fde68a",
                    borderRadius: 12, padding: "1rem 1.1rem",
                  }}>
                    <p style={{ fontSize: "0.72rem", color: "#854d0e",
                      lineHeight: 1.75, margin: 0 }}>
                      ⚠️ <strong>Important disclaimer:</strong> {a.composite.suggestion.disclaimer}
                    </p>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function GlossaryItem({ term, def }: { term: string; def: { short: string; long: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f5f7fa" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.7rem 0", cursor: "pointer",
        }}
      >
        <div>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0a1628" }}>{term}</span>
          <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "2px 0 0" }}>{def.short}</p>
        </div>
        <span style={{ color: "#94a3b8", fontSize: "0.8rem", flexShrink: 0, marginLeft: 8 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div style={{
          padding: "0 0 0.75rem",
          fontSize: "0.75rem", color: "#334155", lineHeight: 1.75,
        }}>{def.long}</div>
      )}
    </div>
  );
}