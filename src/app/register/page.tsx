import db from "@/lib/db";
import { RegisterForm } from "./RegisterForm";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const departments = await db.department.findMany({
    orderBy: { department_name: "asc" },
  });

  const programs = await db.academicProgram.findMany({
    orderBy: { program_name: "asc" },
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans text-neutral-800 antialiased select-none">
      
      {/* 1. INSTITUTIONAL BRANDING AREA */}
      <header className="w-full relative bg-gradient-to-br from-[#7A151A] via-[#5F0F13] to-[#420A0C] text-white px-6 py-6 md:px-16 md:py-8 flex flex-col justify-between overflow-hidden border-b-4 border-[#E2A123] shadow-md group/header">
        <span className="absolute right-0 top-0 w-48 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-48 group-hover/header:translate-x-[-1200px] transition-transform duration-[1200ms] ease-out pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full max-w-6xl mx-auto">
          <div className="flex items-center gap-4 group/logo cursor-pointer">
            <div className="bg-white p-1 rounded-full shadow-md border border-[#E2A123] shrink-0">
              <Image
                src="/bsc-logo.png" 
                alt="Batanes State College Logo"
                width={50}
                height={50}
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-0.5">
              <h2 className="font-black tracking-wider text-xs md:text-sm text-[#E2A123] uppercase leading-tight">
                Batanes State College
              </h2>
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                AcadNexus Portal Onboarding
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 2. REGISTRATION FORM CONTAINER */}
      <main className="flex-1 flex flex-col justify-center py-8 px-6 sm:px-12 lg:px-20 bg-[#FBF9F6] relative">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          
          <div className="text-center space-y-1.5 cursor-default">
            <h3 className="text-xl font-black text-neutral-900 tracking-tight">
              Create Your Institutional Account
            </h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              Please enter your full credentials to be assigned a secure login username and enroll in your academic pipeline.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200/60 shadow-sm">
            <RegisterForm departments={departments} programs={programs} />
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-400 leading-5">
              © 2026 Batanes State College. Unified Role Routing Architecture. <br />
              All account creations are logged and verified against HR and Registrar records.
            </p>
          </div>
          
        </div>
      </main>
    </div>
  );
}
