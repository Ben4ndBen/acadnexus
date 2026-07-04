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

export async function registerAction(prevState: any, formData: FormData) {
  const institutionalId = formData.get("institutionalId") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const role = formData.get("role") as string; // "Student" | "Faculty"

  // Onboarding fields
  const programIdStr = formData.get("programId") as string; // for Student
  const yearLevelStr = formData.get("yearLevel") as string; // for Student
  const major = formData.get("major") as string; // for Student (stored in 'section')
  const departmentIdStr = formData.get("departmentId") as string; // for Faculty

  if (!institutionalId || !password || !confirmPassword || !firstName || !lastName || !role) {
    return { error: "Please fill in all required fields." };
  }

  // Validate password match
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  // Validate password strength
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (
    password.length < 8 ||
    !hasUppercase ||
    !hasLowercase ||
    !hasDigit ||
    !hasSpecial
  ) {
    return {
      error: "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.",
    };
  }

  // Validate ID format prefix & suffix to ensure security/correct role
  const formattedId = institutionalId.trim().toUpperCase();
  if (role === "Student") {
    if (!/^STUDENT-\d+$/.test(formattedId)) {
      return { error: "Student ID must follow the standard format: STUDENT- followed by digits (e.g. STUDENT-002)." };
    }
  } else if (role === "Faculty") {
    if (!/^FACULTY-\d+$/.test(formattedId)) {
      return { error: "Faculty ID must follow the standard format: FACULTY- followed by digits (e.g. FACULTY-002)." };
    }
  }

  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { institutional_id: formattedId },
    });

    if (existingUser) {
      return { error: "This Institutional ID is already registered." };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User record
    const newUser = await db.user.create({
      data: {
        institutional_id: formattedId,
        password_hash: passwordHash,
        role: role as any,
        is_active: true,
      },
    });

    // Handle role-based onboarding
    if (role === "Student") {
      if (!programIdStr || !yearLevelStr || !major) {
        // Rollback
        await db.user.delete({ where: { user_id: newUser.user_id } });
        return { error: "Please provide program, year level, and major for student onboarding." };
      }
      await db.student.create({
        data: {
          student_id: newUser.user_id,
          first_name: firstName,
          last_name: lastName,
          program_id: parseInt(programIdStr),
          year_level: parseInt(yearLevelStr),
          section: major, // Storing 'Major' in the section column
        },
      });
    } else if (role === "Faculty") {
      if (!departmentIdStr) {
        // Rollback
        await db.user.delete({ where: { user_id: newUser.user_id } });
        return { error: "Please select a department for faculty onboarding." };
      }
      await db.faculty.create({
        data: {
          faculty_id: newUser.user_id,
          first_name: firstName,
          last_name: lastName,
          department_id: parseInt(departmentIdStr),
        },
      });
    }

    // Sync with Supabase Auth
    const isMockAuth = !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const email = `${formattedId.toLowerCase()}@acadnexus.bsc.edu.ph`;

    if (isMockAuth) {
      const mockUser = {
        id: `mock-${newUser.user_id}`,
        user_metadata: {
          role: newUser.role,
          institutional_id: formattedId,
        },
      };

      await db.user.update({
        where: { user_id: newUser.user_id },
        data: { supabase_uid: mockUser.id },
      });

      const cookieStore = await cookies();
      cookieStore.set("acadnexus_mock_session", JSON.stringify(mockUser), {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
      });
    } else {
      const supabase = await createClient();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            institutional_id: formattedId,
            role: newUser.role,
          },
        },
      });

      if (signUpError) {
        // Rollback database
        if (role === "Student") {
          await db.student.delete({ where: { student_id: newUser.user_id } });
        } else if (role === "Faculty") {
          await db.faculty.delete({ where: { faculty_id: newUser.user_id } });
        }
        await db.user.delete({ where: { user_id: newUser.user_id } });
        return { error: `Supabase registration failed: ${signUpError.message}` };
      }

      if (signUpData?.user) {
        await db.user.update({
          where: { user_id: newUser.user_id },
          data: { supabase_uid: signUpData.user.id },
        });

        // Automatically log in
        await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }
    }

    return { success: true, role: newUser.role };
  } catch (err: any) {
    console.error("Register action error:", err);
    return { error: err.message || "An unexpected error occurred during registration." };
  }
}

