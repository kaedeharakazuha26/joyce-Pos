import { useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { api } from "../api";
import { errText } from "../utils";

export default function PinLock({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (p = pin) => {
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
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    const handleKey = (e) => {
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
  }, [pin, loading]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  const dotCount = Math.max(6, pin.length);

  return (
    <div className="pin-lock-overlay">
      <div className="pin-lock-card">
        <div className="brand" style={{ justifyContent: "center", paddingBottom: 6 }}>
          <img src="/logo.png" alt="JOYCE POS" style={{ width: 48, height: 48 }} />
          <div>
            <b>JOYCE POS</b>
            <small>Terminal Locked</small>
          </div>
        </div>

        <p className="muted" style={{ textAlign: "center", marginBottom: 18, fontSize: 13 }}>
          Enter your 4 to 8 digit PIN to unlock
        </p>

        {/* PIN indicator dots */}
        <div className={"pin-dots" + (err ? " shake" : "")}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <span key={i} className={"pin-dot" + (pin.length > i ? " filled" : "")} />
          ))}
        </div>

        {err && <div className="pin-error">{err}</div>}

        {/* Numeric Keypad */}
        <div className="pin-keypad">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              className={"pin-key" + (d === "C" || d === "⌫" ? " fn" : "")}
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

        <button
          type="button"
          className="btn"
          style={{ width: "100%", marginTop: 16 }}
          onClick={() => submit(pin)}
          disabled={pin.length < 4 || loading}
        >
          <Lock size={16} /> {loading ? "Verifying…" : "Unlock Terminal"}
        </button>
      </div>
    </div>
  );
}
