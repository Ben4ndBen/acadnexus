import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { startStudentExam } from "@/app/actions/student";
import { TakeExamClient } from "@/app/components/TakeExamClient";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, ArrowLeft, GraduationCap, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default async function ExamPage({ params }: PageProps) {
  const { examId: examIdStr } = await params;
  const examId = Number(examIdStr);

  if (isNaN(examId)) {
    redirect("/dashboard/student");
  }

  // 1. Verify User and Role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Student") {
    redirect("/");
  }

  // 2. Fetch student details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      student: {
        include: {
          program: {
            include: {
              department: true,
            },
          },
        },
      },
    },
  });

  const student = dbUser?.student;
  if (!student) {
    redirect("/");
  }

  // 3. Initialize/Fetch the Student Exam attempt
  const result = await startStudentExam(examId, student.student_id);

  // Handle errors (e.g. target mismatches, inactive schedules)
  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#7A151A] text-white p-2 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
            </div>
            <Link
              href="/dashboard/student"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Exit to Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 border border-rose-100">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900">Access Restricted</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                {result.error}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/dashboard/student"
                className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Handle completed examinations
  if (result.isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#7A151A] text-white p-2 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
            </div>
            <Link
              href="/dashboard/student"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Exit to Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900">Examination Completed</h2>
              <p className="text-slate-500 text-sm">
                You have already submitted this examination. Re-attempts are strictly disallowed.
              </p>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/50 pb-2">
                <span className="text-slate-400 font-semibold uppercase">Submitted Via</span>
                <span className="text-slate-800 font-bold uppercase">{result.trigger}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold uppercase">Submitted At</span>
                <span className="text-slate-800 font-bold">
                  {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/dashboard/student"
                className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 4. Render interactive client interface for the active exam attempt
  return (
    <TakeExamClient
      studentId={student.student_id}
      studentName={`${student.first_name} ${student.last_name}`}
      institutionalId={dbUser.institutional_id}
      examId={examId}
      initialData={{
        studentExamId: result.studentExamId!,
        remainingSeconds: result.remainingSeconds!,
        questions: result.questions!,
        savedAnswers: result.savedAnswers!,
        examTitle: result.examTitle!,
        courseTitle: result.courseTitle!,
        courseCode: result.courseCode!,
      }}
    />
  );
}
