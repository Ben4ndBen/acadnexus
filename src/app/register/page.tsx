import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import db from "@/lib/db";
import { RegisterForm } from "@/app/components/RegisterForm";

export default async function RegisterPage() {
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

  // Fetch Academic Programs and Departments for Onboarding Forms
  const programs = await db.academicProgram.findMany({
    orderBy: { program_name: "asc" },
  });

  const departments = await db.department.findMany({
    orderBy: { department_name: "asc" },
  });

  // Academic Year Indicator Logic
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let startYear = currentYear;
  let endYear = currentYear + 1;

  if (currentMonth <= 5) {
    startYear = currentYear - 1;
    endYear = currentYear;
  }

  const academicYearString = `${startYear}-${endYear}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans text-neutral-800 antialiased select-none">
      
      {/* INSTITUTIONAL BRANDING AREA */}
      <header className="w-full relative bg-gradient-to-br from-[#7A151A] via-[#5F0F13] to-[#420A0C] text-white px-6 py-8 md:px-16 md:py-10 flex flex-col justify-between overflow-hidden border-b-4 border-[#E2A123] shadow-md md:max-h-[280px] group/header">
        <span className="absolute right-0 top-0 w-48 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-48 group-hover/header:translate-x-[-1200px] transition-transform duration-[1200ms] ease-out pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] transition-all duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 w-full max-w-6xl mx-auto">
          <div className="flex items-center gap-4 group/logo cursor-pointer">
            <div className="bg-white p-1.5 rounded-full shadow-md border-2 border-[#E2A123] shrink-0">
              <Image
                src="/bsc-logo.png" 
                alt="Batanes State College Logo"
                width={60}
                height={60}
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-0.5">
              <h2 className="font-black tracking-wider text-base md:text-xl text-[#E2A123] uppercase leading-tight">
                Batanes State College
              </h2>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight relative inline-block">
                AcadNexus Portal
              </h1>
              <p className="italic text-xs text-amber-200/70 font-medium hidden md:block">
                "Builds minds, Serves communities, Creates opportunities"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-start md:self-auto">
            <div className="bg-black/20 border border-white/10 backdrop-blur-sm px-4 py-2 rounded-xl">
              <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">
                Academic Year
              </p>
              <p className="text-sm font-black text-white tracking-wider">
                AY {academicYearString}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* REGISTRATION PANEL CONTAINER */}
      <main className="flex-1 flex flex-col justify-center py-10 px-6 sm:px-12 lg:px-20 bg-[#FBF9F6] relative">
        <div className="mx-auto w-full max-w-md space-y-6">
          
          <div className="text-center space-y-1.5 cursor-default">
            <h3 className="text-xl font-black text-neutral-900 tracking-tight">
              Create Portal Account
            </h3>
            <p className="text-sm text-neutral-500">
              Register via your unique assigned Institutional ID to onboard onto your role workflow.
            </p>
          </div>

          {/* Registration Form Component */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200/60 shadow-sm hover:shadow-xl transition-all duration-300">
            <RegisterForm programs={programs} departments={departments} />
          </div>

          {/* Footer Footnote */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-400 leading-5">
              © 2026 Batanes State College. Unified Role Routing Architecture. <br />
              <span className="text-neutral-400 font-semibold hover:text-[#7A151A] hover:underline cursor-pointer">Privacy Charter</span> 
              &nbsp;&bull;&nbsp; 
              <span className="text-neutral-400 font-semibold hover:text-[#7A151A] hover:underline cursor-pointer">Audit & Security Desk</span>
            </p>
          </div>
          
        </div>
      </main>
    </div>
  );
}
