"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { 
  PenTool, RotateCcw, Check, Lock, Eye, EyeOff, ShieldCheck, 
  AlertCircle, X, Loader2, Sparkles, CheckCircle2, ArrowRight
} from "lucide-react";
import { saveUserSignatureAction } from "@/app/actions/signature";

export interface RequireSignatureModalProps {
  isOpen: boolean;
  actionType: "submit" | "approve";
  examTitle?: string;
  userId?: number;
  userName?: string;
  userRole?: string;
  departmentName?: string;
  onClose: () => void;
  onSignatureSavedAndProceed: (savedSignature: string) => void | Promise<void>;
}

export function RequireSignatureModal({
  isOpen,
  actionType,
  examTitle,
  userId,
  userName = "Academic Staff",
  userRole = "Faculty",
  departmentName = "Batanes State College",
  onClose,
  onSignatureSavedAndProceed,
}: RequireSignatureModalProps) {
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(false);

  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Setup canvas high-DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 520;
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#0f172a";
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isPreviewActive) {
      // Delay slightly to ensure modal is rendered and dimensions are available
      const timer = setTimeout(() => {
        setupCanvas();
      }, 50);
      const handleResize = () => setupCanvas();
      window.addEventListener("resize", handleResize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isOpen, isPreviewActive, setupCanvas]);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setHasDrawn(false);
      setPreviewDataUrl(null);
      setIsPreviewActive(false);
      setPassword("");
      setShowPassword(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setIsSavedSuccessfully(false);
    }
  }, [isOpen]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const clientX = (e as React.MouseEvent).clientX;
    const clientY = (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isPointerDownRef.current = true;
    const coords = getCoordinates(e);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    }
    setHasDrawn(true);
    setErrorMessage(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || !lastPointRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentPoint = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPointRef.current = currentPoint;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isPointerDownRef.current = false;
    lastPointRef.current = null;
  };

  const handleClearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setPreviewDataUrl(null);
    setIsPreviewActive(false);
    setErrorMessage(null);
  };

  const captureSignatureDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    return canvas.toDataURL("image/png");
  };

  const handleTogglePreview = () => {
    if (isPreviewActive) {
      setIsPreviewActive(false);
    } else {
      const dataUrl = captureSignatureDataUrl();
      if (!dataUrl) {
        setErrorMessage("Please draw your signature before previewing.");
        return;
      }
      setPreviewDataUrl(dataUrl);
      setIsPreviewActive(true);
      setErrorMessage(null);
    }
  };

  const handleEditRedraw = () => {
    setIsPreviewActive(false);
    setTimeout(() => {
      setupCanvas();
    }, 50);
  };

  const handleSaveAndContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const dataUrl = previewDataUrl || captureSignatureDataUrl();
    if (!dataUrl) {
      setErrorMessage("Please draw your signature before saving.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your current account login password to save your signature.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await saveUserSignatureAction(dataUrl, password, userId);

      if (result.success && result.signature) {
        setIsSavedSuccessfully(true);
        // Automatically continue the original action
        await onSignatureSavedAndProceed(result.signature);
      } else {
        setErrorMessage(result.error || "Failed to authorize and save signature. Please check your password.");
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while saving your signature.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const actionVerb = actionType === "submit" ? "Submit Examination" : "Approve Examination";
  const actionNoun = actionType === "submit" ? "Submission" : "Approval";
  const themeAccent = actionType === "submit" ? "emerald" : "amber";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r ${
          actionType === "submit" 
            ? "from-emerald-900 via-emerald-800 to-slate-900" 
            : "from-amber-900 via-amber-800 to-slate-900"
        } text-white`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              actionType === "submit" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
            } border border-white/10`}>
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  Signature Required Before {actionNoun}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 text-white">
                  One-Time Setup
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                {examTitle ? `For: ${examTitle}` : "Create your official electronic signature to proceed"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {/* Explanation Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-blue-900 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-950">
                You haven&apos;t created an electronic signature yet.
              </p>
              <p className="text-blue-800 text-xs leading-relaxed">
                A saved signature is required before you can {actionType === "submit" ? "submit an examination for review" : "approve an examination"}. Please draw your signature below and enter your current AcadNexus login password. Once saved, your signature will be permanently stored and automatically stamped onto your documents, and your {actionType} will continue immediately.
              </p>
            </div>
          </div>

          {/* Success Notification during automated continuation */}
          {isSavedSuccessfully && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 animate-bounce" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Signature successfully verified and saved!</span> Continuing with {actionNoun.toLowerCase()}...
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Signature Drawing / Preview Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <PenTool className="w-3.5 h-3.5 text-slate-500" />
                {isPreviewActive ? "Signature Document Preview" : "Signature Drawing Canvas"}
              </label>
              <div className="flex items-center gap-2">
                {!isPreviewActive ? (
                  <>
                    <button
                      type="button"
                      onClick={handleClearPad}
                      disabled={!hasDrawn || isSubmitting}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-rose-600 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-slate-100"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleTogglePreview}
                      disabled={!hasDrawn || isSubmitting}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40 transition-colors px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100"
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleEditRedraw}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Edit / Redraw
                  </button>
                )}
              </div>
            </div>

            {/* Drawing Canvas */}
            {!isPreviewActive ? (
              <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-2 overflow-hidden hover:border-slate-400 transition-colors">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-36 bg-white rounded-lg cursor-crosshair touch-none shadow-inner border border-slate-200"
                />
                {/* Guidelines */}
                <div className="absolute inset-x-4 bottom-10 pointer-events-none border-b border-dashed border-slate-300" />
                <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Draw your signature on the line above using mouse, touch, or stylus
                  </span>
                </div>
              </div>
            ) : (
              /* Preview Mode */
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Document Signatory Preview
                </div>
                <div className="w-full max-w-sm border-b-2 border-slate-800 pb-1 text-center bg-white p-3 rounded-lg shadow-sm">
                  {previewDataUrl ? (
                    <img 
                      src={previewDataUrl} 
                      alt="Signature preview" 
                      className="h-16 mx-auto object-contain" 
                    />
                  ) : (
                    <div className="h-16 flex items-center justify-center text-xs text-slate-400">
                      No signature captured
                    </div>
                  )}
                  <p className="font-bold text-xs uppercase text-slate-900 mt-1">
                    {userName}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {userRole} • {departmentName}
                  </p>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Electronic Signatory Template
                </p>
              </div>
            )}
          </div>

          {/* Account Password Confirmation */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Current Account Password
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Synchronized with your login password
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your current AcadNexus login password"
                disabled={isSubmitting || isSavedSuccessfully}
                className="w-full px-3.5 py-2.5 pr-10 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Please enter your current account password to authorize and save your signature. Use the same password you use to log in to your AcadNexus account.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isSavedSuccessfully}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!isPreviewActive && hasDrawn && (
              <button
                type="button"
                onClick={handleTogglePreview}
                disabled={isSubmitting || isSavedSuccessfully}
                className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                Preview First
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveAndContinue()}
              disabled={!hasDrawn || !password.trim() || isSubmitting || isSavedSuccessfully}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                actionType === "submit"
                  ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500"
                  : "bg-amber-600 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500"
              }`}
            >
              {isSubmitting || isSavedSuccessfully ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving & Continuing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Signature & {actionVerb}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
