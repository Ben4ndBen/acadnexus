"use client";

import { getDepartmentTheme, DepartmentKey } from "@/lib/departmentThemes";
import { Sparkles, Shield, GraduationCap, Award, BookOpen } from "lucide-react";

interface DepartmentBadgeProps {
  department?: string | null;
  programCode?: string | null;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  showThemeLabel?: boolean;
  className?: string;
}

export function DepartmentBadge({
  department,
  programCode,
  size = "md",
  showPulse = false,
  showThemeLabel = false,
  className = "",
}: DepartmentBadgeProps) {
  const theme = getDepartmentTheme(department || programCode);
  const { colors } = theme;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2.5 font-bold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs font-semibold ${colors.badgeBg} ${colors.badgeText} ${colors.badgeBorder} ${sizeClasses[size]} ${className}`}
      title={theme.fullName}
    >
      {showPulse && (
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: colors.primary }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: colors.primary }}
          />
        </span>
      )}
      <span>{theme.shortName} Portal</span>
      {showThemeLabel && (
        <span className="opacity-75 text-[10px] uppercase tracking-wider font-semibold border-l pl-2 border-current">
          {theme.themeLabel}
        </span>
      )}
    </span>
  );
}

export function DepartmentPortalBanner({
  department,
  programCode,
  title,
  subtitle,
}: {
  department?: string | null;
  programCode?: string | null;
  title: string;
  subtitle?: string;
}) {
  const theme = getDepartmentTheme(department || programCode);
  const { colors } = theme;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 mb-6 shadow-md border ${colors.borderAccent} bg-gradient-to-r ${colors.bannerGradient} ${colors.bannerText}`}
    >
      {/* Decorative SVG background shapes */}
      <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 pointer-events-none blur-2xl" />
      <div className="absolute right-32 bottom-0 -mb-16 w-48 h-48 rounded-full bg-black/10 pointer-events-none blur-xl" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <DepartmentBadge department={department} programCode={programCode} size="sm" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm sm:text-base opacity-90 font-medium max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/30 text-xs font-bold shrink-0 self-start sm:self-center shadow-xs">
          <GraduationCap className="w-4 h-4" />
          <span>{theme.fullName}</span>
        </div>
      </div>
    </div>
  );
}
