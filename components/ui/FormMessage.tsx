import { cn } from "@/lib/cn";

type Props = {
  /** Success text, announced politely. */
  success?: string | null;
  /** Error text, announced assertively. */
  error?: string | null;
  /** Classes of both regions (spacing, size). */
  className?: string;
  /** Replaces the default green of the success region. */
  successClassName?: string;
};

/**
 * Feedback of a form. The two live regions stay mounted and each keeps its role, so screen
 * readers announce text that appears in them (swapping the role of one node is not announced).
 * `empty:hidden` takes an empty region out of the layout.
 */
export function FormMessage({ success, error, className, successClassName }: Props) {
  return (
    <>
      <p
        role="status"
        className={cn("m-0 text-sm empty:hidden", successClassName ?? "text-green", className)}
      >
        {success || null}
      </p>
      <p role="alert" className={cn("m-0 text-sm text-danger-text empty:hidden", className)}>
        {error || null}
      </p>
    </>
  );
}
