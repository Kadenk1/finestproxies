"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // next-themes reads localStorage/media-query client-side only — rendering
  // the resolved icon before mount would mismatch server HTML and flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = options.find((o) => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(className)}
            aria-label="Toggle theme"
          />
        }
      >
        {mounted ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
            <option.icon className="h-4 w-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
