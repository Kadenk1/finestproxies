import Link from "next/link";
import type { ComponentProps } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

/**
 * Button styled as a Next.js <Link>. Base UI's Button takes a `render`
 * element instead of Radix's `asChild` pattern — this wraps that so call
 * sites read like a normal button.
 */
type LinkButtonProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & { className?: string };

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  ...linkProps
}: LinkButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      render={
        <Link href={href} {...linkProps}>
          {children}
        </Link>
      }
    />
  );
}
