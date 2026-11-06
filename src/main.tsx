import { DialogProvider } from "./Dialogs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { Settings } from "luxon";
Settings.defaultLocale = "de-DE";
Settings.defaultZone = "Europe/Berlin";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>,
);
