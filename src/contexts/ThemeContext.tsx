import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useStore } from "../store/useStore";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isThemeTransitioning: boolean;
  themeTransitionTarget: Theme | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Dark mode first - default to dark
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("comm-theme");
    return (saved as Theme) || "dark";
  });
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [themeTransitionTarget, setThemeTransitionTarget] = useState<Theme | null>(null);

  useEffect(() => {
    localStorage.setItem("comm-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    useStore.getState().setCyberSpaceTheme(theme === "light");
  }, [theme]);

  const toggleTheme = () => {
    if (isThemeTransitioning) return;
    const targetTheme: Theme = theme === "light" ? "dark" : "light";
    setIsThemeTransitioning(true);
    setThemeTransitionTarget(targetTheme);

    // Give browser a frame to paint the dimmed overlay before heavy 3D material updates
    setTimeout(() => {
      setThemeState(targetTheme);
      setTimeout(() => {
        setIsThemeTransitioning(false);
        setThemeTransitionTarget(null);
      }, 500);
    }, 60);
  };

  const setTheme = (newTheme: Theme) => {
    if (newTheme === theme || isThemeTransitioning) return;
    setIsThemeTransitioning(true);
    setThemeTransitionTarget(newTheme);

    setTimeout(() => {
      setThemeState(newTheme);
      setTimeout(() => {
        setIsThemeTransitioning(false);
        setThemeTransitionTarget(null);
      }, 500);
    }, 60);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isThemeTransitioning,
        themeTransitionTarget,
      }}
    >
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
