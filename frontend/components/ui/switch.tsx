"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border border-white/10 p-[2px] transition-all duration-300",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lava-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-lava-500/50 data-[state=checked]:bg-lava-gradient data-[state=checked]:shadow-[0_0_16px_-2px_rgba(255,106,61,0.55)] data-[state=unchecked]:bg-white/[0.06]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-gray-400"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
