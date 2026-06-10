"use server";

import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function loginAction(prevState: any, formData: FormData) {
  const institutionalId = formData.get("institutionalId") as string;
  const password = formData.get("password") as string;

  if (!institutionalId || !password) {
    return { error: "Please enter both institutional ID and password." };
  }

  try {
    // 1. Fetch user from local USERS table
    const user = await db.user.findUnique({
      where: { institutional_id: institutionalId },
    });

    if (!user) {
      return { error: "Invalid institutional ID or password." };
    }

    if (!user.is_active) {
      return { error: "This account has been deactivated. Please contact administration." };
    }

    // 2. Verify password against hash in the database
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return { error: "Invalid institutional ID or password." };
    }

    // 3. Authenticate with Supabase Auth
    const isMockAuth = !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (isMockAuth) {
      const mockUser = {
        id: `mock-${user.user_id}`,
        user_metadata: {
          role: user.role,
          institutional_id: institutionalId,
        },
      };

      const cookieStore = await cookies();
      cookieStore.set("acadnexus_mock_session", JSON.stringify(mockUser), {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
      });

      if (user.supabase_uid !== mockUser.id) {
        await db.user.update({
          where: { user_id: user.user_id },
          data: { supabase_uid: mockUser.id },
        });
      }

      return { success: true, role: user.role };
    }

    // Use a synthetic email derived from the institutional ID
    const email = `${institutionalId.toLowerCase()}@acadnexus.bsc.edu.ph`;
    const supabase = await createClient();

    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // 4. Auto-register in Supabase Auth if out of sync
    if (error && error.message.toLowerCase().includes("invalid login credentials")) {
      // Create user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            institutional_id: institutionalId,
            role: user.role,
          },
        },
      });

      if (signUpError) {
        return { error: `Auth synchronization failed: ${signUpError.message}` };
      }

      // Retry sign in
      const retrySignIn = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (retrySignIn.error) {
        return { error: `Auth session failed: ${retrySignIn.error.message}` };
      }

      data = retrySignIn.data;
    } else if (error) {
      return { error: error.message };
    }

    // 5. Update local record with Supabase UID if needed
    if (data?.user) {
      if (user.supabase_uid !== data.user.id) {
        await db.user.update({
          where: { user_id: user.user_id },
          data: { supabase_uid: data.user.id },
        });
      }

      // Synchronize role and metadata in Supabase token
      await supabase.auth.updateUser({
        data: {
          role: user.role,
          institutional_id: institutionalId,
        },
      });
    }

    return { success: true, role: user.role };
  } catch (err: any) {
    console.error("Login action error:", err);
    return { error: err.message || "An unexpected error occurred." };
  }
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Clear mock session cookie
    const cookieStore = await cookies();
    cookieStore.set("acadnexus_mock_session", "", { maxAge: -1 });

    return { success: true };
  } catch (err: any) {
    console.error("Logout action error:", err);
    return { error: err.message || "An unexpected error occurred." };
  }
}
