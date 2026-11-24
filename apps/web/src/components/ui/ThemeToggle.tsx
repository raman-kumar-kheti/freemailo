"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "./mail-ui";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved =
      localStorage.getItem("freemailo-theme") ||
      localStorage.getItem("mailhive-theme");
    const next = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }, []);
  return (
    <IconButton
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        document.documentElement.classList.toggle("dark", !dark);
        localStorage.setItem("freemailo-theme", dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </IconButton>
  );
}
