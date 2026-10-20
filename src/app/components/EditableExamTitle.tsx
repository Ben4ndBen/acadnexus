"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { updateExamTitleAction } from "@/app/actions/faculty";

interface EditableExamTitleProps {
  examId: number;
  initialTitle: string;
  userId: number;
  onTitleUpdated?: (newTitle: string) => void;
  className?: string;
  inputClassName?: string;
  isDarkBg?: boolean;
  canEdit?: boolean;
  tag?: "h1" | "h2" | "h3" | "h4" | "span" | "div";
}

export function EditableExamTitle({
  examId,
  initialTitle,
  userId,
  onTitleUpdated,
  className = "text-base font-extrabold text-slate-900",
  inputClassName,
  isDarkBg = false,
  canEdit = true,
  tag = "h3",
}: EditableExamTitleProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [editValue, setEditValue] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTitle);
    if (!isEditing) {
      setEditValue(initialTitle);
    }
  }, [initialTitle, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    setError(null);
    setEditValue(title);
    setIsEditing(true);
  };

  const handleCancel = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    setError(null);
    setEditValue(title);
    setIsEditing(false);
  };

  const handleSave = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const trimmed = editValue.trim();

    if (!trimmed) {
      setError("Examination name cannot be empty.");
      return;
    }

    if (trimmed.length > 150) {
      setError("Examination name cannot exceed 150 characters.");
      return;
    }

    if (trimmed === title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await updateExamTitleAction(examId, trimmed, userId);

      if (res.error) {
        setError(res.error);
        setIsSaving(false);
        return;
      }

      setTitle(trimmed);
      setIsEditing(false);
      setIsSaving(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);

      if (onTitleUpdated) {
        onTitleUpdated(trimmed);
      }

      router.refresh();
    } catch (err: any) {
      console.error("Failed to update examination name:", err);
      setError(err?.message || "Failed to update examination name.");
      setIsSaving(false);
    }
  };

  const Tag = tag;

  if (isEditing) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full space-y-2 py-1 max-w-2xl text-left"
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            maxLength={150}
            disabled={isSaving}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
              }
            }}
            placeholder="Enter examination name..."
            className={
              inputClassName ||
              `w-full px-3.5 py-2 text-sm font-bold rounded-xl border-2 transition-all outline-none ${
                isDarkBg
                  ? "bg-slate-800 border-emerald-500 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-400/30"
                  : "bg-white border-emerald-500 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
              }`
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Save Button */}
          <button
            type="button"
            disabled={isSaving || !editValue.trim()}
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="Save changes (Enter)"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleCancel}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              isDarkBg
                ? "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            }`}
            title="Cancel editing (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <span
            className={`text-[11px] ml-auto font-medium ${
              isDarkBg ? "text-slate-400" : "text-slate-400"
            }`}
          >
            {editValue.length}/150
          </span>
        </div>

        {error && (
          <p className="text-xs text-rose-500 font-semibold">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 flex-wrap text-left">
      <div
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        title={canEdit ? "Click to edit examination name" : undefined}
        onClick={handleStartEdit}
        onKeyDown={(e) => {
          if (canEdit && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleStartEdit(e);
          }
        }}
        className={`group/title inline-flex items-center gap-2 text-left rounded-lg p-1 -m-1 transition-all ${
          canEdit
            ? isDarkBg
              ? "cursor-pointer hover:bg-slate-800/80"
              : "cursor-pointer hover:bg-emerald-50/70"
            : ""
        }`}
      >
        <Tag
          className={`${className} transition-colors ${
            canEdit ? "group-hover/title:text-emerald-600" : ""
          }`}
        >
          {title}
        </Tag>

        {canEdit && (
          <span
            className={`opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded-md shrink-0 shadow-2xs ${
              isDarkBg
                ? "bg-slate-800 text-amber-400 border border-slate-700"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
            title="Click to edit examination name"
          >
            <Pencil className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {justSaved && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-fade-in shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Saved
        </span>
      )}
    </div>
  );
}
