import { Mail, Lock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link"; // 1. Import Link from next/link

export function LoginForm() {
  return (
    <form className="space-y-4">
      {/* Email/ID Input */}
      <div className="relative">
        <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
        <input
          type="email"
          placeholder="Institutional ID / Email"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-[#7A151A] outline-none transition-all"
        />
      </div>

      {/* Password Input */}
      <div className="relative">
        <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
        <input
          type="password"
          placeholder="Security Password"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-[#7A151A] outline-none transition-all"
        />
      </div>

      {/* Primary Login Button */}
      <button className="w-full bg-[#7A151A] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#5F0F13] transition-colors shadow-md hover:shadow-lg">
        <LogIn className="w-4 h-4" />
        Sign In
      </button>

      {/* New Student Access Link */}
      <div className="pt-2 text-center">
        <p className="text-xs text-neutral-500 mb-2">Are you new here?</p>

        {/* 2. Wrap the button content in a Link component */}
        <Link
          href="/signup"
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-[#7A151A] border border-[#7A151A]/20 rounded-xl hover:bg-[#7A151A]/5 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Sign-Up
        </Link>
      </div>
    </form>
  );
}