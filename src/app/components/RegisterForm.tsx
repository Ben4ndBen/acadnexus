"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, GraduationCap, Briefcase, Check, X } from "lucide-react";
import Link from "next/link";

interface Program {
  program_id: number;
  program_code: string;
  program_name: string;
}

interface Department {
  department_id: number;
  department_name: string;
}

interface RegisterFormProps {
  programs: Program[];
  departments: Department[];
}

export function RegisterForm({ programs, departments }: RegisterFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<"Student" | "Faculty">("Student");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Real-time Validation States
  const [institutionalId, setInstitutionalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedProgramCode, setSelectedProgramCode] = useState<string>("");
  
  const [state, formAction, isPending] = useActionState(registerAction, null);

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

  // Sync selected program code to adjust Majors dropdown options dynamically
  useEffect(() => {
    const prog = programs.find(p => String(p.program_id) === selectedProgramId);
    if (prog) {
      setSelectedProgramCode(prog.program_code.toUpperCase());
    } else {
      setSelectedProgramCode("");
    }
  }, [selectedProgramId, programs]);

  // Real-time validations
  const isIdEmpty = institutionalId.trim() === "";
  const isIdValid = role === "Student" 
    ? /^\d{4}-\d{4}-AB$/.test(institutionalId.trim().toUpperCase())
    : /^FACULTY-\d+$/.test(institutionalId.trim().toUpperCase());

  // Password strength checks
  const criteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const strengthScore = Object.values(criteria).filter(Boolean).length;
  const isPasswordEmpty = password === "";

  const getStrengthDetails = () => {
    if (isPasswordEmpty) return { label: "", color: "bg-stone-200", text: "text-stone-400", width: "w-0" };
    if (strengthScore <= 2) return { label: "Weak Password", color: "bg-rose-500", text: "text-rose-600", width: "w-1/3" };
    if (strengthScore <= 4) return { label: "Medium Password", color: "bg-amber-500", text: "text-amber-600", width: "w-2/3" };
    return { label: "Strong Password", color: "bg-emerald-500", text: "text-emerald-600", width: "w-full" };
  };

  const strength = getStrengthDetails();

  // Confirm password check
  const isConfirmEmpty = confirmPassword === "";
  const passwordsMatch = password === confirmPassword;

  // Determine major list based on program
  const getMajorOptions = () => {
    if (selectedProgramCode === "BSIT_IND" || selectedProgramCode.includes("INDUSTRIAL") || selectedProgramCode.includes("BSIT-") || selectedProgramCode === "BSINDTECH") {
      // Industrial Technology Majors
      return [
        { value: "Architecture Technology", label: "Architecture Technology" },
        { value: "Automotive Technology", label: "Automotive Technology" },
        { value: "Electronics Technology", label: "Electronics Technology" }
      ];
    }
    if (selectedProgramCode === "BSED" || selectedProgramCode.includes("SECONDARY") || selectedProgramCode.includes("BSE-")) {
      // Secondary Education Majors
      return [
        { value: "Science", label: "Science" },
        { value: "English", label: "English" },
        { value: "Mathematics", label: "Mathematics" }
      ];
    }
    // Default / General option for other programs
    return [
      { value: "General", label: "General Major" }
    ];
  };

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="font-semibold">{state.error}</p>
        </div>
      )}

      {/* Role Picker (Interactive Toggle Cards) */}
      <div>
        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
          Choose Account Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setRole("Student")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center cursor-pointer transition-all duration-300 ${
              role === "Student"
                ? "border-[#7A151A] bg-[#7A151A]/5 text-[#7A151A] ring-2 ring-[#7A151A]/20 font-bold scale-[1.02]"
                : "border-stone-200 hover:border-stone-300 bg-white text-stone-500 font-medium hover:bg-stone-50/50"
            }`}
          >
            <input type="hidden" name="role" value={role} />
            <GraduationCap className={`w-6 h-6 mb-1.5 transition-transform duration-300 ${role === "Student" ? "scale-110" : ""}`} />
            <span className="text-xs">Student Registration</span>
          </button>

          <button
            type="button"
            onClick={() => setRole("Faculty")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center cursor-pointer transition-all duration-300 ${
              role === "Faculty"
                ? "border-[#7A151A] bg-[#7A151A]/5 text-[#7A151A] ring-2 ring-[#7A151A]/20 font-bold scale-[1.02]"
                : "border-stone-200 hover:border-stone-300 bg-white text-stone-500 font-medium hover:bg-stone-50/50"
            }`}
          >
            <Briefcase className={`w-6 h-6 mb-1.5 transition-transform duration-300 ${role === "Faculty" ? "scale-110" : ""}`} />
            <span className="text-xs">Faculty Registration</span>
          </button>
        </div>
      </div>

      {/* Identity Names (First Name & Last Name) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            placeholder="e.g. Janice"
            className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            placeholder="e.g. Delfin"
            className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Institutional ID Field */}
      <div>
        <label htmlFor="institutionalId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
          Institutional ID ({role === "Student" ? "YYYY-NNNN-AB format (e.g. 2023-0001-AB)" : "FACULTY- followed by digits"})
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
            value={institutionalId}
            onChange={(e) => setInstitutionalId(e.target.value)}
            placeholder={role === "Student" ? "2023-0001-AB" : "FACULTY-002"}
            className={`w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border rounded-xl pl-11 pr-10 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 ${
              isIdEmpty 
                ? "border-stone-200/80" 
                : isIdValid 
                  ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20" 
                  : "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
            }`}
            disabled={isPending}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {!isIdEmpty && (
              isIdValid 
                ? <Check className="w-5 h-5 text-emerald-500 animate-in fade-in zoom-in duration-300" />
                : <X className="w-5 h-5 text-rose-500 animate-in fade-in zoom-in duration-300" />
            )}
          </div>
        </div>
        {!isIdEmpty && !isIdValid && (
          <p className="text-[11px] text-rose-600 mt-1 font-semibold animate-in fade-in duration-300">
            Must match pattern: {role === "Student" ? "YYYY-NNNN-AB (e.g. 2023-0001-AB)" : "FACULTY- followed by digits (e.g. FACULTY-002)"}.
          </p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
          Password
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-11 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors cursor-pointer"
            disabled={isPending}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Real-time Password Strength Meter */}
        {!isPasswordEmpty && (
          <div className="mt-2.5 space-y-2 bg-stone-50/50 border border-stone-100 rounded-xl p-3 animate-in fade-in duration-300">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-stone-500">Security Strength:</span>
              <span className={`font-bold ${strength.text}`}>{strength.label}</span>
            </div>
            
            {/* Progress indicator */}
            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ease-out ${strength.color} ${strength.width}`} />
            </div>

            {/* Checklist criteria */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.length ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.length ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.length ? "text-emerald-700 font-medium" : "text-stone-400"}>8+ Characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.upper ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.upper ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.upper ? "text-emerald-700 font-medium" : "text-stone-400"}>Uppercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.lower ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.lower ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.lower ? "text-emerald-700 font-medium" : "text-stone-400"}>Lowercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.number ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.number ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.number ? "text-emerald-700 font-medium" : "text-stone-400"}>Number (0-9)</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.special ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.special ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.special ? "text-emerald-700 font-medium" : "text-stone-400"}>Special Character (!@#$, etc.)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password Field */}
      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border rounded-xl pl-11 pr-11 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 ${
              isConfirmEmpty 
                ? "border-stone-200/80" 
                : passwordsMatch 
                  ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20" 
                  : "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
            }`}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors cursor-pointer"
            disabled={isPending}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {!isConfirmEmpty && (
          <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold animate-in fade-in duration-300">
            {passwordsMatch ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Passwords match
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Passwords do not match
              </span>
            )}
          </div>
        )}
      </div>

      {/* Role-based Onboarding Fields (Smoothly toggles with animations) */}
      <div className="overflow-hidden transition-all duration-500 ease-in-out">
        {role === "Student" ? (
          <div className="space-y-4 border-t border-stone-100 pt-4 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-bold text-[#7A151A] uppercase tracking-wider">Student Onboarding Profile</h4>
            
            <div>
              <label htmlFor="programId" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Academic Program
              </label>
              <select
                id="programId"
                name="programId"
                required
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
                disabled={isPending}
              >
                <option value="">-- Select Program --</option>
                {programs.map((p) => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_name} ({p.program_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="yearLevel" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Year Level
                </label>
                <select
                  id="yearLevel"
                  name="yearLevel"
                  required
                  className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
                  disabled={isPending}
                >
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>

              <div>
                <label htmlFor="major" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Academic Major
                </label>
                <select
                  id="major"
                  name="major"
                  required
                  className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
                  disabled={isPending}
                >
                  {getMajorOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 border-t border-stone-100 pt-4 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-bold text-[#7A151A] uppercase tracking-wider">Faculty Onboarding Profile</h4>
            
            <div>
              <label htmlFor="departmentId" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Assigned Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                required
                className="w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
                disabled={isPending}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Register Button */}
      <button
        type="submit"
        disabled={isPending || !isIdValid || strengthScore < 5 || !passwordsMatch}
        className="w-full relative flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl py-3.5 text-sm shadow-md shadow-[#7A151A]/10 hover:shadow-lg hover:shadow-[#7A151A]/20 focus:outline-none focus:ring-2 focus:ring-[#7A151A] focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden mt-6 cursor-pointer"
      >
        <span className="absolute right-0 top-0 w-24 h-full bg-[#E2A123]/10 skew-x-12 translate-x-12 group-hover:translate-x-[-180px] transition-transform duration-1000 ease-out" />
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#E2A123]" />
            <span>Creating Secure Account...</span>
          </div>
        ) : (
          <span>Register Account</span>
        )}
      </button>

      {/* Return to login link */}
      <div className="text-center pt-2">
        <p className="text-xs text-stone-500">
          Already have an account?{" "}
          <Link href="/" className="font-bold text-[#7A151A] hover:underline transition-all">
            Sign In here
          </Link>
        </p>
      </div>
    </form>
  );
}
