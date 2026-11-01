"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { 
  PenTool, RotateCcw, Check, Lock, Eye, EyeOff, ShieldCheck, 
  AlertCircle, CheckCircle, Trash2, Eye as PreviewIcon, Edit3, 
  Loader2, Sparkles, FileCheck2
} from "lucide-react";
import { saveUserSignatureAction, deleteUserSignatureAction } from "@/app/actions/signature";

export interface MySignatureSectionProps {
  initialSignature?: string | null;
  currentSignature?: string | null;
  userId?: number;
  userFullName?: string;
  userName?: string;
  userRoleTitle?: string;
  userRole?: string;
  departmentName?: string;
  onSignatureSaved?: (signatureUrl: string) => void;
  onSignatureDeleted?: () => void;
  className?: string;
}

export function MySignatureSection({
  initialSignature,
  currentSignature: currentSignatureProp,
  userId,
  userFullName,
  userName,
  userRoleTitle,
  userRole,
  departmentName,
  onSignatureSaved,
  onSignatureDeleted,
  className = "",
}: MySignatureSectionProps) {
  const resolvedInitialSig = currentSignatureProp !== undefined ? currentSignatureProp : initialSignature;
  const effectiveFullName = userName || userFullName || "Faculty Member";
  const effectiveRoleTitle = userRole || userRoleTitle || "Instructor / Academic Staff";

  // Current saved signature state
  const [currentSignature, setCurrentSignature] = useState<string | null>(resolvedInitialSig || null);
  
  // Drawing states
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(!resolvedInitialSig);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(false);

  // Password confirmation states
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Deletion modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Canvas refs and drawing context
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Synchronize initialSignature if updated externally
  useEffect(() => {
    if (resolvedInitialSig !== undefined) {
      setCurrentSignature(resolvedInitialSig);
      if (resolvedInitialSig) {
        setIsDrawingMode(false);
      }
    }
  }, [resolvedInitialSig]);

  // Canvas sizing and high-DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Use actual CSS dimensions
    const width = rect.width || 560;
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#0f172a"; // Crisp institutional deep navy/black ink
    }
  }, []);

  useEffect(() => {
    if (isDrawingMode && !isPreviewActive) {
      setupCanvas();
      const handleResize = () => setupCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isDrawingMode, isPreviewActive, setupCanvas]);

  // Coordinate calculation relative to canvas rect
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ("clientX" in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isPointerDownRef.current = true;
    const coords = getCoordinates(e);
    lastPointRef.current = coords;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    // Draw initial dot in case of single tap/click
    ctx.arc(coords.x, coords.y, 1.2, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    setHasDrawn(true);
    setStatusMessage(null);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    const last = lastPointRef.current || coords;

    // Smooth midpoint curve
    const midX = (last.x + coords.x) / 2;
    const midY = (last.y + coords.y) / 2;

    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    lastPointRef.current = null;
  };

  // Clear Canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setPreviewDataUrl(null);
    setIsPreviewActive(false);
    setStatusMessage(null);
  };

  // Generate PNG Data URL with transparent background
  const captureSignatureDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;

    // Export high-resolution transparent PNG
    return canvas.toDataURL("image/png");
  };

  // Toggle Preview Mode
  const handleTogglePreview = () => {
    if (isPreviewActive) {
      setIsPreviewActive(false);
    } else {
      const dataUrl = captureSignatureDataUrl();
      if (!dataUrl) {
        setStatusMessage({ type: "error", text: "Please draw your signature before previewing." });
        return;
      }
      setPreviewDataUrl(dataUrl);
      setIsPreviewActive(true);
      setStatusMessage(null);
    }
  };

  // Back to Edit / Redraw
  const handleEditRedraw = () => {
    setIsPreviewActive(false);
    // Keep existing drawing or let them continue drawing on the canvas
    setTimeout(() => {
      // Re-setup canvas context if needed
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = "#0f172a";
        }
      }
    }, 50);
  };

  // Save Signature
  const handleSaveSignature = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const dataUrl = previewDataUrl || captureSignatureDataUrl();
    if (!dataUrl) {
      setStatusMessage({ type: "error", text: "Please draw your signature before saving." });
      return;
    }

    if (!password.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please enter your current account login password to authorize and save your signature.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await saveUserSignatureAction(dataUrl, password, userId);

      if (result.success && result.signature) {
        setCurrentSignature(result.signature);
        setIsDrawingMode(false);
        setIsPreviewActive(false);
        setPassword("");
        setStatusMessage({
          type: "success",
          text: "Your official electronic signature has been successfully saved and attached to your account!",
        });
        if (onSignatureSaved) {
          onSignatureSaved(result.signature);
        }
      } else {
        setStatusMessage({
          type: "error",
          text: result.error || "Failed to save signature. Please check your password.",
        });
      }
    } catch (err: any) {
      console.error("Save signature error:", err);
      setStatusMessage({
        type: "error",
        text: err?.message || "An unexpected error occurred while saving your signature.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Signature
  const handleDeleteSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword.trim()) {
      setStatusMessage({ type: "error", text: "Please enter your password to confirm removal." });
      return;
    }

    setIsDeleting(true);
    setStatusMessage(null);

    try {
      const result = await deleteUserSignatureAction(deletePassword, userId);
      if (result.success) {
        setCurrentSignature(null);
        setShowDeleteConfirm(false);
        setDeletePassword("");
        setIsDrawingMode(true);
        setHasDrawn(false);
        setPreviewDataUrl(null);
        setIsPreviewActive(false);
        setStatusMessage({
          type: "success",
          text: "Your electronic signature has been removed from your account.",
        });
        if (onSignatureDeleted) {
          onSignatureDeleted();
        }
      } else {
        setStatusMessage({
          type: "error",
          text: result.error || "Failed to remove signature. Incorrect password.",
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Failed to delete signature." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <PenTool className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  My Official Electronic Signature
                </h3>
                {currentSignature && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Active on File
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Authorized drawn signature for Table of Specifications (TOS) and Examination approvals.
              </p>
            </div>
          </div>

          {currentSignature && !isDrawingMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(true);
                  setIsPreviewActive(false);
                  setHasDrawn(false);
                  setPreviewDataUrl(null);
                  setStatusMessage(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Change / Redraw
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                title="Remove signature"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border animate-in fade-in duration-200 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* STATE 1: CURRENT SIGNATURE PREVIEW (WHEN SAVED) */}
        {currentSignature && !isDrawingMode && (
          <div className="mt-6 space-y-4">
            <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group">
              {/* Subtle official watermark pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#0f172a08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              <div className="relative z-10 max-w-md w-full space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Official Institutional Signatory Preview
                </span>

                {/* Signature display container */}
                <div className="h-24 sm:h-28 flex items-end justify-center px-4 py-2">
                  <img
                    src={currentSignature}
                    alt="Authorized Electronic Signature"
                    className="max-h-24 max-w-full object-contain filter drop-shadow-xs transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Signatory line */}
                <div className="border-t border-slate-900 pt-2 text-center w-full">
                  <p className="font-extrabold text-xs uppercase tracking-wide text-slate-900">
                    {effectiveFullName}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {effectiveRoleTitle}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                This drawn signature will automatically appear on exams and TOS approved by you.
              </div>
            </div>
          </div>
        )}

        {/* STATE 2: DRAWING PAD & SAVE WORKFLOW */}
        {isDrawingMode && (
          <div className="mt-6 space-y-5">
            {/* Friendly, Professional Clear Instruction */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
              <div className="bg-amber-100/90 text-amber-800 p-2 rounded-xl shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Draw and Authorize Your Signature
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Please draw your signature in the space below and enter your current account password to save it. Use the same password you use to log in to your AcadNexus account.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span>
                    <strong>Synchronized Security:</strong> Your signature is always protected by your primary AcadNexus account password. Whenever you change your login password, your signature authorization will automatically use the new password.
                  </span>
                </div>
              </div>
            </div>

            {/* PREVIEW MODE or DRAWING PAD */}
            {isPreviewActive && previewDataUrl ? (
              /* Preview Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Signature Preview (As Seen on Documents)
                  </span>
                  <button
                    type="button"
                    onClick={handleEditRedraw}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit / Redraw
                  </button>
                </div>

                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs">
                  <div className="max-w-md w-full space-y-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Prepared / Reviewed / Approved by:
                    </p>
                    <div className="h-24 flex items-end justify-center px-4 py-1">
                      <img
                        src={previewDataUrl}
                        alt="Signature Preview"
                        className="max-h-20 max-w-full object-contain"
                      />
                    </div>
                    <div className="border-t border-slate-900 pt-2 text-center w-full">
                      <p className="font-extrabold text-xs uppercase tracking-wide text-slate-900">
                        {effectiveFullName}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {effectiveRoleTitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Interactive Drawing Canvas */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-slate-500" />
                    Signature Drawing Pad
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Use mouse, stylus, or touch screen
                    </span>
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={!hasDrawn}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Pad
                    </button>
                  </div>
                </div>

                {/* Canvas Container */}
                <div className="relative w-full bg-white border-2 border-dashed border-slate-300 hover:border-slate-400 focus-within:border-indigo-500 rounded-2xl overflow-hidden transition-all shadow-inner touch-none cursor-crosshair">
                  {/* Subtle Sign-Here Indicator */}
                  <div className="absolute left-6 bottom-7 pointer-events-none select-none text-slate-300 text-sm font-serif">
                    ✕
                  </div>
                  {/* Guideline */}
                  <div className="absolute left-10 right-6 bottom-7 border-b border-slate-200 pointer-events-none select-none" />
                  <div className="absolute right-6 bottom-2.5 pointer-events-none select-none text-[10px] text-slate-300 font-mono tracking-wider">
                    SIGN ABOVE THIS LINE
                  </div>

                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                      <div className="text-center space-y-1 text-slate-400">
                        <PenTool className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
                        <p className="text-xs font-medium">Draw your signature here</p>
                      </div>
                    </div>
                  )}

                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[180px] block relative z-10"
                    style={{ touchAction: "none" }}
                  />
                </div>
              </div>
            )}

            {/* PASSWORD INPUT & CONFIRMATION SECTION */}
            <form onSubmit={handleSaveSignature} className="pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    Enter Your Current Account Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your AcadNexus login password"
                      required
                      autoComplete="current-password"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 px-3.5 py-2.5 rounded-xl transition-all outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 sm:justify-end">
                  {/* Preview Toggle Button */}
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    disabled={!hasDrawn && !previewDataUrl}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      isPreviewActive
                        ? "bg-slate-100 text-slate-700 border-slate-300"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {isPreviewActive ? (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Signature
                      </>
                    ) : (
                      <>
                        <PreviewIcon className="w-3.5 h-3.5 text-indigo-600" />
                        Preview Signature
                      </>
                    )}
                  </button>

                  {/* Cancel Button if user already had a saved signature */}
                  {currentSignature && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawingMode(false);
                        setIsPreviewActive(false);
                        setPassword("");
                        setStatusMessage(null);
                      }}
                      className="px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {/* Save Signature Button */}
                  <button
                    type="submit"
                    disabled={(!hasDrawn && !previewDataUrl) || !password.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        Saving Signature...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Save Signature
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Remove Electronic Signature</h4>
                <p className="text-xs text-slate-500">This will delete your official signature from your account.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              To confirm removal, please enter your current account login password:
            </p>

            <form onSubmit={handleDeleteSignature} className="space-y-4">
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter account password"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-medium text-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
              />

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deletePassword.trim() || isDeleting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white"
                >
                  {isDeleting ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
