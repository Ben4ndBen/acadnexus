"use server";

import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export interface SaveSignatureResult {
  success?: boolean;
  error?: string;
  signature?: string;
}

/**
 * Saves a user's drawn electronic signature to their account.
 * Requires verification of the user's current account password.
 * Authorized for Faculty, Program Chair, Department Chair, and Director (all except Student).
 */
export async function saveUserSignatureAction(
  signatureDataUrl: string,
  password: string,
  targetUserId?: number
): Promise<SaveSignatureResult> {
  try {
    if (!signatureDataUrl || !signatureDataUrl.trim().startsWith("data:image/")) {
      return { error: "Please draw a valid signature on the drawing pad before saving." };
    }

    if (!password || !password.trim()) {
      return { error: "Please enter your current account login password to save your signature." };
    }

    // Authenticate caller session
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return { error: "You must be logged in to save your electronic signature." };
    }

    const sessionInstitutionalId = sessionUser.user_metadata?.institutional_id;

    // Find the user in database
    let dbUser = null;
    if (targetUserId) {
      dbUser = await db.user.findUnique({
        where: { user_id: targetUserId },
      });
      // Safety check: ensure target matches session unless admin/internal
      if (dbUser && sessionInstitutionalId && dbUser.institutional_id !== sessionInstitutionalId) {
        return { error: "Unauthorized operation: account mismatch." };
      }
    }

    if (!dbUser && sessionInstitutionalId) {
      dbUser = await db.user.findUnique({
        where: { institutional_id: sessionInstitutionalId },
      });
    }

    if (!dbUser && sessionUser.id) {
      dbUser = await db.user.findFirst({
        where: { supabase_uid: sessionUser.id },
      });
    }

    if (!dbUser && sessionUser.email) {
      const emailPrefix = sessionUser.email.split("@")[0].toUpperCase();
      dbUser = await db.user.findUnique({
        where: { institutional_id: emailPrefix },
      });
    }

    if (!dbUser) {
      return { error: "User account could not be found." };
    }

    // Rule: all user roles except Students
    if (dbUser.role === "Student") {
      return { error: "Student accounts are not authorized to maintain an electronic signature." };
    }

    // Verify current account login password
    const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isPasswordValid) {
      return {
        error: "Incorrect password. Please enter the same password you use to log in to your AcadNexus account.",
      };
    }

    // Save the signature to user's account
    await db.user.update({
      where: { user_id: dbUser.user_id },
      data: {
        signature: signatureDataUrl,
      },
    });

    // Record in Audit Log
    try {
      await db.auditLog.create({
        data: {
          user_id: dbUser.user_id,
          action_performed: `User saved authorized drawn electronic signature for examination and TOS workflows.`,
          ip_address: "127.0.0.1",
        },
      });
    } catch (auditErr) {
      console.warn("Audit log creation non-fatal error:", auditErr);
    }

    // Revalidate relevant dashboard pages
    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/director");

    return {
      success: true,
      signature: signatureDataUrl,
    };
  } catch (error: any) {
    console.error("Error saving user signature:", error);
    return {
      error: error?.message || "An unexpected error occurred while saving your signature. Please try again.",
    };
  }
}

/**
 * Removes the saved electronic signature from the user's account with password confirmation.
 */
export async function deleteUserSignatureAction(
  password: string,
  targetUserId?: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!password || !password.trim()) {
      return { error: "Please enter your current account login password to remove your signature." };
    }

    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return { error: "You must be logged in to perform this action." };
    }

    const sessionInstitutionalId = sessionUser.user_metadata?.institutional_id;

    let dbUser = null;
    if (targetUserId) {
      dbUser = await db.user.findUnique({
        where: { user_id: targetUserId },
      });
      if (dbUser && sessionInstitutionalId && dbUser.institutional_id !== sessionInstitutionalId) {
        return { error: "Unauthorized operation: account mismatch." };
      }
    }

    if (!dbUser && sessionInstitutionalId) {
      dbUser = await db.user.findUnique({
        where: { institutional_id: sessionInstitutionalId },
      });
    }

    if (!dbUser && sessionUser.id) {
      dbUser = await db.user.findFirst({
        where: { supabase_uid: sessionUser.id },
      });
    }

    if (!dbUser && sessionUser.email) {
      const emailPrefix = sessionUser.email.split("@")[0].toUpperCase();
      dbUser = await db.user.findUnique({
        where: { institutional_id: emailPrefix },
      });
    }

    if (!dbUser) {
      return { error: "User account could not be found." };
    }

    if (dbUser.role === "Student") {
      return { error: "Student accounts are not authorized." };
    }

    const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isPasswordValid) {
      return {
        error: "Incorrect password. Please enter the same password you use to log in to your AcadNexus account.",
      };
    }

    await db.user.update({
      where: { user_id: dbUser.user_id },
      data: {
        signature: null,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          user_id: dbUser.user_id,
          action_performed: `User removed electronic signature from account.`,
          ip_address: "127.0.0.1",
        },
      });
    } catch {}

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/director");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting user signature:", error);
    return { error: error?.message || "Failed to remove signature." };
  }
}
