import React from "react";
import { createRoot } from "react-dom/client";
import FlowApp from "./components/flow/app";
import "./app/globals.css";
createRoot(document.getElementById("root")!).render(<FlowApp />);
