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
    // 1. Fetch user from local USERS table (support institutional ID or username)
    const user = await db.user.findFirst({
      where: {
        OR: [
          { institutional_id: institutionalId },
          { username: institutionalId },
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
  const firstName = formData.get("firstName") as string;
  const middleName = formData.get("middleName") as string;
  const lastName = formData.get("lastName") as string;
  const departmentIdStr = formData.get("departmentId") as string;
  const institutionalId = formData.get("institutionalId") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  const programIdStr = formData.get("programId") as string;
  const yearLevelStr = formData.get("yearLevel") as string;
  const section = formData.get("section") as string;

  if (!firstName || !lastName || !institutionalId || !password || !role) {
    return { error: "Please fill in all required fields." };
  }

  try {
    // 1. Check if institutional_id already exists
    const existingUser = await db.user.findUnique({
      where: { institutional_id: institutionalId },
    });

    if (existingUser) {
      return { error: "Institutional ID already registered." };
    }

    // 2. Generate unique username for Faculty using formula:
    // 2 first letters + 1 middle name letter + 2 or 3 last name letters (e.g. miAgCa)
    let username = "";
    if (role === "Faculty") {
      const cleanFirst = firstName.trim().replace(/[^a-zA-Z]/g, "");
      const cleanMiddle = (middleName || "").trim().replace(/[^a-zA-Z]/g, "");
      const cleanLast = lastName.trim().replace(/[^a-zA-Z]/g, "");

      const fPart = cleanFirst.slice(0, 2).toLowerCase();
      // middle initial (uppercase) - if middle name is missing, use "X"
      const mPart = cleanMiddle ? cleanMiddle.slice(0, 1).toUpperCase() : "X";
      
      // Try 2 letters of last name:
      const lPart2 = cleanLast.slice(0, 2);
      const lPart2Cased = lPart2.charAt(0).toUpperCase() + lPart2.slice(1).toLowerCase();
      const candidate1 = `${fPart}${mPart}${lPart2Cased}`; // e.g. miAgCa
      
      const userWithCand1 = await db.user.findUnique({
        where: { username: candidate1 },
      });
      
      if (!userWithCand1) {
        username = candidate1;
      } else {
        // Try 3 letters of last name:
        const lPart3 = cleanLast.slice(0, 3);
        const lPart3Cased = lPart3.charAt(0).toUpperCase() + lPart3.slice(1).toLowerCase();
        const candidate2 = `${fPart}${mPart}${lPart3Cased}`; // e.g. miAgCas
        
        const userWithCand2 = await db.user.findUnique({
          where: { username: candidate2 },
        });
        
        if (!userWithCand2) {
          username = candidate2;
        } else {
          // Fallback: append sequential numbers
          let suffix = 1;
          while (true) {
            const candidate3 = `${candidate1}${suffix}`;
            const userWithCand3 = await db.user.findUnique({
              where: { username: candidate3 },
            });
            if (!userWithCand3) {
              username = candidate3;
              break;
            }
            suffix++;
          }
        }
      }
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create User and Faculty/Student record
    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          institutional_id: institutionalId,
          username: role === "Faculty" ? username : null,
          password_hash: passwordHash,
          role: role as any,
          require_password_update: true, // Force password update immediately after signing up!
        },
      });

      if (role === "Faculty") {
        if (!departmentIdStr) {
          throw new Error("Department selection is required for Faculty.");
        }
        await tx.faculty.create({
          data: {
            faculty_id: newUser.user_id,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            department_id: Number(departmentIdStr),
          },
        });
      } else if (role === "Student") {
        if (!programIdStr) {
          throw new Error("Academic Program is required for Student.");
        }
        await tx.student.create({
          data: {
            student_id: newUser.user_id,
            first_name: firstName,
            last_name: lastName,
            program_id: Number(programIdStr),
            year_level: Number(yearLevelStr || 1),
            section: section || "A",
          },
        });
      }
    });

    return { success: true, username: role === "Faculty" ? username : undefined };
  } catch (err: any) {
    console.error("Registration error:", err);
    return { error: err.message || "An error occurred during registration." };
  }
}
