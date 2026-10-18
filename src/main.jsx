import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Disable right-click context menu to prevent showing Inspect Element in production POS
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Prevent keyboard shortcuts that trigger Developer Tools (F12, Ctrl+Shift+I, etc.)
document.addEventListener("keydown", (e) => {
  if (
    e.key === "F12" ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(e.key)) ||
    ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U"))
  ) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
