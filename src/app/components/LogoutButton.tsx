"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      const result = await logoutAction();
      if (result.success) {
        window.location.href = "/";
      } else {
        alert("Logout failed: " + (result.error || "Unknown error"));
      }
    });
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-xl transition-all duration-200 border border-slate-200 hover:border-red-100 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      <span>{isPending ? "Signing Out..." : "Sign Out"}</span>
    </button>
  );
}
