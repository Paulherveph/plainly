import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium text-sm outline-none transition-[transform,background-color,border-color,box-shadow,color] duration-150 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.1),var(--shadow-glow)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_10px_40px_-6px_var(--brand-glow)]",
        outline:
          "border border-line-strong bg-[color-mix(in_oklab,var(--surface)_62%,transparent)] backdrop-blur-md hover:bg-surface-2",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-2",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        destructive: "bg-critical text-white hover:brightness-110",
        link: "text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-9 rounded-[10px] text-muted-foreground hover:text-foreground",
        "icon-sm": "size-8 rounded-lg text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
