import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock,
  KeyRound,
  Delete,
  Eye,
  EyeOff,
  ShieldCheck,
  Sun,
  Moon,
  Store,
  Clock,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { api } from "../api";
import { errText } from "../utils";

export default function PinLock({
  onUnlock,
  settings = {},
  activeBranchName = "Main Store",
  shiftStatus = null,
  toggleTheme,
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState("keypad"); // "keypad" | "direct"
  const [showPassword, setShowPassword] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const directInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Read active theme (black-gold or white-gold)
  const currentTheme =
    document.documentElement.dataset.theme ||
    localStorage.getItem("joyce-theme") ||
    settings?.theme ||
    "dark";

  // ── Particle & Moving Objects Animation Canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Golden dust particles
    const particleCount = Math.min(50, Math.floor((width * height) / 22000));
    const isDark = (document.documentElement.dataset.theme || currentTheme) === "dark";

    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      size: Math.random() * 2.8 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      baseAlpha: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
      goldHue: isDark
        ? Math.random() > 0.4
          ? "rgba(212, 175, 55, "
          : "rgba(247, 212, 104, "
        : "rgba(184, 138, 40, ",
    }));

    // Interactive mouse position
    let mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let time = 0;
    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse gentle repulsion
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          p.x -= (dx / dist) * force * 1.5;
          p.y -= (dy / dist) * force * 1.5;
        }

        // Pulse alpha
        const dynamicAlpha = Math.sin(time + p.phase) * 0.2 + p.baseAlpha;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.goldHue}${Math.max(0.1, Math.min(1, dynamicAlpha))})`;
        ctx.fill();

        // Connect nearby particles with subtle golden filaments
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist2 = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist2 < 95) {
            const lineAlpha = (1 - dist2 / 95) * (isDark ? 0.16 : 0.12);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark
              ? `rgba(212, 175, 55, ${lineAlpha})`
              : `rgba(184, 138, 40, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [currentTheme]);

  // ── Authentication Submission ──
  const submit = useCallback(
    async (p = pin) => {
      if (!p || p.length < 4) {
        setErr("PIN must be at least 4 digits");
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const user = await api.verifyPin(p);
        onUnlock(user);
      } catch (e) {
        setErr(errText(e));
        setPin("");
        if (inputMode === "direct" && directInputRef.current) {
          directInputRef.current.focus();
        }
      } finally {
        setLoading(false);
      }
    },
    [pin, inputMode, onUnlock]
  );

  const press = (digit) => {
    if (loading) return;
    if (pin.length < 10) {
      setPin((prev) => prev + digit);
      setErr("");
    }
  };

  const backspace = () => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setErr("");
  };

  const clear = () => {
    if (loading) return;
    setPin("");
    setErr("");
  };

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      // If typing inside direct input field, let native events handle standard text
      if (inputMode === "direct" && document.activeElement === directInputRef.current) {
        if (e.key === "Enter") {
          e.preventDefault();
          submit(pin);
        } else if (e.key === "Escape") {
          clear();
        }
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        press(e.key);
      } else if (e.key === "Backspace") {
        backspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        clear();
      } else if (e.key === "Enter") {
        submit(pin);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pin, loading, inputMode, submit]);

  useEffect(() => {
    if (inputMode === "direct" && directInputRef.current) {
      directInputRef.current.focus();
    }
  }, [inputMode]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  const dotCount = Math.max(6, pin.length);

  return (
    <div className="login-stage">
      {/* ── Dynamic Moving Objects: Interactive Gold Particle Canvas ── */}
      <canvas ref={canvasRef} className="login-particle-canvas" />

      {/* ── Dynamic Moving Objects: Ambient Golden Luxury Orbs & Rings ── */}
      <div className="login-ambient-elements" aria-hidden="true">
        <div className="moving-gold-orb orb-primary" />
        <div className="moving-gold-orb orb-secondary" />
        <div className="moving-gold-orb orb-tertiary" />
        <div className="moving-orbital-ring ring-outer" />
        <div className="moving-orbital-ring ring-inner" />
      </div>

      {/* ── Top Bar Controls: Shift Status & Quick Theme Toggle ── */}
      <header className="login-top-bar">
        <div className="login-status-pill">
          <Store size={14} className="gold-icon" />
          <span>{activeBranchName}</span>
          <span className="pill-divider">•</span>
          <Clock size={13} className="gold-icon" />
          <span className={shiftStatus?.is_open ? "status-open" : "status-closed"}>
            {shiftStatus?.is_open ? `Shift Open (${shiftStatus.shift?.business_date})` : "Shift Closed"}
          </span>
        </div>

        {typeof toggleTheme === "function" && (
          <button
            type="button"
            className="login-theme-toggle"
            onClick={toggleTheme}
            title={
              currentTheme === "dark"
                ? "Switch to White Gold Theme (Light)"
                : "Switch to Black Gold Theme (Dark)"
            }
          >
            {currentTheme === "dark" ? (
              <>
                <Sun size={15} /> <span>White Gold</span>
              </>
            ) : (
              <>
                <Moon size={15} /> <span>Black Gold</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* ── Main Glassmorphic Login Card ── */}
      <main className="login-card-container">
        <div className="login-card">
          {/* Card Header & Brand Emblem */}
          <div className="login-brand-section">
            <div className="brand-logo-wrapper">
              <img
                src="/logo.png"
                alt="JOYCE POS"
                className="brand-logo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="logo-pulse-ring" />
            </div>

            <div className="brand-text-block">
              <h1 className="brand-title">
                {settings?.store_name || "JOYCE POS"}
              </h1>
              <div className="brand-badge">
                <Sparkles size={12} className="gold-icon" />
                <span>ENTERPRISE TERMINAL LOCK</span>
              </div>
            </div>
          </div>

          <p className="login-subtitle">
            Enter your employee or administrator security PIN to unlock this register.
          </p>

          {/* Mode Switcher: Touch Keypad vs Direct Keyboard */}
          <div className="login-mode-tabs">
            <button
              type="button"
              className={`mode-tab ${inputMode === "keypad" ? "active" : ""}`}
              onClick={() => setInputMode("keypad")}
            >
              <KeyRound size={14} /> Touch Keypad
            </button>
            <button
              type="button"
              className={`mode-tab ${inputMode === "direct" ? "active" : ""}`}
              onClick={() => setInputMode("direct")}
            >
              <Lock size={14} /> Direct Input
            </button>
          </div>

          {/* PIN Indicators or Direct Input Field */}
          {inputMode === "keypad" ? (
            <div className="keypad-input-area">
              <div className={"pin-dots-container" + (err ? " shake" : "")}>
                {Array.from({ length: dotCount }).map((_, i) => (
                  <span
                    key={i}
                    className={"pin-bubble" + (pin.length > i ? " filled" : "")}
                  />
                ))}
              </div>

              {err && (
                <div className="login-error-banner" role="alert">
                  {err}
                </div>
              )}

              {/* Touch Keypad Grid */}
              <div className="login-keypad-grid">
                {digits.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={
                      "keypad-key" +
                      (d === "C" || d === "⌫" ? " fn-key" : "") +
                      (d === "0" ? " zero-key" : "")
                    }
                    onClick={() => {
                      if (d === "C") clear();
                      else if (d === "⌫") backspace();
                      else press(d);
                    }}
                    disabled={loading}
                  >
                    {d === "⌫" ? <Delete size={20} /> : d}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form
              className="direct-input-area"
              onSubmit={(e) => {
                e.preventDefault();
                submit(pin);
              }}
            >
              <div className="direct-input-wrapper">
                <Lock size={18} className="input-leading-icon" />
                <input
                  ref={directInputRef}
                  id="direct-pin-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter Security PIN…"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ""));
                    setErr("");
                  }}
                  maxLength={10}
                  disabled={loading}
                  autoComplete="off"
                  className={err ? "input-has-error" : ""}
                />
                <button
                  type="button"
                  className="input-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  title={showPassword ? "Hide PIN" : "Show PIN"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {err && (
                <div className="login-error-banner" role="alert">
                  {err}
                </div>
              )}
            </form>
          )}

          {/* Unlock Submit Button */}
          <button
            type="button"
            className="btn login-submit-btn"
            onClick={() => submit(pin)}
            disabled={pin.length < 4 || loading}
          >
            {loading ? (
              <span className="loading-spinner-wrap">
                <span className="gold-spinner" /> Authenticating…
              </span>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Unlock Terminal</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Quick Support / Role Hint Footer */}
          <div className="login-card-footer">
            <button
              type="button"
              className="hint-toggle-link"
              onClick={() => setShowHint((prev) => !prev)}
            >
              <HelpCircle size={13} />
              <span>{showHint ? "Hide Default Access Info" : "Need Quick Login Info?"}</span>
            </button>

            {showHint && (
              <div className="hint-callout">
                <div className="hint-line">
                  <span className="hint-badge admin">ADMIN</span>
                  <span>Default PIN: <b>0000</b> (Full Access)</span>
                </div>
                <div className="hint-line">
                  <span className="hint-badge staff">STAFF</span>
                  <span>Configure custom Cashier PINs in Settings</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
