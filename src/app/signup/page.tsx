"use client";
import { useState } from "react";
import Link from "next/link";
import {
    UserPlus, ArrowLeft, BookOpen, ChevronRight, Users, Plus, Trash2, ShieldCheck
} from "lucide-react";

export default function SignUpPage() {
    const [role, setRole] = useState<string | null>(null);
    const [subjects, setSubjects] = useState([{ name: "", detail: "", yearLevel: "" }]);

    const addSubject = () => setSubjects([...subjects, { name: "", detail: "", yearLevel: "" }]);
    const removeSubject = (index: number) => setSubjects(subjects.filter((_, i) => i !== index));

    const handleInputChange = (index: number, field: "name" | "detail" | "yearLevel", value: string) => {
        const newSubjects = [...subjects];
        newSubjects[index][field] = value;
        setSubjects(newSubjects);
    };

    // --- ROLE SELECTION VIEW ---
    if (!role) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF6F0] p-6">
                <div className="w-full max-w-md space-y-8 text-center">
                    <BookOpen className="w-16 h-16 mx-auto text-[#7A151A]" />
                    <h2 className="text-3xl font-black text-neutral-900">Choose Your Identity</h2>
                    <div className="grid gap-3">
                        {["Student", "Faculty", "Chair", "Director"].map((r) => (
                            <button
                                key={r}
                                onClick={() => setRole(r)}
                                className="flex items-center justify-between p-5 bg-white border border-neutral-200 rounded-2xl hover:border-[#7A151A] hover:shadow-lg transition-all group"
                            >
                                <span className="font-bold text-lg">{r}</span>
                                <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-[#7A151A]" />
                            </button>
                        ))}
                    </div>
                    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-[#7A151A]">
                        <ArrowLeft className="w-4 h-4" /> Back to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    // --- REGISTRATION FORM VIEW ---
    return (
        <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans text-neutral-800 antialiased">
            <header className="w-full bg-gradient-to-br from-[#7A151A] via-[#5F0F13] to-[#420A0C] text-white px-6 py-8 border-b-4 border-[#E2A123]">
                <div className="max-w-xl mx-auto flex items-center gap-4">
                    <div className="bg-white p-2 rounded-full"><BookOpen className="w-8 h-8 text-[#7A151A]" /></div>
                    <div>
                        <h2 className="font-black text-lg text-[#E2A123] uppercase">Batanes State College</h2>
                        <h1 className="text-xl font-black">AcadNexus Portal</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 py-10 px-6">
                <div className="mx-auto w-full max-w-xl space-y-6">
                    <div className="text-center">
                        <h3 className="text-2xl font-black">{role} Registration</h3>
                        <p className="text-neutral-500">Complete your {role.toLowerCase()} profile to request access.</p>
                    </div>

                    <form className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                            <input type="text" placeholder="Full Name" className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-[#7A151A]" />
                            <input type="text" placeholder="Department" className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-[#7A151A]" />
                            {role === "Student" && (
                                <input type="text" placeholder="Year Level" className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-[#7A151A]" />
                            )}
                        </div>

                        {/* CONDITIONAL SUBJECT FIELDS */}
                        {(role === "Student" || role === "Faculty") ? (
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-neutral-700">
                                    <Users className="w-4 h-4" />
                                    {role === "Student" ? "Enrolled Subjects & Teachers" : "Assigned Subjects & Year Levels"}
                                </label>

                                {subjects.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-start bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                value={item.name}
                                                onChange={(e) => handleInputChange(index, "name", e.target.value)}
                                                placeholder="Subject Name"
                                                className="w-full p-2 rounded-lg border border-neutral-200 outline-none"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                {role === "Student" ? (
                                                    <input
                                                        value={item.detail}
                                                        onChange={(e) => handleInputChange(index, "detail", e.target.value)}
                                                        placeholder="Assigned Teacher"
                                                        className="col-span-2 w-full p-2 rounded-lg border border-neutral-200 outline-none"
                                                    />
                                                ) : (
                                                    <>
                                                        <input
                                                            value={item.yearLevel}
                                                            onChange={(e) => handleInputChange(index, "yearLevel", e.target.value)}
                                                            placeholder="Year Level"
                                                            className="w-full p-2 rounded-lg border border-neutral-200 outline-none"
                                                        />
                                                        <input
                                                            value={item.detail}
                                                            onChange={(e) => handleInputChange(index, "detail", e.target.value)}
                                                            placeholder="Section/Room"
                                                            className="w-full p-2 rounded-lg border border-neutral-200 outline-none"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {subjects.length > 1 && (
                                            <button type="button" onClick={() => removeSubject(index)} className="mt-2 text-red-500 p-2"><Trash2 className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={addSubject} className="w-full py-3 flex items-center justify-center gap-2 text-sm text-[#7A151A] font-semibold hover:bg-[#7A151A]/5 rounded-xl border border-dashed border-[#7A151A]/30">
                                    <Plus className="w-4 h-4" /> Add Subject Entry
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800">
                                <p>Administrative access for <strong>{role}</strong> roles is granted upon verification of your department head credentials.</p>
                            </div>
                        )}

                        <button type="submit" className="w-full bg-[#7A151A] text-white py-3 rounded-xl font-bold hover:bg-[#5F0F13] transition-all">
                            Submit {role} Request
                        </button>
                        <button type="button" onClick={() => setRole(null)} className="w-full text-sm text-neutral-500 hover:underline">Change Role</button>
                    </form>

                    <p className="text-center text-[11px] text-neutral-400 flex items-center justify-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" /> AcadNexus Secure Verification
                    </p>
                </div>
            </main>
        </div>
    );
}