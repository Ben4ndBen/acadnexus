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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FFFDF2] font-sans">
      {/* Brand visual showcase (Left Pane) */}
      <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-tr from-[#580B0F] via-[#7A151A] to-[#911D23] text-white p-16 flex-col justify-between overflow-hidden border-r-8 border-[#FBB017]">
        {/* Subtle geometric pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px]" />
        
        {/* Top brand header */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-md">
            <Image
              src="/bsc-logo.png"
              alt="Batanes State College Seal"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="font-extrabold tracking-wider text-sm text-[#FBB017] uppercase drop-shadow">
              Batanes State College
            </h2>
            <p className="text-xs text-red-200 font-medium">Established 2004</p>
          </div>
        </div>

        {/* Dynamic visual asset representation */}
        <div className="relative z-10 my-auto max-w-md space-y-8">
          <div className="space-y-4">
            <span className="bg-[#FBB017]/20 text-[#FAC915] font-bold text-xs px-3 py-1.5 rounded-full border border-[#FBB017]/40 uppercase tracking-widest backdrop-blur-xs">
              AcadNexus Portal
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Empowering Education, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FAC915] via-amber-300 to-yellow-100 drop-shadow-sm">
                Fostering Resilience.
              </span>
            </h1>
            <p className="text-red-100/80 leading-relaxed text-sm lg:text-base">
              Manage your academic examinations, syllabus alignment, compliance workflows, and institutional performance indicators in one centralized environment.
            </p>
          </div>

          {/* Visual card showcasing generated landscape */}
          <div className="group relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/10 backdrop-blur-xs p-3 aspect-[16/10] transition-all duration-500 hover:border-white/20 hover:scale-[1.01]">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              <Image
                src="/bsc-banner.png"
                alt="Batanes State College landscape"
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs font-bold text-[#FBB017] uppercase tracking-widest">
                  Official Seal Landscape
                </p>
                <p className="text-sm font-medium text-white/90">
                  Sitio Mutchong, Uyugan, Batanes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer brand motto */}
        <div className="relative z-10 flex flex-col gap-1">
          <p className="text-[10px] text-red-200/60 uppercase tracking-widest font-bold">
            Institutional Mandate
          </p>
          <p className="italic text-xs lg:text-sm text-[#FAC915] font-semibold tracking-wide">
            &ldquo;Builds minds, Serves communities, Creates opportunities&rdquo;
          </p>
        </div>
      </div>

      {/* Login Form Pane (Right Pane) */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-12 lg:px-20 xl:px-24 bg-[#FFFDF2]">
        <div className="mx-auto w-full max-w-md space-y-8">
          
          {/* Mobile brand header (visible on small screens) */}
          <div className="flex flex-col items-center text-center md:hidden space-y-3">
            <div className="p-1 bg-white rounded-full shadow-md border border-[#FBB017]/30">
              <Image
                src="/bsc-logo.png"
                alt="Batanes State College Seal"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#7A151A] tracking-tight">
                BATANES STATE COLLEGE
              </h2>
              <p className="text-xs text-amber-700 font-bold uppercase tracking-widest mt-1">
                AcadNexus Portal
              </p>
            </div>
          </div>

          {/* Desktop Form Seal & Title */}
          <div className="hidden md:block text-center space-y-4">
            <div className="inline-flex p-2 rounded-full bg-white border border-amber-100 shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-[#FBB017]/40">
              <Image
                src="/bsc-logo.png"
                alt="Batanes State College Seal"
                width={72}
                height={72}
                className="object-contain"
              />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-[#7A151A] tracking-tight">
                Welcome to AcadNexus
              </h1>
              <p className="text-sm text-stone-600 max-w-sm mx-auto font-medium">
                Sign in with your institutional credentials to access your dashboard.
              </p>
            </div>
          </div>

          {/* Form wrapper with neat boundary */}
          <div className="bg-white/80 md:bg-white p-6 md:p-8 rounded-2xl border border-amber-100/60 md:shadow-xl md:shadow-[#7A151A]/5">
            <LoginForm />
          </div>

          {/* Legal / Institutional footer */}
          <div className="text-center">
            <p className="text-xs text-stone-400 font-medium leading-relaxed">
              &copy; {new Date().getFullYear()} Batanes State College. All rights reserved. <br />
              <span className="hover:text-[#7A151A] hover:underline cursor-pointer transition-colors">Privacy Policy</span> &bull; <span className="hover:text-[#7A151A] hover:underline cursor-pointer transition-colors">Support Center</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
