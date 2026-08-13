import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useStore } from "../store/useStore";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Dark mode first - default to dark
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("comm-theme");
    return (saved as Theme) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("comm-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    useStore.getState().setCyberSpaceTheme(theme === "light");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
