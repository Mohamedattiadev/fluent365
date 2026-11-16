import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.gen.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Focus rings: always for keyboard users; hidden on auto-focused buttons after touch or mouse use.
const root = document.documentElement;
root.dataset.input = "pointer";
window.addEventListener("keydown", (e) => { if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) root.dataset.input = "keyboard"; }, true);
window.addEventListener("pointerdown", () => { root.dataset.input = "pointer"; }, true);

// Offline support (production only; relative path keeps it inside this app's sub-path).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
