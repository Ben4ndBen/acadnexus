"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getNotificationsAction(userId: number) {
  try {
    const notifications = await db.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return { success: true, notifications };
  } catch (err: any) {
    console.error("Error fetching notifications:", err);
    return { success: false, error: err.message || "Failed to fetch notifications." };
  }
}

export async function markNotificationReadAction(notificationId: number) {
  try {
    const updated = await db.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });
    
    // Revalidate relevant pages
    revalidatePath("/dashboard/student");
    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/director");

    return { success: true, notification: updated };
  } catch (err: any) {
    console.error("Error marking notification read:", err);
    return { success: false, error: err.message || "Failed to update notification." };
  }
}

export async function markAllNotificationsReadAction(userId: number) {
  try {
    await db.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    revalidatePath("/dashboard/student");
    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/director");

    return { success: true };
  } catch (err: any) {
    console.error("Error marking all notifications read:", err);
    return { success: false, error: err.message || "Failed to update notifications." };
  }
}
