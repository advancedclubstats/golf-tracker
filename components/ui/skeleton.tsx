import { cn } from "@/lib/utils";

/**
 * Low-key loading placeholder. A foreground-alpha fill (so it adapts to the
 * warm-paper light theme and the dark fairway focused flows alike) with a
 * gentle pulse. Used by the route-level `loading.tsx` fallbacks that make tab
 * navigation paint instantly while the Server Component streams in.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-foreground/[0.07] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
