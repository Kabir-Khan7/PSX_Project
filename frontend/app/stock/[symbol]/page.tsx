"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
  BarChart, Bar, Cell,
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
    performance:        Record<string, number | null>;
    rsi:                { value: number|null; signal: string; zone: string };
    macd:               { macd: number|null; signal_line: number|null; histogram: number|null; crossover: string };
    bollinger:          { upper: number|null; middle: number|null; lower: number|null; band_position_pct: number|null; position: string; signal: string };
    volatility:         { daily_pct: number|null; annual_pct: number|null; level: string; description: string; risk_score: number };
    volume:             { available: boolean; current: number; average: number; ratio_pct: number|null; trend: string; divergence: string; div_signal: string };
    support_resistance: { pivot: number|null; nearest_resistance: number|null; nearest_support: number|null; pct_to_resistance: number|null; pct_to_support: number|null };
    moving_averages:    Record<string, number | string | null>;
    trend_strength:     { adx: number|null; strength: string; direction: string; description: string };
    week52:             { high_52w: number|null; low_52w: number|null; position_pct: number|null; from_high_pct: number|null; zone: string; description: string };
    momentum:           { score: number|null; level: string; description: string; roc_5d: number|null; roc_20d: number|null };
    fundamentals?:      Record<string, number | null>;
    composite:          {
      score: number; grade: string; color: string; verdict: string;
      breakdown: { factor: string; score: number; weight: number }[];
      suggestion: { outlook: string; signals: string[]; disclaimer: string };
    };
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtN(n: number|null|undefined, d = 2): string {
  if (n == null) return "N/A";
  return n.toLocaleString("en-PK", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number|null|undefined): string {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function gradeColor(grade: string): string {
  return { A: "#059669", B: "#0891b2", C: "#d97706", D: "#f97316", F: "#dc2626" }[grade] || "#64748b";
}
function zoneColor(zone: string): string {
  const map: Record<string, string> = {
    overbought: "#dc2626", oversold: "#059669", bullish: "#059669",
    bearish: "#dc2626", neutral: "#64748b", near_highs: "#059669",
    near_lows: "#dc2626", middle_range: "#64748b",
    bullish_confirmation: "#059669", bearish_confirmation: "#dc2626",
    weak_rally: "#d97706", weak_decline: "#d97706",
    strongly_bullish: "#059669", bullish_alignment: "#0891b2",
    bearish_alignment: "#f97316", strongly_bearish: "#dc2626",
    low: "#059669", moderate: "#d97706", high: "#f97316", very_high: "#dc2626",
    strong: "#059669", very_strong: "#059669", developing: "#d97706", weak: "#94a3b8",
  };
  return map[zone] || "#64748b";
}
function zoneBg(zone: string): string {
  const c = zoneColor(zone);
  const map: Record<string, string> = {
    "#059669": "#ecfdf5", "#0891b2": "#e0f7fa", "#d97706": "#fffbeb",
    "#f97316": "#fff7ed", "#dc2626": "#fef2f2", "#94a3b8": "#f8fafc",
    "#64748b": "#f8fafc",
  };
  return map[c] || "#f8fafc";
}

const GLOSSARY: Record<string, { short: string; long: string }> = {
  "RSI": {
    short: "Relative Strength Index — 0 to 100 scale measuring buying/selling pressure",
    long: "RSI above 70 = overbought (stock may have risen too fast, possible pullback). RSI below 30 = oversold (stock may have fallen too much, possible bounce). Between 40–60 = neutral — no extreme signal. RSI is one of the most widely used technical indicators in the world."
  },
  "MACD": {
    short: "Moving Average Convergence Divergence — trend momentum signal",
    long: "MACD compares two moving averages (12-day vs 26-day). When the fast line crosses above the slow line = bullish signal. When it crosses below = bearish signal. The histogram shows the gap between the two lines — wider gap means stronger momentum."
  },
  "Bollinger Bands": {
    short: "Price channel showing normal trading range (±2 standard deviations)",
    long: "Bollinger Bands create an upper and lower price band. When price touches the upper band, the stock may be overextended. When it touches the lower band, it may be undervalued. About 95% of price action happens inside the bands. A squeeze (narrow bands) often precedes a big move."
  },
  "ADX": {
    short: "Average Directional Index — measures how strong a trend is (not direction)",
    long: "ADX above 25 = strong trend in place. Below 20 = ranging/sideways market. It does NOT tell you which direction — just how strong. Use it alongside the +DI/-DI lines: if +DI > -DI and ADX > 25, that's a confirmed uptrend."
  },
  "Moving Averages": {
    short: "Average price over N days — smooths out noise to show the real trend",
    long: "MA10 = average of last 10 days, MA50 = last 50 days, MA200 = last 200 days. If price > MA200, the long-term trend is up. A 'Golden Cross' (MA50 crosses above MA200) is considered a major bullish signal. A 'Death Cross' is the opposite."
  },
  "Volatility": {
    short: "How much the price moves each day on average",
    long: "Low volatility (<1%/day) = stable, predictable stock. Moderate (1–2%) = normal for PSX blue chips. High (2–3.5%) = significant swings, more risk but more opportunity. Very high (3.5%+) = speculative stock, only for experienced traders. Annual volatility = daily × √252."
  },
  "Support": {
    short: "A price floor where buyers tend to step in and stop the decline",
    long: "When a stock falls to a support level, buyers see it as cheap and start buying — which stops the fall. If support breaks, the next support level becomes the target. Support and resistance levels are self-fulfilling — because millions of traders watch them."
  },
  "Resistance": {
    short: "A price ceiling where sellers tend to appear and stop the rally",
    long: "When a stock rises to resistance, sellers take profits and new buyers hesitate — which stops the rally. When resistance is broken, it often becomes new support. The more times a level has been tested, the more significant it is."
  },
  "Momentum": {
    short: "Rate of price change — like measuring acceleration in a moving car",
    long: "High positive momentum means the price has been rising quickly and consistently. Trends tend to persist — a stock in momentum often keeps moving in the same direction until a catalyst reverses it. Rate of Change (ROC) measures: (current price / price N days ago) - 1."
  },
  "P/E Ratio": {
    short: "Price-to-Earnings — how many rupees you pay per rupee of annual profit",
    long: "P/E of 10 means: pay PKR 10 today for PKR 1 of annual profit. Lower P/E = potentially cheaper (value stock). Higher P/E = market expects strong growth. Always compare P/E within the same sector — banking P/Es differ from cement P/Es. Pakistan market avg P/E is ~8–12."
  },
  "Dividend Yield": {
    short: "Annual dividend as % of share price — your cash income from holding",
    long: "5% yield means: invest PKR 100, receive PKR 5 per year in cash dividends. PSX-listed companies like OGDC, HBL, and MCB often pay strong dividends. High yield can mean good income OR a falling stock price (since yield = dividend / price). Check if dividends are consistent."
  },
};

// ── Tooltip component ──────────────────────────────────────────────────────
function InfoTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const g = GLOSSARY[term];
  if (!g) return null;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 16, height: 16, borderRadius: "50%",
        background: open ? "#0891b2" : "#e0f7fa",
        color: open ? "#fff" : "#0369a1",
        border: "none", cursor: "pointer",
        fontSize: "0.58rem", fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginLeft: 5, flexShrink: 0,
        transition: "all 0.15s",
      }}>?</button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#0a1628", color: "#f0f6ff",
          padding: "12px 14px", borderRadius: 10,
          fontSize: "0.72rem", lineHeight: 1.7,
          width: 270, zIndex: 1000,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <p style={{ fontWeight: 700, color: "#0fd4b4", fontSize: "0.68rem",
            marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{term}</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem",
            marginBottom: 8, fontStyle: "italic" }}>{g.short}</p>
          <p>{g.long}</p>
        </div>
      )}
    </span>
  );
}

