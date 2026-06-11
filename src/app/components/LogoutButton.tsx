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
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-700 hover:text-[#7A151A] bg-stone-100 hover:bg-amber-50 rounded-xl transition-all duration-200 border border-stone-200 hover:border-amber-200 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-[#7A151A]" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      <span>{isPending ? "Signing Out..." : "Sign Out"}</span>
    </button>
  );
}
