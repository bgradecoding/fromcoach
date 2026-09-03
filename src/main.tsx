import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";
import { initWebMCP } from "./webmcp/adapter";
import { initPhaseTools } from "./webmcp/phaseTools";

initWebMCP();
initPhaseTools();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
