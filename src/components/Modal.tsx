import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "lg",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: "md" | "lg" | "xl" | "2xl";
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const widths = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-h-[90vh] overflow-hidden flex flex-col rounded-lg border border-border bg-card",
          widths[width],
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}
