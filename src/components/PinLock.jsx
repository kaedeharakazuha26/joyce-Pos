import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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

// ── High-Performance Ambient & Particle Background (Memoized) ──
// Isolated completely from PIN typing and input mode state updates to prevent re-renders
const LoginBackground = memo(function LoginBackground({ isDark }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize, { passive: true });

    // Streamlined particle count for 0% CPU consumption
    const count = Math.min(20, Math.max(10, Math.floor(width / 75)));
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      size: Math.random() * 2 + 1,
    }));

    let lastTime = 0;
    // Cap to ~35fps for ambient background to keep CPU usage virtually 0%
    const frameInterval = 1000 / 35;

    const render = (time) => {
      animId = requestAnimationFrame(render);

      const delta = time - lastTime;
      if (delta < frameInterval) return;
      lastTime = time - (delta % frameInterval);

      ctx.clearRect(0, 0, width, height);

      // 1. Batch draw all particles in a single path
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fillStyle = isDark ? "rgba(212, 175, 55, 0.45)" : "rgba(184, 138, 40, 0.4)";
      ctx.fill();

      // 2. Batch draw connections in a single path (max 20 lines)
      ctx.beginPath();
      let linesDrawn = 0;
      for (let i = 0; i < particles.length && linesDrawn < 20; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          if (Math.abs(dx) < 85 && Math.abs(dy) < 85) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 85) {
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              linesDrawn++;
              if (linesDrawn >= 20) break;
            }
          }
        }
      }
      ctx.strokeStyle = isDark ? "rgba(212, 175, 55, 0.12)" : "rgba(184, 138, 40, 0.1)";
      ctx.lineWidth = 0.75;
      ctx.stroke();
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDark]);

  return (
    <>
      <canvas ref={canvasRef} className="login-particle-canvas" />
      <div className="login-ambient-elements" aria-hidden="true">
        <div className="moving-gold-orb orb-primary" />
        <div className="moving-gold-orb orb-secondary" />
        <div className="moving-gold-orb orb-tertiary" />
        <div className="moving-orbital-ring ring-outer" />
        <div className="moving-orbital-ring ring-inner" />
      </div>
    </>
  );
});

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

  // Synchronized refs to avoid re-binding keydown event listeners on every keystroke
  const pinRef = useRef(pin);
  pinRef.current = pin;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const inputModeRef = useRef(inputMode);
  inputModeRef.current = inputMode;

  // Active theme calculation
  const currentTheme =
    document.documentElement.dataset.theme ||
    localStorage.getItem("joyce-theme") ||
    settings?.theme ||
    "dark";
  const isDark = currentTheme === "dark";

  // Stable authentication submission
  const submit = useCallback(
    async (overridePin) => {
      const p = overridePin !== undefined ? overridePin : pinRef.current;
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
        if (inputModeRef.current === "direct" && directInputRef.current) {
          directInputRef.current.focus();
        }
      } finally {
        setLoading(false);
      }
    },
    [onUnlock]
  );

  const press = useCallback((digit) => {
    if (loadingRef.current) return;
    setPin((prev) => (prev.length < 10 ? prev + digit : prev));
    setErr("");
  }, []);

  const backspace = useCallback(() => {
    if (loadingRef.current) return;
    setPin((p) => p.slice(0, -1));
    setErr("");
  }, []);

  const clear = useCallback(() => {
    if (loadingRef.current) return;
    setPin("");
    setErr("");
  }, []);

  // Stable Keyboard controls (registered ONCE on mount)
  useEffect(() => {
    const handleKey = (e) => {
      // If typing inside direct input field, let native input handle alphanumeric keys
      if (inputModeRef.current === "direct" && document.activeElement === directInputRef.current) {
        if (e.key === "Enter") {
          e.preventDefault();
          submit(pinRef.current);
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
        submit(pinRef.current);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [submit, press, backspace, clear]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  const dotCount = Math.max(6, pin.length);

  return (
    <div className="login-stage">
      {/* ── Dynamic Moving Objects: Memoized Isolated Background ── */}
      <LoginBackground isDark={isDark} />

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

      {/* ── Main Login Card ── */}
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
              onClick={() => {
                setInputMode("direct");
                setTimeout(() => directInputRef.current?.focus(), 10);
              }}
            >
              <Lock size={14} /> Direct Input
            </button>
          </div>

          {/* Touch Keypad Area (Persistent in DOM for 0ms tab switching) */}
          <div
            className="keypad-input-area"
            style={{ display: inputMode === "keypad" ? "block" : "none" }}
          >
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

          {/* Direct Keyboard Form (Persistent in DOM for 0ms tab switching) */}
          <form
            className="direct-input-area"
            style={{ display: inputMode === "direct" ? "block" : "none" }}
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
