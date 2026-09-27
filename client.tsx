import React from "react";
import { createRoot } from "react-dom/client";
import FlowApp from "./components/flow/app";
import DemoGate from "./components/flow/demo-gate";
import "./app/globals.css";
createRoot(document.getElementById("root")!).render(
  <DemoGate>
    <FlowApp />
  </DemoGate>,
);
