"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api";

const features = [
  {
    n: "01",
    t: "Live PSX Data",
    d: "Real-time prices, LDCP, volume for 500+ listed companies on the Pakistan Stock Exchange.",
  },
  {
    n: "02",
    t: "AI Research Assistant",
    d: "Ask any question about any PSX stock. Get data-backed answers in plain, simple English.",
  },
  {
    n: "03",
    t: "Smart Stock Insights",
    d: "Price charts, key metrics with plain-language explainers built for first-time investors.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await apiPost("/auth/register", { email, password });
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f9fafb",
    border: "1.5px solid #e4e9f0",
    borderRadius: 8,
    color: "#0b1120",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: "0.85rem",
    padding: "0.72rem 0.9rem 0.72rem 2.6rem",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    WebkitAppearance: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.67rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#374357",
    marginBottom: "0.4rem",
  };

  const iconStyle: React.CSSProperties = {
    position: "absolute",
    left: 13,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#8d9ab0",
    fontSize: "0.8rem",
    pointerEvents: "none",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#f5f7fa",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* TOP NAV */}
      <header style={{
        height: 52,
        background: "#ffffff",
        borderBottom: "1px solid #e4e9f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.5rem",
        boxShadow: "0 1px 3px rgba(11,17,32,0.06)",
        flexShrink: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30,
            background: "#0f2b5b",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}>
              <polyline points="1,13 5,7 9,10 15,3" stroke="#0fd4b4" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="15" cy="3" r="1.5" fill="#00c896"/>
            </svg>
          </div>
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f2b5b", letterSpacing: "-0.03em" }}>
            PSX<span style={{ color: "#0fd4b4" }}>.</span>Analysis
          </span>
        </div>
        <Link href="/login" style={{
          fontSize: "0.78rem", fontWeight: 500,
          color: "#5a6a82", textDecoration: "none",
        }}>
          Already have an account? Sign in →
        </Link>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <div style={{
          flex: 1,
          background: "#0f2b5b",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "3rem 3.5rem",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          {[
            { w: 480, h: 480, top: -200, right: -150, bottom: "auto", left: "auto" },
            { w: 280, h: 280, top: -60, right: 30, bottom: "auto", left: "auto" },
            { w: 360, h: 360, top: "auto", right: "auto", bottom: -180, left: -120 },
          ].map((c, i) => (
            <div key={i} style={{
              position: "absolute",
              borderRadius: "50%",
              border: "1px solid rgba(15,212,180,0.07)",
              width: c.w, height: c.h,
              top: c.top === "auto" ? undefined : c.top,
              right: c.right === "auto" ? undefined : c.right,
              bottom: c.bottom === "auto" ? undefined : c.bottom as number,
              left: c.left === "auto" ? undefined : c.left as number,
              pointerEvents: "none",
            }}/>
          ))}

          {mounted && (
            <>
              <div style={{ position: "relative", zIndex: 2 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(15,212,180,0.12)",
                  border: "1px solid rgba(15,212,180,0.25)",
                  borderRadius: 20, padding: "5px 14px",
                  fontSize: "0.65rem", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase" as const,
                  color: "#0fd4b4", marginBottom: "2rem",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0fd4b4", display: "inline-block" }}/>
                  Free to get started
                </div>

                <h1 style={{
                  fontSize: "clamp(1.7rem, 2.8vw, 2.6rem)",
                  fontWeight: 800, lineHeight: 1.1,
                  color: "#ffffff", letterSpacing: "-0.04em",
                  marginBottom: "1.1rem",
                }}>
                  Everything you need<br/>
                  to invest <span style={{ color: "#0fd4b4" }}>smarter.</span>
                </h1>

                <p style={{
                  fontSize: "0.82rem", fontWeight: 300,
                  lineHeight: 1.85, color: "rgba(255,255,255,0.4)",
                  maxWidth: 360, marginBottom: "2.5rem",
                }}>
                  Join Pakistani investors using AI-powered research to make
                  better decisions on the PSX.
                </p>
              </div>

              {/* Features */}
              <div style={{
                display: "flex", flexDirection: "column", gap: "1rem",
                position: "relative", zIndex: 2,
              }}>
                {features.map(f => (
                  <div key={f.n} style={{
                    display: "flex", gap: "1rem", alignItems: "flex-start",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12, padding: "1rem 1.1rem",
                  }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem", fontWeight: 500,
                      color: "#0fd4b4", minWidth: 22, marginTop: 2,
                    }}>{f.n}</div>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ffffff", marginBottom: 3 }}>{f.t}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{f.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{
          width: 460,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "2.5rem",
          overflowY: "auto",
          boxShadow: "-8px 0 40px rgba(11,17,32,0.1)",
          position: "relative",
          flexShrink: 0,
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, #0fd4b4, transparent)",
          }}/>

          {mounted && (
            <>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#e6faf7",
                borderRadius: 20, padding: "4px 12px",
                fontSize: "0.62rem", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                color: "#0aaa8f", marginBottom: "1rem", width: "fit-content",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0fd4b4", display: "inline-block" }}/>
                Free Account
              </div>

              <h2 style={{
                fontSize: "1.65rem", fontWeight: 800, color: "#0f2b5b",
                letterSpacing: "-0.04em", marginBottom: "0.3rem", lineHeight: 1.1,
              }}>
                Create your account
              </h2>
              <p style={{
                fontSize: "0.78rem", fontWeight: 300,
                color: "#5a6a82", marginBottom: "1.75rem", lineHeight: 1.6,
              }}>
                Start your investment intelligence journey today.
              </p>

              <form onSubmit={handleSubmit}>

                {/* Email */}
                <div style={{ marginBottom: "0.9rem" }}>
                  <label style={labelStyle}>Email Address</label>
                  <div style={{ position: "relative" }}>
                    <span style={iconStyle}>✉</span>
                    <input
                      style={inputStyle}
                      type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      required autoComplete="email"
                      onFocus={e => { e.target.style.borderColor = "#0fd4b4"; e.target.style.boxShadow = "0 0 0 3px rgba(15,212,180,0.12)"; e.target.style.background = "#ffffff"; }}
                      onBlur={e => { e.target.style.borderColor = "#e4e9f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f9fafb"; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: "0.9rem" }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={iconStyle}>🔒</span>
                    <input
                      style={inputStyle}
                      type="password" placeholder="Min. 8 characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      required
                      onFocus={e => { e.target.style.borderColor = "#0fd4b4"; e.target.style.boxShadow = "0 0 0 3px rgba(15,212,180,0.12)"; e.target.style.background = "#ffffff"; }}
                      onBlur={e => { e.target.style.borderColor = "#e4e9f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f9fafb"; }}
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div style={{ marginBottom: "1.1rem" }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={iconStyle}>🔒</span>
                    <input
                      style={inputStyle}
                      type="password" placeholder="Repeat your password"
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      required
                      onFocus={e => { e.target.style.borderColor = "#0fd4b4"; e.target.style.boxShadow = "0 0 0 3px rgba(15,212,180,0.12)"; e.target.style.background = "#ffffff"; }}
                      onBlur={e => { e.target.style.borderColor = "#e4e9f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f9fafb"; }}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    background: "#fff0f2",
                    border: "1.5px solid rgba(240,56,74,0.2)",
                    borderRadius: 8, padding: "0.7rem 0.9rem",
                    marginBottom: "1rem",
                  }}>
                    <div style={{
                      width: 17, height: 17, borderRadius: "50%",
                      background: "#f0384a", color: "white",
                      fontSize: "0.6rem", fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>!</div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#f0384a", lineHeight: 1.5 }}>{error}</div>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  style={{
                    width: "100%",
                    background: loading ? "#e4e9f0" : "#0f2b5b",
                    color: loading ? "#8d9ab0" : "#ffffff",
                    border: "none", borderRadius: 8,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "0.85rem", fontWeight: 600,
                    padding: "0.82rem 1rem",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 4px 14px rgba(11,17,32,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.15s", marginBottom: "1rem",
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#1a3a6e"; }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#0f2b5b"; }}
                >
                  {loading ? "Creating Account..." : <><span>Create Account</span><span>→</span></>}
                </button>
              </form>

              {/* Sign in link */}
              <div style={{ textAlign: "center", fontSize: "0.78rem", color: "#5a6a82", marginTop: "0.5rem" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#0aaa8f", fontWeight: 600, textDecoration: "none" }}>
                  Sign in
                </Link>
              </div>

              {/* Trust badges */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "1.25rem", marginTop: "1.5rem", paddingTop: "1.25rem",
                borderTop: "1px solid #e4e9f0",
              }}>
                {[["🔒","SSL Secured"],["🛡","JWT Auth"],["✓","HTTPS Only"]].map(([ic, lb]) => (
                  <div key={lb} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: "0.62rem", fontWeight: 600, color: "#8d9ab0",
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 4,
                      background: "#f1f4f8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.55rem",
                    }}>{ic}</div>
                    {lb}
                  </div>
                ))}
              </div>

              <p style={{
                marginTop: "0.9rem", fontSize: "0.6rem",
                color: "#8d9ab0", textAlign: "center", lineHeight: 1.7,
              }}>
                Educational platform only · Not financial advice · Always do your own research
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}