import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CityProvider } from "./contexts/CityContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <CityProvider>
      <App />
    </CityProvider>
  </React.StrictMode>
);
