import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Icon, addCollection } from "@iconify/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./css/theme.css";
import "./css/base.css";
import "./css/layout.css";
import "./css/components.css";
import "./css/features.css";
import "./css/auth.css";

import App from "./App.tsx";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import iconsBundle from "./assets/icons-bundle.json";

// Register all offline icons before rendering
iconsBundle.forEach((collection: any) => {
  addCollection(collection);
});

const PortWizardApp = lazy(() => import("./port-wizard/App.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Dashboard Route */}
          <Route path="/dashboard" element={<App />} />
          
          {/* Existing Routes */}
          <Route path="/arcVRoom" element={<App />} />
          <Route path="/arcVRoom/" element={<App />} />
          <Route
            path="/port-wizard"
            element={
              <Suspense fallback={<div style={{background:'#0a0a0a',color:'#fff',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading 포트맵핑 마법사 <Icon icon="mdi:magic" style={{ marginLeft: '6px' }} />...</div>}>
                <PortWizardApp />
              </Suspense>
            }
          />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
