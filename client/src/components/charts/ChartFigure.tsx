import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartRow {
  label: string;
  value: string;
}

interface ChartFigureProps {
  /** What the chart shows, announced to assistive technology. */
  label: string;
  /** The same data the chart draws, as the non-visual alternative. */
  rows: ChartRow[];
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a chart with a real text alternative.
 *
 * A rendered chart is a picture: its SVG shapes carry no meaning for a screen
 * reader, and charting libraries emit `role="img"` nodes with no accessible
 * name. The drawing is therefore marked decorative and the same numbers are
 * exposed as a table, which is the alternative the data actually needs.
 */
export function ChartFigure({ label, rows, className, children }: ChartFigureProps) {
  return (
    <figure className={cn("m-0", className)} role="group" aria-label={label}>
      <div aria-hidden="true" className="h-full w-full">
        {children}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <th scope="row">Sem dados</th>
                <td>—</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
