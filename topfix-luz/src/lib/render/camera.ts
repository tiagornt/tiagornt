import type { Pt } from "../tipos";

/** Câmera do quadro: s = pixels por metro; (ox, oy) = posição da origem do mundo na tela (px CSS). */
export interface Camera {
  s: number;
  ox: number;
  oy: number;
}

export const paraTela = (c: Camera, p: Pt): Pt => ({ x: p.x * c.s + c.ox, y: -p.y * c.s + c.oy });
export const paraMundo = (c: Camera, x: number, y: number): Pt => ({ x: (x - c.ox) / c.s, y: -(y - c.oy) / c.s });

/** Enquadra um retângulo do mundo numa área de w x h pixels, com margem. */
export function enquadrar(
  bb: { minX: number; minY: number; maxX: number; maxY: number },
  w: number,
  h: number,
  margem = 40,
): Camera {
  const bw = Math.max(0.5, bb.maxX - bb.minX);
  const bh = Math.max(0.5, bb.maxY - bb.minY);
  const s = Math.min((w - 2 * margem) / bw, (h - 2 * margem) / bh);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  return { s, ox: w / 2 - cx * s, oy: h / 2 + cy * s };
}
