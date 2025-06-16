"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useTheme as useNextTheme } from "next-themes";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, setTheme: setNextTheme, systemTheme } = useNextTheme();
  
  const isDarkMode = theme === "dark";
  
  const toggleTheme = () => {
    setNextTheme(isDarkMode ? "light" : "dark");
  };
  
  const setTheme = (isDark: boolean) => {
    setNextTheme(isDark ? "dark" : "light");
  };

  return {
    isDarkMode,
    toggleTheme,
    setTheme,
    theme,
    systemTheme,
  };
}