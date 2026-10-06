import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/app/components/LoginForm";
import { getActiveAcademicPeriod } from "@/app/actions/director";

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
    if (role === "Chair" || role === "ProgramChair") redirect("/dashboard/chair");
    if (role === "Director") redirect("/dashboard/director");
  }

  // Academic Year Indicator based on DI Active Period configuration
  const academicPeriod = await getActiveAcademicPeriod();
  const academicYearString = academicPeriod.active_academic_year;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans text-neutral-800 antialiased select-none">

      {/* 1. INSTITUTIONAL BRANDING AREA (Horizontal Top Panel with Sliding Interactive Shine) */}
      <header className="w-full relative bg-gradient-to-br from-[#7A151A] via-[#5F0F13] to-[#420A0C] text-white px-6 py-8 md:px-16 md:py-10 flex flex-col justify-between overflow-hidden border-b-4 border-[#E2A123] shadow-md md:max-h-[280px] group/header">

        {/* Interactive light reflection beam overlay - moves across header on hover */}
        <span className="absolute right-0 top-0 w-48 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-48 group-hover/header:translate-x-[-1200px] transition-transform duration-[1200ms] ease-out pointer-events-none" />

        {/* Interactive background vector arrays reacting to header hovers */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] transition-all duration-700 group-hover/header:bg-[size:24px_24px] group-hover/header:opacity-70" />
        <div className="absolute top-0 right-0 w-96 h-full bg-[#E2A123]/5 transform skew-x-12 origin-top-right pointer-events-none transition-transform duration-1000 ease-out group-hover/header:translate-x-4 group-hover/header:scale-105" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 w-full max-w-6xl mx-auto">

          {/* Identity Info block */}
          <div className="flex items-center gap-5 group/logo cursor-pointer">
            <div className="relative p-1 bg-[#420A0C]/40 rounded-full">
              {/* Outer ambient glow halo */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 to-[#E2A123] opacity-60 blur-md transition-all duration-500 group-hover/logo:opacity-100 group-hover/logo:blur-lg" />
              <div className="relative bg-white p-2 rounded-full shadow-2xl border-4 border-[#E2A123] shrink-0 transition-all duration-500 ease-out group-hover/logo:scale-110 group-hover/logo:rotate-6 group-hover/logo:border-amber-300 logo-glow-ring animate-logo-float">
                <Image
                  src="/bsc-logo.png"
                  alt="Batanes State College Logo"
                  width={72}
                  height={72}
                  className="object-contain filter drop-shadow-md transition-transform duration-500 group-hover/logo:scale-105"
                  priority
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <h2 className="font-black tracking-wider text-base md:text-xl text-[#E2A123] uppercase leading-tight transition-colors duration-300 group-hover/logo:text-amber-300 drop-shadow-sm">
                Batanes State College
              </h2>
              <p className="italic text-xs text-amber-200/90 font-medium transition-all duration-500 group-hover/logo:translate-x-1 group-hover/logo:text-amber-100">
                "Builds minds, Serves communities, Creates opportunities"
              </p>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight relative inline-block pt-1">
                AcadNexus Portal
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-[#E2A123] to-transparent transition-all duration-500 group-hover/logo:w-full" />
              </h1>
            </div>
          </div>

          {/* Academic Badge & Academic Year Indicator */}
          <div className="flex items-center gap-4 self-start md:self-auto">
            {/* AcadNexus Official Logo - Retained in original place with high visibility */}
            <div className="group/banner relative rounded-2xl overflow-hidden border-2 border-[#E2A123] shadow-xl shadow-black/30 bg-[#580B0F] p-1.5 w-44 sm:w-56 md:w-60 aspect-[2/1] transition-all duration-500 hover:scale-105 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-500/20 cursor-pointer shrink-0">
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#580B0F] flex items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="AcadNexus Official Logo"
                  fill
                  className="object-contain filter drop-shadow-md transition-transform duration-500 ease-out group-hover/banner:scale-105"
                  priority
                />
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 2. AUTHENTICATION PANEL CONTAINER */}
      <main className="flex-1 flex flex-col justify-center py-10 px-6 sm:px-12 lg:px-20 bg-[#FBF9F6] relative">
        <div className="mx-auto w-full max-w-md space-y-6">

          <div className="text-center space-y-1.5 cursor-default group/title">
            <h3 className="text-xl font-black text-neutral-900 tracking-tight transition-colors duration-300 group-hover/title:text-[#7A151A]">
              Centralized Account Access
            </h3>
            <p className="text-sm text-neutral-500 transition-colors duration-300 group-hover/title:text-neutral-700">
              Enter your assigned role identification metrics below to seamlessly step into your dashboard pipeline.
            </p>
          </div>

          {/* Core Interactive Login Form Container */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200/60 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-neutral-200/40 hover:border-neutral-300/80">
            <LoginForm />
          </div>

          {/* Framework Legal Compliance Footnote */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-400 leading-5 transition-colors duration-300 hover:text-neutral-500">
              © 2026 Batanes State College. Unified Role Routing Architecture. <br />
              <span className="text-neutral-400 font-semibold hover:text-[#7A151A] hover:underline hover:underline-offset-2 cursor-pointer transition-all duration-200">Privacy Charter</span>
              &nbsp;&bull;&nbsp;
              <span className="text-neutral-400 font-semibold hover:text-[#7A151A] hover:underline hover:underline-offset-2 cursor-pointer transition-all duration-200">Audit & Security Desk</span>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}