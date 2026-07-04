"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, null);

  useEffect(() => {
    if (state?.success && state?.role) {
      let path = "/";
      if (state.role === "Student") path = "/dashboard/student";
      else if (state.role === "Faculty") path = "/dashboard/faculty";
      else if (state.role === "Chair") path = "/dashboard/chair";
      else if (state.role === "Director") path = "/dashboard/director";
      
      window.location.href = path;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-lg text-sm animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="font-semibold">{state.error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="institutionalId"
          className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2"
        >
          Institutional ID
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 focus-within:text-[#7A151A]">
            <User className="w-5 h-5" />
          </div>
          <input
            id="institutionalId"
            name="institutionalId"
            type="text"
            required
            placeholder="e.g. STUDENT-001 or FACULTY-001"
            className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-4 py-3.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label
            htmlFor="password"
            className="block text-xs font-bold text-stone-600 uppercase tracking-wider"
          >
            Password
          </label>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-11 py-3.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors"
            disabled={isPending}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full relative flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl py-3.5 text-sm shadow-md shadow-[#7A151A]/10 hover:shadow-lg hover:shadow-[#7A151A]/20 focus:outline-none focus:ring-2 focus:ring-[#7A151A] focus:ring-offset-2 transition-all duration-300 disabled:opacity-85 disabled:cursor-not-allowed group overflow-hidden"
      >
        <span className="absolute right-0 top-0 w-24 h-full bg-[#FBB017]/10 skew-x-12 translate-x-12 group-hover:translate-x-[-180px] transition-transform duration-1000 ease-out" />
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBB017]" />
            <span>Verifying Credentials...</span>
          </div>
        ) : (
          <span>Sign In to AcadNexus</span>
        )}
      </button>

      <div className="text-center mt-4 border-t border-stone-100 pt-4">
        <p className="text-xs text-stone-500">
          New institutional user?{" "}
          <a href="/register" className="font-bold text-[#7A151A] hover:underline">
            Register Account Here
          </a>
        </p>
      </div>
    </form>
  );
}
