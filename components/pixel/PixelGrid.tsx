import type { CSSProperties } from "react";

export type PixelGridProps = {
  /** Mask rows, one char per cell (e.g. `".##..#"`). `.` and space are empty. */
  rows: string[];
  /** Char to color. */
  palette: Record<string, string>;
  /** Cell size in px. */
  cell: number;
  gap?: number;
  /** Adds the inset light/dark bevel to every cell. */
  bevel?: boolean;
  /** Accessible name; without it the grid is decorative. */
  label?: string;
  /** `bead` draws round cells with an inset ring (see BeadArt). */
  shape?: "square" | "bead";
};

/** Pixel art drawn from a character mask, as in the design files. */
export function PixelGrid({
  rows,
  palette,
  cell,
  gap = 0,
  bevel = false,
  label,
  shape = "square",
}: PixelGridProps) {
  const columns = Math.max(0, ...rows.map((r) => r.length));
  const edge = Math.max(1, Math.round(cell / 8));
  const cellShadow =
    shape === "bead"
      ? `inset 0 0 0 ${edge}px rgba(0, 0, 0, 0.28)`
      : bevel
        ? `inset ${edge}px ${edge}px 0 rgba(255, 255, 255, 0.38), inset -${edge}px -${edge}px 0 rgba(0, 0, 0, 0.32)`
        : undefined;

  const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, ${cell}px)`,
    gridAutoRows: `${cell}px`,
    gap,
  };

  return (
    <div
      style={grid}
      className="w-fit"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {rows.flatMap((row, y) =>
        Array.from({ length: columns }, (_, x) => {
          const color = palette[row[x] ?? "."];
          return (
            <span
              key={`${y}-${x}`}
              className={shape === "bead" && color ? "bead rounded-full" : undefined}
              style={color ? { background: color, boxShadow: cellShadow } : undefined}
            />
          );
        }),
      )}
    </div>
  );
}
