import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { ExamBuilderWizard } from "@/app/components/ExamBuilderWizard";
import { BookOpen } from "lucide-react";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExamBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const examId = Number(id);

  if (isNaN(examId)) {
    redirect("/dashboard/faculty");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Faculty") {
    redirect("/");
  }

  // Fetch faculty details
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      faculty: {
        include: {
          department: true,
        },
      },
    },
  });

  const faculty = dbUser?.faculty;
  if (!faculty) {
    redirect("/dashboard/faculty");
  }

  // Fetch examination with course and question bank
  const exam = await db.examination.findUnique({
    where: { exam_id: examId },
    include: {
      course: true,
      questionBank: {
        orderBy: { question_id: "asc" },
      },
    },
  });

  // Verify examination exists and belongs to this faculty
  if (!exam || exam.faculty_id !== faculty.faculty_id) {
    redirect("/dashboard/faculty");
  }

  // Verify status is editable (Draft or Returned)
  if (exam.current_status !== "Draft" && exam.current_status !== "Returned") {
    redirect("/dashboard/faculty");
  }

  // Fetch all courses for the course selection dropdown
  const courses = await db.course.findMany({
    orderBy: { course_code: "asc" },
  });

  // Convert decimal to number/string in portfolios for serialization if necessary
  const sanitizedExam = {
    ...exam,
    questionBank: exam.questionBank.map(q => ({
      ...q,
      points: Number(q.points),
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className="text-xs text-emerald-600 font-bold ml-2 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Exam Builder
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                Instructor {faculty.first_name} {faculty.last_name}
              </p>
              <p className="text-xs text-slate-500">{institutionalId}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExamBuilderWizard 
          exam={sanitizedExam as any} 
          courses={courses} 
          facultyId={faculty.faculty_id} 
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
