import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "outlineLight" | "whatsapp";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary: "border border-brand-600 bg-white text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-600",
  outlineLight: "border border-white/70 bg-transparent text-white hover:bg-white hover:text-brand-700 focus-visible:outline-white",
  whatsapp: "bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700",
};

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant };

export function ButtonLink({ className = "", variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={`inline-flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${variants[variant]} ${className}`} {...props} />;
}
