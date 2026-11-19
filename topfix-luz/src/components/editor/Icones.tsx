import type { Natureza } from "@/lib/tipos";

/** Ícones das quatro naturezas de fonte. */
export function IconeNatureza({ n, tam = 18 }: { n: Natureza; tam?: number }) {
  const comum = { width: tam, height: tam, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
  switch (n) {
    case "facho":
      return (
        <svg {...comum} aria-hidden>
          <path d="M12 3 L5 20 H19 Z" />
        </svg>
      );
    case "linear_dirigido":
      return (
        <svg {...comum} aria-hidden>
          <path d="M3 6 H21" />
          <path d="M6 6 V14 M10 6 V14 M14 6 V14 M18 6 V14" />
        </svg>
      );
    case "linha_difusa":
      return (
        <svg {...comum} aria-hidden>
          <path d="M3 12 H21" strokeWidth={3} />
        </svg>
      );
    case "difusa":
      return (
        <svg {...comum} aria-hidden>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      );
  }
}
