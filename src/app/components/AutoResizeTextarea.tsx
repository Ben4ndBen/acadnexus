"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, minHeight = 56, onChange, className, style, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const adjustHeight = () => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      const newHeight = Math.max(el.scrollHeight, minHeight);
      el.style.height = `${newHeight}px`;
    };

    useEffect(() => {
      adjustHeight();
    }, [value, minHeight]);

    useEffect(() => {
      const handleResize = () => adjustHeight();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
      <textarea
        ref={internalRef}
        value={value}
        onChange={(e) => {
          adjustHeight();
          onChange?.(e);
        }}
        style={{
          ...style,
          minHeight: `${minHeight}px`,
        }}
        className={`resize-none overflow-hidden transition-[background-color,border-color,box-shadow,color] ${className || ""}`}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