// ── Signal Card ────────────────────────────────────────────────────────────
function SignalCard({ icon, title, value, unit, zone, signal, glossaryTerm, extra }: {
  icon: string; title: string;
  value: string; unit?: string;
  zone: string; signal: string;
  glossaryTerm?: string;
  extra?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const c  = zoneColor(zone);
  const bg = zoneBg(zone);

  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderTop: `3px solid ${c}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(10,22,40,0.05)",
      transition: "box-shadow 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(10,22,40,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(10,22,40,0.05)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      <div style={{ padding: "1rem 1.1rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: "1rem" }}>{icon}</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155",
              letterSpacing: "0.01em" }}>{title}</span>
            {glossaryTerm && <InfoTip term={glossaryTerm}/>}
          </div>
          <span style={{
            fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase", color: c, background: bg,
            padding: "2px 8px", borderRadius: 20,
          }}>{zone.replace(/_/g, " ")}</span>
        </div>

        {/* Value */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "1.6rem", fontWeight: 700,
            color: c, letterSpacing: "-0.03em", lineHeight: 1,
          }}>{value}</span>
          {unit && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8",
            letterSpacing: "0.06em", textTransform: "uppercase" }}>{unit}</span>}
        </div>

        {/* Signal line */}
        <p style={{ fontSize: "0.72rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
          {signal}
        </p>

        {/* Extra content */}
        {extra && <div style={{ marginTop: 10 }}>{extra}</div>}

        {/* Expand button */}
        {glossaryTerm && GLOSSARY[glossaryTerm] && (
          <button onClick={() => setExpanded(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.65rem", fontWeight: 600, color: "#0891b2",
            padding: "6px 0 0", display: "flex", alignItems: "center", gap: 4,
            fontFamily: "inherit",
          }}>
            {expanded ? "▲ Hide explanation" : "▼ What does this mean?"}
          </button>
        )}
      </div>

      {/* Expanded explanation */}
      {expanded && glossaryTerm && GLOSSARY[glossaryTerm] && (
        <div style={{
          padding: "0.85rem 1.1rem",
          background: "#f8fafc",
          borderTop: "1px solid #f1f5f9",
          fontSize: "0.73rem", color: "#334155", lineHeight: 1.75,
        }}>
          {GLOSSARY[glossaryTerm].long}
        </div>
      )}
    </div>
  );
}

// ── Gauge Bar ──────────────────────────────────────────────────────────────
function GaugeBar({ value, max = 100, color, showLabel = false }: {
  value: number; max?: number; color: string; showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "space-between",
          fontSize: "0.6rem", color: "#94a3b8", marginBottom: 4 }}>
          <span>0</span><span style={{ fontFamily: "JetBrains Mono,monospace", color }}>{value}</span><span>{max}</span>
        </div>
      )}
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color, borderRadius: 999,
          transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
        }}/>
      </div>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score, grade, size = 96 }: { score: number; grade: string; size?: number }) {
  const r = size * 0.375;
  const C = 2 * Math.PI * r;
  const fill = (score / 100) * C;
  const c = gradeColor(grade);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={size * 0.083}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={c} strokeWidth={size * 0.083}
        strokeDasharray={`${fill} ${C}`}
        strokeDashoffset={C / 4}
        strokeLinecap="round"/>
      <text x={size/2} y={size/2 - 4} textAnchor="middle"
        style={{ fontFamily: "JetBrains Mono,monospace", fontSize: size * 0.21,
          fontWeight: 700, fill: c }}>
        {Math.round(score)}
      </text>
      <text x={size/2} y={size/2 + size * 0.155} textAnchor="middle"
        style={{ fontFamily: "JetBrains Mono,monospace", fontSize: size * 0.125,
          fontWeight: 700, fill: c }}>
        {grade}
      </text>
    </svg>
  );
}

// ── RSI Gauge ──────────────────────────────────────────────────────────────
function RSIGauge({ value }: { value: number | null }) {
  if (value == null) return <p style={{ fontSize: "0.72rem", color: "#94a3b8" }}>N/A</p>;
  const pct = value;
  const c = value >= 70 ? "#dc2626" : value <= 30 ? "#059669" : "#0891b2";
  const zones = [
    { label: "Oversold", x: 0, w: 30, bg: "#ecfdf5" },
    { label: "Neutral",  x: 30, w: 40, bg: "#f8fafc" },
    { label: "Overbought", x: 70, w: 30, bg: "#fef2f2" },
  ];
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ position: "relative", height: 10, borderRadius: 999, overflow: "hidden",
        background: "linear-gradient(90deg, #059669 0%, #34d399 28%, #94a3b8 50%, #fbbf24 72%, #dc2626 100%)" }}>
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff", border: `2.5px solid ${c}`,
          boxShadow: `0 0 0 3px ${c}22`,
          transition: "left 0.8s ease",
        }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: "0.57rem", color: "#94a3b8", marginTop: 4 }}>
        {zones.map(z => <span key={z.label}>{z.label}</span>)}
      </div>
    </div>
  );
}

// ── Report Card (printable summary) ───────────────────────────────────────
function ReportCard({ data, a }: { data: AnalysisData; a: AnalysisData["analysis"] }) {
  const isUp = data.change >= 0;
  const now  = new Date().toLocaleDateString("en-PK", {
    year: "numeric", month: "long", day: "numeric",
  });

  const allSignals = [
    { label: "RSI",       zone: a.rsi.zone,                     val: a.rsi.value?.toFixed(1) ?? "N/A" },
    { label: "MACD",      zone: a.macd.crossover,               val: a.macd.crossover.replace(/_/g, " ") },
    { label: "MA Trend",  zone: (a.moving_averages.trend_signal as string) || "neutral", val: (a.moving_averages.trend_signal as string || "").replace(/_/g, " ") },
    { label: "Momentum",  zone: a.momentum.level,               val: a.momentum.level.replace(/_/g, " ") },
    { label: "Volatility",zone: a.volatility.level,             val: a.volatility.level.replace(/_/g, " ") },
    { label: "Volume",    zone: a.volume.divergence || "neutral",val: (a.volume.divergence || "N/A").replace(/_/g, " ") },
    { label: "52W Zone",  zone: a.week52.zone || "middle_range", val: (a.week52.zone || "").replace(/_/g, " ") },
    { label: "Trend ADX", zone: a.trend_strength.strength,       val: a.trend_strength.adx?.toFixed(1) ?? "N/A" },
  ];

  const perfRows = [
    { label: "1 Week",   val: a.performance.ret_1w },
    { label: "1 Month",  val: a.performance.ret_1m },
    { label: "3 Months", val: a.performance.ret_3m },
    { label: "1 Year",   val: a.performance.ret_1y },
  ];

  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(10,22,40,0.05)",
    }}>
      {/* Report header */}
      <div style={{
        background: "#0a1628",
        padding: "1.5rem 1.75rem",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 80% at 90% 50%, rgba(15,212,180,0.06) 0%, transparent 70%)" }}/>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
          <div>
            <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
              Technical Analysis Report
            </p>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f0f6ff",
              letterSpacing: "-0.03em", margin: "0 0 4px" }}>{data.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.72rem",
                color: "rgba(255,255,255,0.35)" }}>PSX: {data.symbol}</span>
              <span style={{ width: 3, height: 3, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)", display: "inline-block" }}/>
              <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>{data.sector}</span>
              <span style={{ width: 3, height: 3, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)", display: "inline-block" }}/>
              <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>Generated {now}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <ScoreRing score={a.composite.score} grade={a.composite.grade} size={80}/>
            <div>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                Current Price
              </p>
              <p style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "1.5rem",
                fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>
                PKR {fmtN(data.current_price)}
              </p>
              <span style={{
                fontFamily: "JetBrains Mono,monospace", fontSize: "0.75rem", fontWeight: 600,
                padding: "3px 10px", borderRadius: 8,
                background: isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                color: isUp ? "#34d399" : "#f87171",
              }}>
                {isUp ? "▲" : "▼"} {fmtPct(data.change_pct)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.75rem" }}>

        {/* Overall verdict */}
        <div style={{
          background: a.composite.color === "green" ? "#ecfdf5" :
            a.composite.color === "red" ? "#fef2f2" :
            a.composite.color === "teal" ? "#e0f7fa" : "#fffbeb",
          border: `1px solid ${a.composite.color === "green" ? "#a7f3d0" :
            a.composite.color === "red" ? "#fecaca" :
            a.composite.color === "teal" ? "#b2ebf2" : "#fde68a"}`,
          borderRadius: 10, padding: "1rem 1.1rem", marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: "1.1rem" }}>
              {a.composite.grade === "A" ? "🟢" : a.composite.grade === "B" ? "🔵" :
               a.composite.grade === "C" ? "🟡" : a.composite.grade === "D" ? "🟠" : "🔴"}
            </span>
            <span style={{ fontWeight: 800, fontSize: "0.9rem",
              color: gradeColor(a.composite.grade) }}>
              {a.composite.verdict} — Grade {a.composite.grade} ({a.composite.score.toFixed(1)}/100)
            </span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.7, margin: 0 }}>
            {a.composite.suggestion.outlook}
          </p>
        </div>

        {/* Signal grid */}
        <h3 style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.85rem" }}>
          All Signals at a Glance
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.5rem", marginBottom: "1.5rem" }}>
          {allSignals.map(s => (
            <div key={s.label} style={{
              background: zoneBg(s.zone),
              border: `1px solid ${zoneColor(s.zone)}22`,
              borderLeft: `3px solid ${zoneColor(s.zone)}`,
              borderRadius: 8, padding: "0.6rem 0.75rem",
            }}>
              <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "#94a3b8", margin: "0 0 3px" }}>
                {s.label}
              </p>
              <p style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.72rem",
                fontWeight: 700, color: zoneColor(s.zone), margin: 0,
                textTransform: "capitalize" }}>
                {s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Two-column: performance + key levels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem",
          marginBottom: "1.5rem" }}>

          {/* Performance */}
          <div>
            <h3 style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.75rem" }}>
              Price Returns
            </h3>
            <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, overflow: "hidden" }}>
              {perfRows.map((r, i) => (
                <div key={r.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.6rem 0.85rem",
                  borderBottom: i < perfRows.length - 1 ? "1px solid #f8fafc" : "none",
                  background: i % 2 === 0 ? "#fff" : "#fafbfc",
                }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.label}</span>
                  <span style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: "0.82rem", fontWeight: 700,
                    color: r.val == null ? "#94a3b8" :
                      r.val >= 0 ? "#059669" : "#dc2626",
                  }}>
                    {r.val != null ? fmtPct(r.val) : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Key levels */}
          <div>
            <h3 style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.75rem" }}>
              Key Price Levels
            </h3>
            <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, overflow: "hidden" }}>
              {[
                { label: "52W High",    val: a.week52.high_52w,                 c: "#059669" },
                { label: "Resistance",  val: a.support_resistance.nearest_resistance, c: "#dc2626" },
                { label: "Current",     val: data.current_price,                c: "#0a1628" },
                { label: "Support",     val: a.support_resistance.nearest_support,   c: "#059669" },
                { label: "52W Low",     val: a.week52.low_52w,                  c: "#dc2626" },
              ].map((r, i) => (
                <div key={r.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.6rem 0.85rem",
                  borderBottom: i < 4 ? "1px solid #f8fafc" : "none",
                  background: r.label === "Current" ? "#f0f9ff" : i % 2 === 0 ? "#fff" : "#fafbfc",
                }}>
                  <span style={{ fontSize: "0.75rem",
                    color: r.label === "Current" ? "#0369a1" : "#64748b",
                    fontWeight: r.label === "Current" ? 700 : 400 }}>
                    {r.label}
                  </span>
                  <span style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: "0.82rem", fontWeight: 700, color: r.c,
                  }}>
                    {r.val != null ? `PKR ${fmtN(r.val)}` : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key signals detected */}
        {a.composite.suggestion.signals.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.75rem" }}>
              Key Signals Detected
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {a.composite.suggestion.signals.map((s, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  background: "#f8fafc", border: "1px solid #f1f5f9",
                  borderRadius: 8, padding: "0.6rem 0.85rem",
                }}>
                  <span style={{ fontSize: "0.82rem", flexShrink: 0 }}>
                    {i === 0 ? "📈" : i === 1 ? "⚡" : i === 2 ? "🔍" : "💡"}
                  </span>
                  <p style={{ fontSize: "0.75rem", color: "#334155",
                    lineHeight: 1.6, margin: 0 }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score breakdown */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.75rem" }}>
            Score Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {a.composite.breakdown.map(b => (
              <div key={b.factor}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  marginBottom: 4 }}>
                  <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                    {b.factor}
                  </span>
                  <span style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: "0.75rem", fontWeight: 700,
                    color: b.score >= 60 ? "#059669" : b.score >= 40 ? "#d97706" : "#dc2626",
                  }}>{b.score}/100</span>
                </div>
                <GaugeBar value={b.score}
                  color={b.score >= 60 ? "#059669" : b.score >= 40 ? "#d97706" : "#dc2626"}/>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 10, padding: "0.85rem 1rem",
        }}>
          <p style={{ fontSize: "0.7rem", color: "#92400e", lineHeight: 1.75, margin: 0 }}>
            ⚠️ <strong>Important:</strong> {a.composite.suggestion.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Glossary Section ───────────────────────────────────────────────────────
function GlossarySection() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(10,22,40,0.05)",
    }}>
      <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid #f1f5f9",
        background: "#fafbfc" }}>
        <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0a1628",
          margin: 0, letterSpacing: "-0.01em" }}>
          📚 Investor Glossary
        </h2>
        <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "3px 0 0" }}>
          Every term explained in plain English — tap any term to read more
        </p>
      </div>
      <div style={{ padding: "0.5rem 0" }}>
        {Object.entries(GLOSSARY).map(([term, def]) => (
          <div key={term} style={{ borderBottom: "1px solid #f8fafc" }}>
            <button
              onClick={() => setOpen(open === term ? null : term)}
              style={{
                width: "100%", background: "none", border: "none",
                cursor: "pointer", padding: "0.75rem 1.4rem",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                textAlign: "left", fontFamily: "inherit",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
            >
              <div>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0a1628" }}>{term}</span>
                <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "2px 0 0" }}>{def.short}</p>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 10, flexShrink: 0 }}>
                {open === term ? "▲" : "▼"}
              </span>
            </button>
            {open === term && (
              <div style={{
                padding: "0 1.4rem 0.85rem",
                fontSize: "0.75rem", color: "#334155", lineHeight: 1.8,
              }}>
                {def.long}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const PERIODS = [
  { k: "1wk", l: "1W" }, { k: "1mo", l: "1M" },
  { k: "3mo", l: "3M" }, { k: "1y",  l: "1Y" },
];

const SECTIONS = [
  { k: "overview",   l: "Overview",    emoji: "📊" },
  { k: "technical",  l: "Technical",   emoji: "📈" },
  { k: "momentum",   l: "Momentum",    emoji: "⚡" },
  { k: "report",     l: "Full Report", emoji: "📋" },
  { k: "glossary",   l: "Glossary",    emoji: "📚" },
];

export default function StockAnalysisPage() {
  const params  = useParams();
  const router  = useRouter();
  const symbol  = (params?.symbol as string)?.toUpperCase() ?? "";

  const [data, setData]       = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [period, setPeriod]   = useState("3mo");
  const [section, setSection] = useState("overview");
  const [inWatch, setInWatch] = useState(false);
  const [wLoad, setWLoad]     = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
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
        setInWatch(false);
        showToast(`${symbol} removed from watchlist`);
      } else {
        await apiPost("/watchlist/", { symbol });
        setInWatch(true);
        showToast(`${symbol} added to watchlist ★`);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", false);
    } finally { setWLoad(false); }
  };

  const isUp       = (data?.change ?? 0) >= 0;
  const a          = data?.analysis;
  const chartData  = (data?.history ?? []).map(d => ({
    d: d.date.slice(5), v: d.close, vol: d.volume,
  }));

  return (
    <AppLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .ap * { box-sizing: border-box; }
        .ap {
          font-family: 'Plus Jakarta Sans', sans-serif;
          --navy: #0a1628;
          --teal: #0fd4b4;
          --green: #059669;
          --red: #dc2626;
          --amber: #d97706;
          --blue: #0891b2;
        }
        @keyframes toastIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .toast-bar { animation: toastIn 0.2s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeUp 0.35s ease forwards; }
        @keyframes skpulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        .sk { background: #e8edf4; border-radius: 8px; animation: skpulse 1.5s ease infinite; }
        .period-btn { cursor:pointer; border:none; font-family:inherit; transition:all 0.15s; }
        .section-btn { cursor:pointer; border:none; font-family:inherit; transition:all 0.15s; background:none; }
        @media (max-width: 900px) {
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr 1fr !important; }
          .four-col { grid-template-columns: repeat(2,1fr) !important; }
          .ap-pad { padding: 1rem !important; }
          .hero-pad { padding: 1.25rem 1.25rem 0 !important; }
          .price-row { flex-direction: column !important; gap: 0.75rem !important; }
        }
        @media (max-width: 560px) {
          .three-col { grid-template-columns: 1fr !important; }
          .four-col { grid-template-columns: 1fr 1fr !important; }
          .sections-scroll { overflow-x: auto; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast-bar" style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.ok ? "#0a1628" : "#dc2626",
          color: "#fff", padding: "10px 18px", borderRadius: 10,
          fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.01em",
          boxShadow: "0 8px 32px rgba(10,22,40,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          maxWidth: 320,
        }}>{toast.msg}</div>
      )}

      <div className="ap">

        {/* ── LOADING ── */}
        {loading && (
          <div className="ap-pad" style={{ padding: "1.5rem" }}>
            <div className="sk" style={{ height: 220, borderRadius: 18, marginBottom: "1.25rem" }}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.875rem", marginBottom: "1.25rem" }}>
              {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 80, borderRadius: 12 }}/>)}
            </div>
            <div className="sk" style={{ height: 360, borderRadius: 16 }}/>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && !loading && (
          <div className="ap-pad" style={{ padding: "1.5rem" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
              padding: "4rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>{error}</p>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "1.5rem" }}>
                This could be because the stock symbol doesn&apos;t exist or data is temporarily unavailable.
              </p>
              <button onClick={() => router.push("/dashboard")}
                style={{ padding: "9px 22px", background: "#0a1628", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit" }}>
                ← Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {data && !loading && a && (
          <>
            {/* ── HERO ── */}
            <div style={{
              background: "#060d1f",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse 50% 100% at 85% 0%, rgba(15,212,180,0.08) 0%, transparent 60%)" }}/>

              <div className="hero-pad" style={{ padding: "1.75rem 1.75rem 0", position: "relative", zIndex: 1 }}>
                <div className="price-row" style={{ display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: "1.5rem", marginBottom: "1.25rem" }}>

                  {/* Identity */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "#0fd4b4",
                        background: "rgba(15,212,180,0.1)",
                        border: "1px solid rgba(15,212,180,0.2)",
                        padding: "3px 10px", borderRadius: 20,
                      }}>{data.sector}</span>
                      <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.25)" }}>PSX: {data.symbol}</span>
                    </div>
                    <h1 style={{
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
                      fontWeight: 800, color: "#f0f6ff",
                      letterSpacing: "-0.03em", margin: "0 0 6px", lineHeight: 1.1,
                    }}>{data.name}</h1>
                    <p style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.65rem",
                      color: "rgba(255,255,255,0.25)", margin: 0 }}>
                      Technical Analysis · {period.toUpperCase()} period
                    </p>
                  </div>

                  {/* Price block */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
                      fontWeight: 600, color: "#ffffff",
                      lineHeight: 1, margin: "0 0 8px",
                      letterSpacing: "-0.02em",
                    }}>
                      PKR {fmtN(data.current_price)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginBottom: 6 }}>
                      <span style={{
                        fontFamily: "JetBrains Mono,monospace",
                        fontSize: "0.85rem", fontWeight: 600,
                        padding: "4px 12px", borderRadius: 8,
                        background: isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                        color: isUp ? "#34d399" : "#f87171",
                      }}>
                        {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{fmtPct(data.change_pct)}
                      </span>
                      <button onClick={toggleWatch} disabled={wLoad}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 13px", borderRadius: 8, cursor: "pointer",
                          background: inWatch ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.08)",
                          border: `1px solid ${inWatch ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.12)"}`,
                          color: inWatch ? "#fbbf24" : "rgba(255,255,255,0.55)",
                          fontSize: "0.72rem", fontWeight: 600,
                          fontFamily: "inherit", transition: "all 0.15s",
                        }}>
                        <svg width="12" height="12" viewBox="0 0 24 24"
                          fill={inWatch ? "#fbbf24" : "none"}
                          stroke={inWatch ? "#fbbf24" : "currentColor"}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        {inWatch ? "Watchlisted" : "Watchlist"}
                      </button>
                    </div>
                    {/* Score badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <ScoreRing score={a.composite.score} grade={a.composite.grade} size={64}/>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em",
                          textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: "0 0 2px" }}>
                          Overall Score
                        </p>
                        <p style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.8rem",
                          fontWeight: 700, color: gradeColor(a.composite.grade), margin: 0 }}>
                          {a.composite.verdict}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period + MA toggles */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
                  {PERIODS.map(p => (
                    <button key={p.k} className="period-btn"
                      onClick={() => { setPeriod(p.k); load(p.k); }}
                      style={{
                        padding: "5px 13px", borderRadius: 8,
                        fontSize: "0.72rem", fontWeight: 600,
                        background: period === p.k ? "#fff" : "rgba(255,255,255,0.07)",
                        color: period === p.k ? "#0a1628" : "rgba(255,255,255,0.4)",
                      }}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 2 && (
                <div style={{ position: "relative", zIndex: 1 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 24, left: -4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }}
                        axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }}
                        axisLine={false} tickLine={false} domain={["auto","auto"]} width={54}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}/>
                      <Tooltip
                        contentStyle={{ background: "#162035", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px" }}
                        labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                        itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700 }}
                        formatter={(v: unknown) => [`PKR ${Number(v).toLocaleString("en-PK")}`, data.symbol]}
                      />
                      {a.support_resistance?.nearest_resistance && (
                        <ReferenceLine y={a.support_resistance.nearest_resistance}
                          stroke="rgba(248,113,113,0.5)" strokeDasharray="5 3"
                          label={{ value: "R", position: "right", fontSize: 9, fill: "#f87171" }}/>
                      )}
                      {a.support_resistance?.nearest_support && (
                        <ReferenceLine y={a.support_resistance.nearest_support}
                          stroke="rgba(52,211,153,0.5)" strokeDasharray="5 3"
                          label={{ value: "S", position: "right", fontSize: 9, fill: "#34d399" }}/>
                      )}
                      {a.moving_averages?.ma20 && (
                        <ReferenceLine y={a.moving_averages.ma20 as number}
                          stroke="rgba(245,158,11,0.4)" strokeDasharray="3 3"
                          label={{ value: "MA20", position: "right", fontSize: 8, fill: "#fbbf24" }}/>
                      )}
                      <Area type="monotone" dataKey="v"
                        stroke={isUp ? "#0fd4b4" : "#f87171"}
                        strokeWidth={2.5} fill="url(#chartGrad)"
                        dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── SECTION NAVIGATION ── */}
            <div className="sections-scroll" style={{
              background: "#fff",
              borderBottom: "1px solid #e2e8f0",
              position: "sticky", top: 54, zIndex: 40,
              boxShadow: "0 2px 8px rgba(10,22,40,0.06)",
            }}>
              <div style={{
                display: "flex", gap: 0,
                padding: "0 1.5rem",
                overflowX: "auto",
              }}>
                {SECTIONS.map(s => (
                  <button key={s.k} className="section-btn"
                    onClick={() => setSection(s.k)}
                    style={{
                      padding: "0.75rem 1.1rem",
                      fontSize: "0.78rem", fontWeight: 600,
                      color: section === s.k ? "#0a1628" : "#94a3b8",
                      borderBottom: `2px solid ${section === s.k ? "#0fd4b4" : "transparent"}`,
                      whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                    <span>{s.emoji}</span>{s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* ── SECTION CONTENT ── */}
            <div className="ap-pad fade-in" style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>

              {/* ═══ OVERVIEW ═══ */}
              {section === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Quick stats row */}
                  <div className="four-col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.875rem" }}>
                    {[
                      { l: "RSI (14)", v: a.rsi.value?.toFixed(1) ?? "N/A", zone: a.rsi.zone, unit: "" },
                      { l: "Volatility", v: a.volatility.daily_pct?.toFixed(2) ?? "N/A", zone: a.volatility.level, unit: "%/day" },
                      { l: "Momentum", v: a.momentum.score?.toFixed(0) ?? "N/A", zone: a.momentum.level, unit: "/100" },
                      { l: "ADX Trend", v: a.trend_strength.adx?.toFixed(1) ?? "N/A", zone: a.trend_strength.strength, unit: "" },
                    ].map(card => (
                      <div key={card.l} style={{
                        background: "#fff", border: "1px solid #e2e8f0",
                        borderTop: `3px solid ${zoneColor(card.zone)}`,
                        borderRadius: 12, padding: "1rem 1.1rem",
                        boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
                      }}>
                        <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em",
                          textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>
                          {card.l}
                        </p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                          <span style={{
                            fontFamily: "JetBrains Mono,monospace",
                            fontSize: "1.5rem", fontWeight: 700,
                            color: zoneColor(card.zone), letterSpacing: "-0.02em",
                          }}>{card.v}</span>
                          {card.unit && <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 700 }}>{card.unit}</span>}
                        </div>
                        <span style={{
                          fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em",
                          textTransform: "capitalize",
                          color: zoneColor(card.zone),
                          background: zoneBg(card.zone),
                          padding: "2px 7px", borderRadius: 20,
                        }}>{card.zone.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>

                  {/* 52-week range */}
                  {a.week52.high_52w && a.week52.low_52w && (
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 14, padding: "1.25rem 1.4rem",
                      boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0a1628",
                          margin: 0 }}>52-Week Price Range</h3>
                        <span style={{
                          fontSize: "0.62rem", fontWeight: 700, color: zoneColor(a.week52.zone),
                          background: zoneBg(a.week52.zone), padding: "2px 8px", borderRadius: 20,
                        }}>{a.week52.zone.replace(/_/g, " ")}</span>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: "0.68rem", fontFamily: "JetBrains Mono,monospace",
                          color: "#94a3b8", marginBottom: 6 }}>
                          <span>Low: PKR {fmtN(a.week52.low_52w, 0)}</span>
                          <span style={{ color: "#0a1628", fontWeight: 700 }}>
                            Now: PKR {fmtN(data.current_price, 0)}
                          </span>
                          <span>High: PKR {fmtN(a.week52.high_52w, 0)}</span>
                        </div>
                        <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, position: "relative" }}>
                          <div style={{
                            width: `${a.week52.position_pct ?? 50}%`,
                            height: "100%", background: "#0fd4b4", borderRadius: 999,
                            transition: "width 1s ease",
                          }}/>
                          <div style={{
                            position: "absolute",
                            left: `${a.week52.position_pct ?? 50}%`,
                            top: "50%", transform: "translate(-50%, -50%)",
                            width: 14, height: 14, borderRadius: "50%",
                            background: "#0a1628", border: "2.5px solid #fff",
                            boxShadow: "0 1px 4px rgba(10,22,40,0.25)",
                          }}/>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.72rem", color: "#64748b",
                        lineHeight: 1.65, margin: 0 }}>{a.week52.description}</p>
                    </div>
                  )}

                  {/* Performance + Support/Resistance */}
                  <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                    {/* Performance returns */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 14, padding: "1.25rem 1.4rem",
                      boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                      <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0a1628",
                        margin: "0 0 1rem" }}>Price Returns</h3>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { label: "1W", val: a.performance.ret_1w ?? 0 },
                            { label: "1M", val: a.performance.ret_1m ?? 0 },
                            { label: "3M", val: a.performance.ret_3m ?? 0 },
                            { label: "1Y", val: a.performance.ret_1y ?? 0 },
                          ]} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fontSize: 9, fill: "#94a3b8", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false}
                              tickFormatter={v => `${v.toFixed(0)}%`}/>
                            <Tooltip
                              contentStyle={{ background: "#0a1628", border: "none", borderRadius: 8 }}
                              labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}
                              itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 12 }}
                              formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, "Return"]}
                            />
                            <Bar dataKey="val" radius={[4,4,0,0]}>
                              {[a.performance.ret_1w, a.performance.ret_1m, a.performance.ret_3m, a.performance.ret_1y].map((v, i) => (
                                <Cell key={i} fill={!v ? "#e2e8f0" : v >= 0 ? "#059669" : "#dc2626"}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 8 }}>
                        {[
                          { l: "1W", v: a.performance.ret_1w },
                          { l: "1M", v: a.performance.ret_1m },
                          { l: "3M", v: a.performance.ret_3m },
                          { l: "1Y", v: a.performance.ret_1y },
                        ].map(r => (
                          <div key={r.l} style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "0.58rem", color: "#94a3b8", margin: "0 0 2px",
                              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</p>
                            <p style={{
                              fontFamily: "JetBrains Mono,monospace", fontSize: "0.78rem", fontWeight: 700,
                              margin: 0,
                              color: r.v == null ? "#94a3b8" : r.v >= 0 ? "#059669" : "#dc2626",
                            }}>{r.v != null ? fmtPct(r.v) : "N/A"}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Support & Resistance */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 14, padding: "1.25rem 1.4rem",
                      boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0a1628", margin: 0 }}>
                          Support &amp; Resistance
                        </h3>
                        <InfoTip term="Support"/>
                        <InfoTip term="Resistance"/>
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: 14, lineHeight: 1.65 }}>
                        Red dashed line on chart = resistance. Green dashed = support.
                        These are key levels where the price tends to pause or reverse.
                      </p>
                      {[
                        { label: "Resistance (R1)",  val: a.support_resistance.nearest_resistance, c: "#dc2626",
                          sub: a.support_resistance.pct_to_resistance ? `${a.support_resistance.pct_to_resistance.toFixed(1)}% above current` : "" },
                        { label: "Pivot Point",      val: a.support_resistance.pivot,              c: "#0891b2", sub: "Mid-point of high/low/close" },
                        { label: "Support (S1)",     val: a.support_resistance.nearest_support,    c: "#059669",
                          sub: a.support_resistance.pct_to_support ? `${a.support_resistance.pct_to_support.toFixed(1)}% below current` : "" },
                      ].map(r => (
                        <div key={r.label} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "0.65rem 0.85rem", marginBottom: 6,
                          background: `${r.c}08`, border: `1px solid ${r.c}22`,
                          borderLeft: `3px solid ${r.c}`, borderRadius: 8,
                        }}>
                          <div>
                            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", margin: 0 }}>{r.label}</p>
                            {r.sub && <p style={{ fontSize: "0.62rem", color: "#94a3b8", margin: "2px 0 0" }}>{r.sub}</p>}
                          </div>
                          <span style={{ fontFamily: "JetBrains Mono,monospace",
                            fontSize: "0.88rem", fontWeight: 700, color: r.c }}>
                            {r.val != null ? `PKR ${fmtN(r.val)}` : "N/A"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TECHNICAL ═══ */}
              {section === "technical" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>

                    <SignalCard icon="📊" title="RSI — Relative Strength Index"
                      value={a.rsi.value?.toFixed(1) ?? "N/A"}
                      zone={a.rsi.zone} signal={a.rsi.signal} glossaryTerm="RSI"
                      extra={<RSIGauge value={a.rsi.value}/>}/>

                    <SignalCard icon="📈" title="MACD Crossover"
                      value={a.macd.crossover.replace(/_/g, " ")}
                      zone={a.macd.crossover.includes("bullish") ? "bullish" :
                            a.macd.crossover.includes("bearish") ? "bearish" : "neutral"}
                      signal={
                        a.macd.crossover === "bullish_crossover" ? "✅ Bullish crossover — new uptrend starting" :
                        a.macd.crossover === "bearish_crossover" ? "⚠️ Bearish crossover — downtrend starting" :
                        a.macd.crossover === "bullish" ? "📈 Positive momentum is active" :
                        "📉 Negative momentum is active"
                      } glossaryTerm="MACD"
                      extra={
                        <div style={{ display: "flex", gap: 8 }}>
                          {[
                            { l: "MACD", v: a.macd.macd },
                            { l: "Signal", v: a.macd.signal_line },
                            { l: "Hist", v: a.macd.histogram },
                          ].map(m => (
                            <div key={m.l} style={{ flex: 1, textAlign: "center",
                              background: "#f8fafc", borderRadius: 6, padding: "4px 6px" }}>
                              <p style={{ fontSize: "0.55rem", color: "#94a3b8",
                                margin: "0 0 2px", fontWeight: 700 }}>{m.l}</p>
                              <p style={{ fontFamily: "JetBrains Mono,monospace",
                                fontSize: "0.72rem", fontWeight: 700, margin: 0,
                                color: m.v && m.v > 0 ? "#059669" : "#dc2626" }}>
                                {m.v != null ? m.v.toFixed(2) : "N/A"}
                              </p>
                            </div>
                          ))}
                        </div>
                      }/>

                    <SignalCard icon="📉" title="Bollinger Bands"
                      value={a.bollinger.band_position_pct?.toFixed(0) ?? "N/A"} unit="%"
                      zone={a.bollinger.position || "neutral"}
                      signal={a.bollinger.signal} glossaryTerm="Bollinger Bands"
                      extra={
                        a.bollinger.band_position_pct != null ? (
                          <GaugeBar value={a.bollinger.band_position_pct}
                            color={a.bollinger.band_position_pct > 80 ? "#dc2626" :
                              a.bollinger.band_position_pct < 20 ? "#059669" : "#0fd4b4"}
                            showLabel/>
                        ) : undefined
                      }/>

                    <SignalCard icon="📐" title="Moving Averages Trend"
                      value={(a.moving_averages.trend_signal as string || "").replace(/_/g, " ")}
                      zone={(a.moving_averages.trend_signal as string) || "neutral"}
                      signal={a.moving_averages.trend_description as string || ""}
                      glossaryTerm="Moving Averages"
                      extra={
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {[10,20,50].map(p => {
                            const ma = a.moving_averages[`ma${p}`] as number|null;
                            if (!ma) return null;
                            const above = data.current_price > ma;
                            return (
                              <div key={p} style={{ display: "flex", justifyContent: "space-between",
                                alignItems: "center", fontSize: "0.7rem" }}>
                                <span style={{ color: "#94a3b8", fontWeight: 600 }}>MA{p}</span>
                                <span style={{ fontFamily: "JetBrains Mono,monospace",
                                  color: above ? "#059669" : "#dc2626", fontWeight: 700 }}>
                                  PKR {fmtN(ma)} {above ? "▲" : "▼"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      }/>

                    <SignalCard icon="💪" title="Trend Strength (ADX)"
                      value={a.trend_strength.adx?.toFixed(1) ?? "N/A"}
                      zone={a.trend_strength.strength}
                      signal={a.trend_strength.description} glossaryTerm="ADX"
                      extra={
                        a.trend_strength.adx != null ? (
                          <div>
                            <GaugeBar value={a.trend_strength.adx} max={60}
                              color={zoneColor(a.trend_strength.strength)}/>
                            <div style={{ display: "flex", justifyContent: "space-between",
                              fontSize: "0.57rem", color: "#94a3b8", marginTop: 3 }}>
                              <span>Sideways</span><span>Developing</span><span>Strong</span>
                            </div>
                          </div>
                        ) : undefined
                      }/>

                    <SignalCard icon="⚡" title="Volatility & Risk"
                      value={a.volatility.daily_pct?.toFixed(2) ?? "N/A"} unit="%/day"
                      zone={a.volatility.level}
                      signal={a.volatility.description} glossaryTerm="Volatility"
                      extra={
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          {[
                            { l: "Daily", v: `${fmtN(a.volatility.daily_pct)}%` },
                            { l: "Annual", v: `${fmtN(a.volatility.annual_pct)}%` },
                            { l: "Risk", v: `${a.volatility.risk_score}/100` },
                          ].map(m => (
                            <div key={m.l} style={{ flex: 1, textAlign: "center",
                              background: "#f8fafc", borderRadius: 6, padding: "4px 6px" }}>
                              <p style={{ fontSize: "0.55rem", color: "#94a3b8",
                                margin: "0 0 2px", fontWeight: 700 }}>{m.l}</p>
                              <p style={{ fontFamily: "JetBrains Mono,monospace",
                                fontSize: "0.72rem", fontWeight: 700, margin: 0,
                                color: "#334155" }}>{m.v}</p>
                            </div>
                          ))}
                        </div>
                      }/>
                  </div>
                </div>
              )}

              {/* ═══ MOMENTUM ═══ */}
              {section === "momentum" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Momentum score hero */}
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 14, padding: "1.5rem", boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem",
                      flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center" }}>
                        <ScoreRing score={a.momentum.score ?? 50}
                          grade={a.momentum.score && a.momentum.score >= 55 ? "B" :
                            a.momentum.score && a.momentum.score <= 45 ? "D" : "C"}
                          size={100}/>
                        <p style={{ fontSize: "0.62rem", color: "#94a3b8", margin: "6px 0 0",
                          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Momentum
                        </p>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif",
                          fontSize: "1.1rem", fontWeight: 700, color: "#0a1628",
                          margin: "0 0 8px", letterSpacing: "-0.02em" }}>
                          {a.momentum.level.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Momentum
                        </h3>
                        <p style={{ fontSize: "0.78rem", color: "#64748b",
                          lineHeight: 1.7, margin: "0 0 12px" }}>
                          {a.momentum.description}
                        </p>
                        <div style={{ display: "flex", gap: "1.5rem" }}>
                          {[
                            { l: "5-Day ROC",  v: a.momentum.roc_5d },
                            { l: "20-Day ROC", v: a.momentum.roc_20d },
                          ].map(r => (
                            <div key={r.l}>
                              <p style={{ fontSize: "0.6rem", color: "#94a3b8",
                                fontWeight: 700, textTransform: "uppercase",
                                letterSpacing: "0.07em", margin: "0 0 3px" }}>{r.l}</p>
                              <p style={{
                                fontFamily: "JetBrains Mono,monospace",
                                fontSize: "1.1rem", fontWeight: 700, margin: 0,
                                color: r.v == null ? "#94a3b8" :
                                  r.v >= 0 ? "#059669" : "#dc2626",
                              }}>{r.v != null ? fmtPct(r.v) : "N/A"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trend alignment checklist */}
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 14, overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                    <div style={{ padding: "1rem 1.4rem", borderBottom: "1px solid #f1f5f9",
                      background: "#fafbfc" }}>
                      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0a1628", margin: 0 }}>
                        Signal Alignment Check
                      </h3>
                      <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "3px 0 0" }}>
                        How many indicators are aligned bullish vs bearish
                      </p>
                    </div>
                    {[
                      { label: "RSI",          status: a.rsi.zone === "bullish" || a.rsi.zone === "oversold", val: a.rsi.zone.replace(/_/g, " "), tip: a.rsi.signal },
                      { label: "MACD",         status: a.macd.crossover.includes("bullish"), val: a.macd.crossover.replace(/_/g, " "), tip: "" },
                      { label: "MA Trend",     status: (a.moving_averages.trend_signal as string || "").includes("bullish"), val: (a.moving_averages.trend_signal as string || "").replace(/_/g, " "), tip: a.moving_averages.trend_description as string },
                      { label: "Momentum",     status: a.momentum.level.includes("positive"), val: a.momentum.level.replace(/_/g, " "), tip: "" },
                      { label: "Volume Signal",status: a.volume.divergence?.includes("bullish") ?? false, val: (a.volume.divergence || "N/A").replace(/_/g, " "), tip: a.volume.div_signal },
                      { label: "52W Zone",     status: a.week52.zone === "near_highs", val: (a.week52.zone || "").replace(/_/g, " "), tip: a.week52.description },
                      { label: "Trend (ADX)",  status: a.trend_strength.strength === "strong" || a.trend_strength.strength === "very_strong", val: a.trend_strength.strength.replace(/_/g, " "), tip: a.trend_strength.description },
                    ].map((r, i) => (
                      <div key={r.label} style={{
                        display: "flex", alignItems: "center",
                        padding: "0.75rem 1.4rem",
                        borderBottom: i < 6 ? "1px solid #f8fafc" : "none",
                        background: "#fff",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: r.status ? "#ecfdf5" : "#fef2f2",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", marginRight: 12, flexShrink: 0,
                        }}>{r.status ? "✅" : "❌"}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                            {r.label}
                          </span>
                          {r.tip && <p style={{ fontSize: "0.65rem", color: "#94a3b8",
                            margin: "2px 0 0", lineHeight: 1.4 }}>{r.tip}</p>}
                        </div>
                        <span style={{
                          fontFamily: "JetBrains Mono,monospace",
                          fontSize: "0.7rem", fontWeight: 700,
                          color: r.status ? "#059669" : "#dc2626",
                          textTransform: "capitalize",
                          background: r.status ? "#ecfdf5" : "#fef2f2",
                          padding: "2px 8px", borderRadius: 6,
                        }}>{r.val}</span>
                      </div>
                    ))}
                    {/* Summary bar */}
                    <div style={{ padding: "0.85rem 1.4rem", background: "#f8fafc",
                      borderTop: "1px solid #f1f5f9", display: "flex",
                      justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        {[
                          a.rsi.zone === "bullish" || a.rsi.zone === "oversold",
                          a.macd.crossover.includes("bullish"),
                          (a.moving_averages.trend_signal as string || "").includes("bullish"),
                          a.momentum.level.includes("positive"),
                          a.volume.divergence?.includes("bullish") ?? false,
                          a.week52.zone === "near_highs",
                          a.trend_strength.strength === "strong",
                        ].filter(Boolean).length} of 7 signals are bullish
                      </span>
                      <GaugeBar
                        value={[
                          a.rsi.zone === "bullish" || a.rsi.zone === "oversold",
                          a.macd.crossover.includes("bullish"),
                          (a.moving_averages.trend_signal as string || "").includes("bullish"),
                          a.momentum.level.includes("positive"),
                          a.volume.divergence?.includes("bullish") ?? false,
                          a.week52.zone === "near_highs",
                          a.trend_strength.strength === "strong",
                        ].filter(Boolean).length}
                        max={7}
                        color="#059669"/>
                    </div>
                  </div>

                  {/* Volume chart */}
                  {a.volume.available && chartData.length > 5 && (
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 14, padding: "1.25rem 1.4rem",
                      boxShadow: "0 1px 3px rgba(10,22,40,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: "0.85rem" }}>
                        <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0a1628", margin: 0 }}>
                          Volume History
                        </h3>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700,
                          color: zoneColor(a.volume.divergence || "neutral"),
                          background: zoneBg(a.volume.divergence || "neutral"),
                          padding: "2px 8px", borderRadius: 20,
                        }}>{(a.volume.divergence || "").replace(/_/g, " ")}</span>
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#64748b",
                        lineHeight: 1.65, marginBottom: 12 }}>{a.volume.div_signal}</p>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={chartData.slice(-25)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                          <XAxis dataKey="d" tick={{ fontSize: 8, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={4}/>
                          <YAxis tick={{ fontSize: 8, fill: "#94a3b8", fontFamily: "JetBrains Mono" }}
                            axisLine={false} tickLine={false}
                            tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}/>
                          <Tooltip
                            contentStyle={{ background: "#0a1628", border: "none", borderRadius: 8 }}
                            labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}
                            itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 12 }}
                            formatter={(v: unknown) => [Number(v).toLocaleString(), "Volume"]}
                          />
                          <Bar dataKey="vol" fill="#0fd4b4" fillOpacity={0.7} radius={[3,3,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ FULL REPORT ═══ */}
              {section === "report" && (
                <ReportCard data={data} a={a}/>
              )}

              {/* ═══ GLOSSARY ═══ */}
              {section === "glossary" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ background: "#0a1628", borderRadius: 14,
                    padding: "1.25rem 1.5rem" }}>
                    <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "1.2rem", fontWeight: 800, color: "#f0f6ff",
                      margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                      Learn investing terminology
                    </h2>
                    <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)",
                      lineHeight: 1.7, margin: 0 }}>
                      Every term used in this analysis explained in plain English.
                      No jargon, no assumptions — perfect for first-time investors.
                    </p>
                  </div>
                  <GlossarySection/>
                </div>
              )}

            </div>

            {/* Disclaimer */}
            <p style={{ textAlign: "center", fontSize: "0.62rem", color: "#cbd5e1",
              padding: "1rem 1.5rem 2rem", lineHeight: 1.8 }}>
              Educational platform only · Technical analysis based on price history ·
              Not financial advice · Always do your own research before investing
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}