import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { ThemeColorProvider } from "./context/ThemeColorContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ToastProvider } from "./context/ToastContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemeColorProvider>
        <Router>
          <AuthProvider>
            <ToastProvider>
              <AppWrapper>
                <App />
              </AppWrapper>
            </ToastProvider>
          </AuthProvider>
        </Router>
      </ThemeColorProvider>
    </ThemeProvider>
  </StrictMode>,
);
