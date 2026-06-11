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
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans text-neutral-800">
      
      {/* Top Brand Panel (Stacked horizontally above the form) */}
      <div className="w-full relative bg-gradient-to-br from-[#7A151A] via-[#5F0F13] to-[#420A0C] text-white px-6 py-10 md:px-16 md:py-12 flex flex-col justify-between overflow-hidden border-b-4 border-[#E2A123] shadow-md md:max-h-[300px]">
        {/* Geometric aesthetic overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute top-0 right-0 w-96 h-full bg-[#E2A123]/5 transform skew-x-12 origin-top-right pointer-events-none" />
        
        {/* Content Wrapper to align header and asset side-by-side on wide screens */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8 w-full max-w-6xl mx-auto">
          
          {/* Brand header with Logo */}
          <div className="flex items-center gap-4">
            <div className="bg-white p-1.5 rounded-full shadow-md border-2 border-[#E2A123] shrink-0">
              <Image
                src="/image_3a2544.png" 
                alt="Batanes State College Seal"
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-black tracking-wider text-base md:text-lg text-[#E2A123] uppercase">
                Batanes State College
              </h2>
              <p className="text-xs text-amber-100/80 font-medium">Established 2004</p>
              <p className="italic text-xs text-[#F5C453] mt-0.5 hidden md:block">
                "Builds minds, Serves communities, Creates opportunities"
              </p>
            </div>
          </div>

          {/* Compact Asset Representation */}
          <div className="hidden sm:block group relative rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/10 backdrop-blur-sm p-1.5 w-full max-w-xs md:max-w-sm aspect-[16/5] transition-all duration-300 hover:border-[#E2A123]/30">
            <div className="relative w-full h-full rounded-lg overflow-hidden">
              <Image
                src="/image_3a2565.jpg"
                alt="Batanes State College Banner"
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#420A0C]/50 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Login Form Panel */}
      <div className="flex-1 flex flex-col justify-center py-10 px-6 sm:px-12 lg:px-20 bg-white relative">
        <div className="mx-auto w-full max-w-md space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              Welcome to AcadNexus
            </h1>
            <p className="text-sm text-neutral-500">
              Sign in with your institutional credentials to access your dashboard.
            </p>
          </div>

          {/* Form Boundary */}
          <div className="bg-neutral-50 p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm">
            <LoginForm />
          </div>

          {/* Legal Institutional Footer */}
          <div className="text-center pt-2">
            <p className="text-xs text-neutral-400 leading-5">
              © {new Date().getFullYear()} Batanes State College. All rights reserved. <br />
              <span className="hover:text-[#7A151A] font-medium cursor-pointer transition-colors">Privacy Policy</span> &bull; <span className="hover:text-[#7A151A] font-medium cursor-pointer transition-colors">Support Center</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
