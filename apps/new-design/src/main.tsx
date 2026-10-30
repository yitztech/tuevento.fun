import "@fontsource-variable/manrope";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource/great-vibes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "@/styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Falta #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
