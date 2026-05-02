import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  outline: "border border-border bg-background hover:bg-accent",
};
const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Btn = forwardRef<HTMLButtonElement, Props>(function Btn(
  { className, variant = "primary", size = "md", loading, icon, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});
