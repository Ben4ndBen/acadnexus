"use client";

import { useActionState, useEffect, useState } from "react";
import { registerAction } from "@/app/actions/auth";
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, Award, CheckCircle, GraduationCap } from "lucide-react";
import Link from "next/link";

interface Department {
  department_id: number;
  department_name: string;
}

interface Program {
  program_id: number;
  program_code: string;
  program_name: string;
}

export function RegisterForm({ 
  departments, 
  programs = [] 
}: { 
  departments: Department[]; 
  programs?: Program[];
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"Faculty" | "Student">("Faculty");
  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      if (state.username) {
        setSuccessMsg(`Account successfully registered! Your generated username is: ${state.username}. Please log in and complete your account configuration.`);
      } else {
        setSuccessMsg("Account successfully registered! Please log in to your dashboard.");
      }
    }
  }, [state]);

  if (successMsg) {
    return (
      <div className="space-y-6 text-center py-6">
        <div className="flex justify-center">
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full border border-emerald-100 animate-bounce">
            <CheckCircle className="w-12 h-12" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-neutral-900">Registration Complete</h3>
        <p className="text-sm text-neutral-600 leading-relaxed max-w-sm mx-auto">
          {successMsg}
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl px-8 py-3.5 text-sm shadow-md transition-all duration-300 hover:scale-105"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-lg text-sm animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="font-semibold">{state.error}</p>
        </div>
      )}

      {/* Role Toggle Selector */}
      <div>
        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
          Registration Role
        </label>
        <div className="grid grid-cols-2 gap-2 bg-stone-50/80 p-1 rounded-xl border border-stone-200/50">
          <button
            type="button"
            onClick={() => setRole("Faculty")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-extrabold transition-all duration-300 ${
              role === "Faculty"
                ? "bg-[#7A151A] text-white shadow-sm"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Faculty Onboarding
          </button>
          <button
            type="button"
            onClick={() => setRole("Student")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-extrabold transition-all duration-300 ${
              role === "Student"
                ? "bg-[#7A151A] text-white shadow-sm"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            <User className="w-4 h-4" />
            Student Account
          </button>
        </div>
        <input type="hidden" name="role" value={role} />
      </div>

      {/* Name Input Fields (First Name, Middle Name, Last Name) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            placeholder="e.g. Michael"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="middleName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Middle Name
          </label>
          <input
            id="middleName"
            name="middleName"
            type="text"
            placeholder="e.g. Agustin (Optional)"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            placeholder="e.g. Castro"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Conditional Department Selection */}
      {role === "Faculty" && (
        <div>
          <label htmlFor="departmentId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Academic Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            required
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
            defaultValue=""
          >
            <option value="" disabled>Select Department</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Conditional Student Selections */}
      {role === "Student" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="programId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Academic Program
            </label>
            <select
              id="programId"
              name="programId"
              required
              className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
              disabled={isPending}
              defaultValue=""
            >
              <option value="" disabled>Select Program</option>
              {programs.map((prog) => (
                <option key={prog.program_id} value={prog.program_id}>
                  {prog.program_code} - {prog.program_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="yearLevel" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Year Level
            </label>
            <select
              id="yearLevel"
              name="yearLevel"
              required
              className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
              disabled={isPending}
              defaultValue="1"
            >
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <div>
            <label htmlFor="section" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Section
            </label>
            <input
              id="section"
              name="section"
              type="text"
              required
              placeholder="e.g. A"
              className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
              disabled={isPending}
              defaultValue="A"
            />
          </div>
        </div>
      )}

      {/* Institutional ID Field */}
      <div>
        <label htmlFor="institutionalId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
          Institutional ID
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <User className="w-5 h-5" />
          </div>
          <input
            id="institutionalId"
            name="institutionalId"
            type="text"
            required
            placeholder={role === "Faculty" ? "e.g. FACULTY-002" : "e.g. STUDENT-002"}
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
          Initial Secure Password
        </label>
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
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-11 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
            disabled={isPending}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full relative flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl py-3.5 text-sm shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7A151A] focus:ring-offset-2 transition-all duration-300 disabled:opacity-85 disabled:cursor-not-allowed group overflow-hidden"
      >
        <span className="absolute right-0 top-0 w-24 h-full bg-[#FBB017]/10 skew-x-12 translate-x-12 group-hover:translate-x-[-180px] transition-transform duration-1000 ease-out" />
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBB017]" />
            <span>Creating Secure Account...</span>
          </div>
        ) : (
          <span>Register to AcadNexus</span>
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-xs text-stone-500">
          Already have an account?{" "}
          <Link href="/" className="font-bold text-[#7A151A] hover:underline">
            Sign In Here
          </Link>
        </p>
      </div>
    </form>
  );
}
