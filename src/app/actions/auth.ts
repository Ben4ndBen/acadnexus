"use server";

import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function loginAction(prevState: any, formData: FormData) {
  const rawId = formData.get("institutionalId") as string;
  const password = formData.get("password") as string;

  if (!rawId || !password) {
    return { error: "Please enter both institutional ID and password." };
  }

  const trimmedId = rawId.trim();

  try {
    // 1. Fetch user from local USERS table (support institutional ID or username)
    // Institutional ID lookup is case-insensitive, while username is checked as-is.
    const user = await db.user.findFirst({
      where: {
        OR: [
          { institutional_id: trimmedId.toUpperCase() },
          { username: trimmedId },
        ],
      },
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
          institutional_id: user.institutional_id, // Use canonical uppercase ID
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

    // Use a synthetic email derived from the canonical institutional ID
    const email = `${user.institutional_id.toLowerCase()}@acadnexus.bsc.edu.ph`;
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
            institutional_id: user.institutional_id, // Use canonical uppercase ID
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

      // Synchronize role and metadata in Supabase token using canonical uppercase ID
      await supabase.auth.updateUser({
        data: {
          role: user.role,
          institutional_id: user.institutional_id,
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

export async function registerAction(prevState: any, formData: FormData): Promise<{ success?: boolean; error?: string; role?: string }> {
  return { error: "Student self-registration has been disabled. Course instructors are in charge of enrolling students and provisioning their accounts." };
}

export async function registerInstructorByAdminAction(prevState: any, formData: FormData) {
  // Check active session role
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) {
    return { error: "Unauthorized. Please log in first." };
  }
  const currentRole = currentUser.user_metadata?.role;
  if (currentRole !== "Director" && currentRole !== "Chair") {
    return { error: "Unauthorized. Only Director or Chair can register an instructor." };
  }

  const institutionalId = formData.get("institutionalId") as string;
  const password = formData.get("password") as string;
  const confirmPassword = (formData.get("confirmPassword") as string) || password;
  const firstName = formData.get("firstName") as string;
  const middleName = formData.get("middleName") as string;
  const lastName = formData.get("lastName") as string;
  const departmentIdStr = formData.get("departmentId") as string;

  if (!institutionalId || !password || !firstName || !lastName || !departmentIdStr) {
    return { error: "Please fill in all required fields." };
  }

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

  const formattedId = institutionalId.trim().toUpperCase();
  if (!/^FACULTY-\d+$/.test(formattedId)) {
    return { error: "Faculty ID must follow standard format: FACULTY- followed by digits (e.g. FACULTY-002)." };
  }

  try {
    // Check if institutional ID already registered
    const existingUser = await db.user.findUnique({
      where: { institutional_id: formattedId },
    });

    if (existingUser) {
      return { error: "Institutional ID already registered." };
    }

    // Generate unique username formula
    const cleanFirst = firstName.trim().replace(/[^a-zA-Z]/g, "");
    const cleanMiddle = (middleName || "").trim().replace(/[^a-zA-Z]/g, "");
    const cleanLast = lastName.trim().replace(/[^a-zA-Z]/g, "");

    const fPart = cleanFirst.slice(0, 2).toLowerCase();
    const mPart = cleanMiddle ? cleanMiddle.slice(0, 1).toUpperCase() : "X";

    const lPart2 = cleanLast.slice(0, 2);
    const lPart2Cased = lPart2.charAt(0).toUpperCase() + lPart2.slice(1).toLowerCase();
    const candidate1 = `${fPart}${mPart}${lPart2Cased}`;

    let username = candidate1;
    const userWithCand1 = await db.user.findUnique({ where: { username: candidate1 } });
    if (userWithCand1) {
      const lPart3 = cleanLast.slice(0, 3);
      const lPart3Cased = lPart3.charAt(0).toUpperCase() + lPart3.slice(1).toLowerCase();
      const candidate2 = `${fPart}${mPart}${lPart3Cased}`;

      const userWithCand2 = await db.user.findUnique({ where: { username: candidate2 } });
      if (!userWithCand2) {
        username = candidate2;
      } else {
        let suffix = 1;
        while (true) {
          const candidate3 = `${candidate1}${suffix}`;
          const userWithCand3 = await db.user.findUnique({ where: { username: candidate3 } });
          if (!userWithCand3) {
            username = candidate3;
            break;
          }
          suffix++;
        }
      }
    }

    // Parse assigned courses if provided
    const courseIdsRaw = formData.get("courseIds") as string;
    let selectedCourseIds: number[] = [];
    if (courseIdsRaw) {
      try {
        const parsed = JSON.parse(courseIdsRaw);
        if (Array.isArray(parsed)) {
          selectedCourseIds = parsed.map(Number).filter((n) => !isNaN(n) && n > 0);
        }
      } catch {
        selectedCourseIds = courseIdsRaw.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User & Faculty records
    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          institutional_id: formattedId,
          username: username,
          password_hash: passwordHash,
          role: "Faculty",
          require_password_update: true,
        },
      });

      await tx.faculty.create({
        data: {
          faculty_id: user.user_id,
          first_name: firstName.trim(),
          middle_name: middleName ? middleName.trim() : null,
          last_name: lastName.trim(),
          department_id: Number(departmentIdStr),
          has_seen_course_assignment: false,
        },
      });

      if (selectedCourseIds.length > 0) {
        await tx.facultyCourse.createMany({
          data: selectedCourseIds.map((cId) => ({
            faculty_id: user.user_id,
            course_id: cId,
          })),
        });
      }

      return user;
    });

    // Create audit log
    const dbAdminUser = await db.user.findUnique({
      where: { institutional_id: currentUser.user_metadata?.institutional_id },
    });
    if (dbAdminUser) {
      await db.auditLog.create({
        data: {
          user_id: dbAdminUser.user_id,
          action_performed: `${currentRole} registered new instructor ${firstName} ${lastName} (${formattedId}) with generated username: ${username}${selectedCourseIds.length > 0 ? ` and ${selectedCourseIds.length} assigned subject(s)` : ""}`,
          ip_address: "127.0.0.1",
        },
      });
    }

    revalidatePath("/dashboard/director");
    revalidatePath("/dashboard/chair");

    return {
      success: true,
      username,
      institutionalId: formattedId,
      name: `${firstName} ${lastName}`,
      assignedCoursesCount: selectedCourseIds.length,
    };
  } catch (err: any) {
    console.error("Error registering instructor by admin:", err);
    return { error: err.message || "Failed to register instructor." };
  }
}

