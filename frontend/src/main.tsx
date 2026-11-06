import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./components/ui/kit";
import { ApiError, tokenStore } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

// Visitors on the public site: start downloading the website and its 3D scene right away,
// in parallel, instead of one after another as each lazy import is reached.
if (window.location.pathname === "/" && !tokenStore.get()) {
  void import("./pages/Landing");
  void import("./components/three/LandingScene");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
