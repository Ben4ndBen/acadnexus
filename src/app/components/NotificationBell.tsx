"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  getNotificationsAction, 
  markNotificationReadAction, 
  markAllNotificationsReadAction 
} from "@/app/actions/notifications";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Inbox, 
  X, 
  Loader2, 
  GraduationCap, 
  FileCheck, 
  AlertTriangle, 
  FileText,
  Award,
  Eye,
  Edit3
} from "lucide-react";

interface Notification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date | string;
}

interface NotificationBellProps {
  userId: number;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch initial notifications
  const fetchNotifications = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    const res = await getNotificationsAction(userId);
    if (res.success && res.notifications) {
      // Cast to match Notification type
      setNotifications(res.notifications as any[]);
    }
    if (showLoader) setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications(true);

    // 2. Setup Supabase Realtime Subscription
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime:public:NOTIFICATIONS:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "NOTIFICATIONS",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => {
              // Avoid duplicates
              if (prev.some((n) => n.notification_id === newNotif.notification_id)) {
                return prev;
              }
              return [newNotif, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedNotif = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) =>
                n.notification_id === updatedNotif.notification_id ? updatedNotif : n
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deletedNotif = payload.old as { notification_id: number };
            setNotifications((prev) =>
              prev.filter((n) => n.notification_id !== deletedNotif.notification_id)
            );
          }
        }
      )
      .subscribe();

    // 3. Setup Fallback Polling (every 10 seconds for mock/offline environment)
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 10000);

    // 4. Click outside to close dropdown listener
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userId]);

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n))
    );
    await markNotificationReadAction(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsReadAction(userId);
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Optimistic mark read
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === notif.notification_id ? { ...n, is_read: true } : n))
      );
      markNotificationReadAction(notif.notification_id).catch(console.error);
    }

    // 1. Check if returned exam reference
    const returnedExamMatch = notif.message ? notif.message.match(/\[ref:returned-exam:(\d+)\]/) : null;
    let returnedExamId: number | null = returnedExamMatch && returnedExamMatch[1] ? parseInt(returnedExamMatch[1], 10) : null;
    
    // Fallback if not matching explicit tag but title indicates Returned and message contains an exam ID
    if (!returnedExamId && notif.title.toLowerCase().includes("returned")) {
      const fallbackMatch = notif.message ? notif.message.match(/exam(?:ination)?\s*(?:#|id:?|no\.?)?\s*(\d+)/i) : null;
      if (fallbackMatch && fallbackMatch[1]) {
        returnedExamId = parseInt(fallbackMatch[1], 10);
      }
    }

    if (returnedExamId) {
      setIsOpen(false);
      const targetPath = `/dashboard/faculty/exams/${returnedExamId}/builder`;
      if (typeof window !== "undefined" && window.location.pathname === targetPath) {
        window.dispatchEvent(
          new CustomEvent("acadnexus:focus-revision-questions", {
            detail: { examId: returnedExamId },
          })
        );
      } else {
        router.push(targetPath);
      }
      return;
    }

    // 2. Check if student exam result reference
    const examMatch = notif.message ? notif.message.match(/\[ref:exam:(\d+)\]/) : null;
    if (examMatch && examMatch[1]) {
      const studentExamId = parseInt(examMatch[1], 10);
      window.dispatchEvent(
        new CustomEvent("acadnexus:open-exam-result", {
          detail: { studentExamId },
        })
      );
      setIsOpen(false);
      return;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Helper to get relative time
  const getRelativeTime = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Helper to pick notification icon based on title
  const getNotificationIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("score updated") || t.includes("grade") || t.includes("result")) {
      return (
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
          <Award className="w-5 h-5" />
        </div>
      );
    }
    if (t.includes("upcoming") || t.includes("exam scheduled") || t.includes("test")) {
      return (
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <GraduationCap className="w-5 h-5" />
        </div>
      );
    }
    if (t.includes("approved")) {
      return (
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
          <FileCheck className="w-5 h-5" />
        </div>
      );
    }
    if (t.includes("returned")) {
      return (
        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
        <FileText className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border transition-all duration-200 focus:outline-none flex items-center justify-center ${
          isOpen
            ? "bg-slate-100 border-slate-300 text-slate-800"
            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800"
        }`}
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#7A151A] text-white text-[9px] font-extrabold h-4.5 min-w-4.5 rounded-full flex items-center justify-center px-1 border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Container */}
      {isOpen && (
        <div className="absolute right-0 mt-3.5 w-80 sm:w-96 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col origin-top-right transition-all duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-[#7A151A]/10 text-[#7A151A] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-[#7A151A] hover:text-[#5F1014] flex items-center gap-1.5 hover:underline bg-transparent border-0 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="overflow-y-auto max-h-[320px] divide-y divide-slate-100 scrollbar-thin">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="text-xs font-medium">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-400 gap-3">
                <div className="bg-slate-50 p-4 rounded-full border border-slate-100">
                  <Inbox className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                    You don't have any notifications at the moment.
                  </p>
                </div>
              </div>
            ) : (
            notifications.map((notif) => {
                const examMatch = notif.message ? notif.message.match(/\[ref:exam:(\d+)\]/) : null;
                const isExamUpdate = !!examMatch;

                const returnedExamMatch = notif.message ? notif.message.match(/\[ref:returned-exam:(\d+)\]/) : null;
                const isReturnedExam = !!returnedExamMatch || (notif.title.toLowerCase().includes("returned") && notif.title.toLowerCase().includes("exam"));

                const isClickable = isExamUpdate || isReturnedExam;

                let cleanMessage = notif.message || "";
                cleanMessage = cleanMessage
                  .replace(/\s*\[ref:returned-exam:\d+\]/g, "")
                  .replace(/\s*\[ref:exam:\d+\]/g, "")
                  .replace(/\.?\s*Comments:\s*No comments provided\.?/gi, ".")
                  .replace(/\.?\s*Remarks:\s*""/gi, "")
                  .replace(/\.?\s*Comments:\s*\{.*$/gi, "")
                  .trim();

                if (cleanMessage.includes("{") && cleanMessage.includes("}")) {
                  try {
                    cleanMessage = cleanMessage.replace(/\{[^{}]*\}/g, (jsonStr) => {
                      try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.general) return parsed.general;
                        const values = Object.values(parsed).filter(Boolean);
                        return values.join("; ");
                      } catch {
                        return "";
                      }
                    });
                  } catch {}
                }

                cleanMessage = cleanMessage.replace(/\.\.+/g, ".").replace(/\s\s+/g, " ").trim();

                return (
                  <div
                    key={notif.notification_id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex gap-3.5 p-4 transition-colors relative hover:bg-slate-50/80 group ${
                      isClickable ? "cursor-pointer" : ""
                    } ${!notif.is_read ? (isReturnedExam ? "bg-rose-50/20" : "bg-amber-50/15") : ""}`}
                  >
                    {/* Status Indicator Bar */}
                    {!notif.is_read && (
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${isReturnedExam ? "bg-rose-600" : "bg-[#7A151A]"}`} />
                    )}

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notif.title)}
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs font-bold leading-snug ${!notif.is_read ? "text-slate-900" : "text-slate-600"}`}>
                            {notif.title}
                          </p>
                          {isReturnedExam && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase tracking-wider">
                              Action Required
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {getRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${!notif.is_read ? "text-slate-800" : "text-slate-500"}`}>
                        {cleanMessage}
                      </p>
                      {isReturnedExam && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200 group-hover:bg-rose-100 group-hover:border-rose-300 transition-all">
                          <Edit3 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Open in Step 2 to Edit Questions →</span>
                        </div>
                      )}
                      {isExamUpdate && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 group-hover:text-emerald-800 group-hover:underline">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Click to view your updated result</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions (Mark as Read) */}
                    {!notif.is_read && (
                      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(e, notif.notification_id);
                          }}
                          className="p-1 text-slate-400 hover:text-[#7A151A] bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-lg transition-all"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
