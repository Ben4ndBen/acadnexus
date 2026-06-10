import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/app/components/LoginForm";

export default async function LoginPage() {
  // Server-side redirection check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = user.user_metadata?.role;
    if (role === "Student") redirect("/dashboard/student");
    if (role === "Faculty") redirect("/dashboard/faculty");
    if (role === "Chair") redirect("/dashboard/chair");
    if (role === "Director") redirect("/dashboard/director");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Brand visual showcase (Left Pane) */}
      <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-tr from-blue-950 via-blue-900 to-indigo-950 text-white p-16 flex-col justify-between overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* Top brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
            <svg
              className="w-8 h-8 text-yellow-400"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" />
              <path d="M30 65 L 50 25 L 70 65 Z" fill="currentColor" opacity="0.3" />
              <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="6" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold tracking-wider text-sm text-yellow-400 uppercase">
              Batanes State College
            </h2>
            <p className="text-xs text-blue-200">Established 2004</p>
          </div>
        </div>

        {/* Dynamic visual asset representation */}
        <div className="relative z-10 my-auto max-w-md space-y-8">
          <div className="space-y-4">
            <span className="bg-yellow-400/20 text-yellow-300 font-semibold text-xs px-3 py-1.5 rounded-full border border-yellow-400/30 uppercase tracking-widest">
              AcadNexus Portal
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Empowering Education, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-emerald-400 to-teal-300">
                Fostering Resilience.
              </span>
            </h1>
            <p className="text-blue-100/80 leading-relaxed text-base">
              Manage your academic examinations, syllabus alignment, compliance workflows, and institutional performance indicators in one centralized environment.
            </p>
          </div>

          {/* Visual card showcasing generated landscape */}
          <div className="group relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-white/5 backdrop-blur-sm p-3 aspect-[16/10] transition-all duration-500 hover:border-white/20 hover:scale-[1.01]">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              <Image
                src="/bsc-banner.png"
                alt="Batanes State College landscape featuring rolling hills and lighthouse"
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">
                  Official Seal Landscape
                </p>
                <p className="text-sm font-medium text-white">
                  Sitio Mutchong, Uyugan, Batanes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer brand motto */}
        <div className="relative z-10 flex flex-col gap-2">
          <p className="text-xs text-blue-200/60 uppercase tracking-widest font-semibold">
            Institutional Mandate
          </p>
          <p className="italic text-sm text-yellow-300 font-medium">
            "Builds minds, Serves communities, Creates opportunities"
          </p>
        </div>
      </div>

      {/* Login Form Pane (Right Pane) */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-12 lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-md space-y-8">
          
          {/* Mobile brand header (visible on small screens) */}
          <div className="flex flex-col items-center text-center md:hidden space-y-4">
            <svg
              className="w-16 h-16 text-blue-700"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" />
              <circle cx="50" cy="50" r="41" stroke="#EAB308" strokeWidth="1.5" strokeDasharray="3 2" />
              <path d="M15 70 C 25 55, 40 65, 55 58 C 70 50, 80 65, 85 70 L 85 80 L 15 80 Z" fill="#10B981" opacity="0.85" />
              <path d="M30 72 C 45 60, 60 70, 75 62 C 80 58, 83 62, 85 64 L 85 80 L 30 80 Z" fill="#059669" />
              <rect x="47" y="30" width="6" height="30" fill="#E2E8F0" rx="1" />
              <polygon points="45,30 55,30 50,23" fill="#EAB308" />
              <rect x="46" y="60" width="8" height="2" fill="#E2E8F0" />
              <path d="M50 25 L 20 15 L 20 20 Z" fill="#EAB308" opacity="0.3" />
              <path d="M50 25 L 80 15 L 80 20 Z" fill="#EAB308" opacity="0.3" />
              <path d="M15 80 Q 22 78 30 80 T 45 80 T 60 80 T 75 80 T 85 80 L 85 84 L 15 84 Z" fill="#1D4ED8" />
            </svg>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                BATANES STATE COLLEGE
              </h2>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mt-1">
                AcadNexus Portal
              </p>
            </div>
          </div>

          {/* Desktop Form Seal & Title */}
          <div className="hidden md:block text-center space-y-4">
            <div className="inline-flex p-4 rounded-3xl bg-blue-50 border border-blue-100 shadow-inner group transition-all duration-300 hover:scale-[1.02]">
              <svg
                className="w-16 h-16 text-blue-700"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" />
                <circle cx="50" cy="50" r="41" stroke="#EAB308" strokeWidth="1.5" strokeDasharray="3 2" />
                <path d="M15 70 C 25 55, 40 65, 55 58 C 70 50, 80 65, 85 70 L 85 80 L 15 80 Z" fill="#10B981" opacity="0.85" />
                <path d="M30 72 C 45 60, 60 70, 75 62 C 80 58, 83 62, 85 64 L 85 80 L 30 80 Z" fill="#059669" />
                <rect x="47" y="30" width="6" height="30" fill="#E2E8F0" rx="1" />
                <polygon points="45,30 55,30 50,23" fill="#EAB308" />
                <rect x="46" y="60" width="8" height="2" fill="#E2E8F0" />
                <path d="M50 25 L 20 15 L 20 20 Z" fill="#EAB308" opacity="0.3" />
                <path d="M50 25 L 80 15 L 80 20 Z" fill="#EAB308" opacity="0.3" />
                <path d="M15 80 Q 22 78 30 80 T 45 80 T 60 80 T 75 80 T 85 80 L 85 84 L 15 84 Z" fill="#1D4ED8" />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Welcome to AcadNexus
              </h1>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Sign in with your institutional credentials to access your dashboard.
              </p>
            </div>
          </div>

          {/* Form wrapper with neat boundary */}
          <div className="bg-slate-50/50 md:bg-transparent p-6 md:p-0 rounded-2xl border border-slate-100 md:border-transparent">
            <LoginForm />
          </div>

          {/* Legal / Institutional footer */}
          <div className="text-center">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Batanes State College. All rights reserved. <br />
              <span className="hover:text-blue-600 cursor-pointer transition-colors">Privacy Policy</span> &bull; <span className="hover:text-blue-600 cursor-pointer transition-colors">Support Center</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
