import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Icon, addCollection } from "@iconify/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./css/theme.css";
import "./css/base.css";
import "./css/layout.css";
import "./css/components.css";
import "./css/features.css";
import App from "./App.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import iconsBundle from "./assets/icons-bundle.json";

// Register all offline icons before rendering
iconsBundle.forEach((collection: any) => {
  addCollection(collection);
});

const PortSentinelApp = lazy(() => import("./port-sentinel/App.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route
            path="/port-sentinel"
            element={
              <Suspense fallback={<div style={{background:'#0a0a0a',color:'#fff',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading 포트맵핑 마법사 <Icon icon="mdi:magic" style={{ marginLeft: '6px' }} />...</div>}>
                <PortSentinelApp />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
