"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth"; // Adjust path if needed

export function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state?.role) {
      // Role-based redirection logic
      const routes: Record<string, string> = {
        Student: "/dashboard/student",
        Faculty: "/dashboard/faculty",
        Chair: "/dashboard/chair",
        Director: "/dashboard/director",
      };

      const destination = routes[state.role] || "/dashboard";
      router.push(destination);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
      <input name="institutionalId" placeholder="Institutional ID" required className="w-full p-2 border rounded" />
      <input name="password" type="password" placeholder="Password" required className="w-full p-2 border rounded" />

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-red-950 text-white py-2 rounded font-bold hover:bg-red-900"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}