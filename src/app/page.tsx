import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/app/components/LoginForm";
import { cookies } from "next/headers";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const mockSession = cookieStore.get("acadnexus_mock_session");

  // Check if either real session or mock session exists
  if (session || mockSession) {
    // Determine the role and redirect
    const userRole = session?.user?.user_metadata?.role || JSON.parse(mockSession?.value || "{}")?.user_metadata?.role;

    if (userRole === "Student") redirect("/dashboard/student");
    if (userRole === "Faculty") redirect("/dashboard/faculty");
    if (userRole === "Chair") redirect("/dashboard/chair");
    if (userRole === "Director") redirect("/dashboard/director");
  }
  return (
    <main className="min-h-screen flex flex-col bg-stone-50">

      {/* THICKER MAROON HEADER */}
      <header className="bg-red-950 py-8 px-6 shadow-lg border-b-4 border-yellow-600">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-8">

          {/* Logo - Scaled slightly larger for the thicker header */}
          <div className="flex-shrink-0 bg-white p-1.5 rounded-full border-2 border-yellow-500 shadow-md">
            <Image
              src="/bsc_logo.png"
              alt="BSC Logo"
              width={85}
              height={85}
              className="rounded-full"
            />
          </div>

          {/* Institutional Text */}
          <div className="text-white flex-1 text-center md:text-left">
            <p className="text-[11px] uppercase tracking-widest font-bold text-red-200">Republic of the Philippines</p>
            <h1 className="text-3xl font-extrabold tracking-tight">BATANES STATE COLLEGE</h1>
            <p className="text-yellow-400 font-semibold italic text-sm mt-1">"Builds minds, Serves communities, Creates opportunities"</p>
          </div>

          {/* Boxed Banner */}
          <div className="border-2 border-yellow-500/50 p-1.5 bg-white rounded-lg shadow-lg flex-shrink-0">
            <div className="relative w-56 h-20 md:w-72 md:h-24">
              <Image
                src="/bsc-banner.png"
                alt="BSC Banner"
                fill
                className="object-cover rounded-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {/* LOGIN SECTION */}
      <section className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-red-950">AcadNexus Portal</h2>
            <p className="text-slate-500 text-xs mt-1 uppercase tracking-wider font-semibold">Academic Year 2026–2027</p>
          </div>
          <LoginForm />
        </div>
      </section>

      <footer className="py-4 text-center text-slate-400 text-[10px]">
        © {new Date().getFullYear()} Batanes State College.
      </footer>
    </main>
  );
}