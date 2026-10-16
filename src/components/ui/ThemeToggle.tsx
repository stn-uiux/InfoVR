import { useTheme } from "../../contexts/ThemeContext";
import { Icon } from "@iconify/react";

export const ThemeToggle = () => {
  const { theme, toggleTheme, isThemeTransitioning } = useTheme();

  return (
    <div
      className="theme-toggle"
      onClick={isThemeTransitioning ? undefined : toggleTheme}
      role="button"
      tabIndex={0}
      style={{
        cursor: isThemeTransitioning ? "not-allowed" : "pointer",
        opacity: isThemeTransitioning ? 0.7 : 1,
      }}
      onKeyDown={(e) => e.key === "Enter" && !isThemeTransitioning && toggleTheme()}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div className="theme-toggle-knob">
        {theme === "light" ? (
          <Icon icon="material-symbols:light-mode-rounded" className="icon" width="14" height="14" />
        ) : (
          <Icon icon="material-symbols:dark-mode-rounded" className="icon" width="14" height="14" />
        )}
      </div>
    </div>
  );
};
