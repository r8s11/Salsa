import ReactDOM from "react-dom/client";
import App from "./App";
import { Providers } from "./app/providers";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <Providers>
    <App />
  </Providers>
);
