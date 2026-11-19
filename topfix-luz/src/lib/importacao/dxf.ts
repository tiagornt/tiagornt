// Leitura de DXF para o fundo do ambiente. O DXF entra como geometria de referência (linhas e polilinhas).
// Não tentamos adivinhar parede: o usuário promove trechos a parede ou desenha por cima.

import DxfParser from "dxf-parser";

export const LIMITE_BYTES = 15 * 1024 * 1024;
export const LIMITE_ENTIDADES = 50000;

export interface PolilinhaBruta {
  camada: string;
  pts: number[];
  fechado: boolean;
}

export interface DxfLido {
  polilinhas: PolilinhaBruta[];
  camadas: { nome: string; entidades: number; sugerida: boolean }[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  unidadeArquivo: string | null; // $INSUNITS
  ignoradas: number;
  foraDaMargem: number;
}

type Mat = [number, number, number, number, number, number]; // a b c d e f: x' = a x + c y + e; y' = b x + d y + f
const ID: Mat = [1, 0, 0, 1, 0, 0];
const mult = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const aplica = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const NOMES_IGNORAR = /(cota|dim|texto|text|hatch|hachura|carimbo|selo|legenda|layout|viewport|defpoints)/i;

const UNIDADES_INSUNITS: Record<number, string> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ent = any;

function arco(cx: number, cy: number, r: number, a0: number, a1: number): number[] {
  let fim = a1;
  while (fim <= a0) fim += Math.PI * 2;
  const n = Math.max(6, Math.ceil(((fim - a0) / (Math.PI * 2)) * 48));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((fim - a0) * i) / n;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
}

/** Vértices de polilinha com bulge (arcos) viram pontos. */
function comBulge(vs: { x: number; y: number; bulge?: number }[], fechado: boolean): number[] {
  const out: number[] = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const a = vs[i];
    out.push(a.x, a.y);
    const temProx = i < n - 1 || fechado;
    if (!temProx || !a.bulge) continue;
    const b = vs[(i + 1) % n];
    const ang = 4 * Math.atan(a.bulge);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-12) continue;
    const r = d / (2 * Math.sin(ang / 2));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const h = r * Math.cos(ang / 2);
    const nx = -(b.y - a.y) / d;
    const ny = (b.x - a.x) / d;
    const cx = mx + nx * h;
    const cy = my + ny * h;
    const a0 = Math.atan2(a.y - cy, a.x - cx);
    const passos = Math.max(4, Math.ceil(Math.abs(ang) / (Math.PI / 16)));
    for (let k = 1; k < passos; k++) {
      const t = a0 + (ang * k) / passos;
      out.push(cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t));
    }
  }
  return out;
}

export function lerDxf(texto: string): DxfLido {
  const parser = new DxfParser();
  const dxf = parser.parseSync(texto);
  if (!dxf) throw new Error("Não foi possível ler o DXF.");
  const insunits = (dxf.header as Record<string, unknown> | undefined)?.["$INSUNITS"] as number | undefined;
  const blocos = (dxf.blocks ?? {}) as Record<string, { entities?: Ent[]; position?: { x: number; y: number } }>;
  const saida: PolilinhaBruta[] = [];
  let ignoradas = 0;
  let total = 0;

  const empurra = (camada: string, pts: number[], fechado: boolean, m: Mat) => {
    if (pts.length < 4) return;
    const t: number[] = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = aplica(m, pts[i], pts[i + 1]);
      t[i] = x;
      t[i + 1] = y;
    }
    saida.push({ camada, pts: t, fechado });
  };

  const processa = (ents: Ent[], m: Mat, camadaPai: string | null, prof: number) => {
    for (const e of ents) {
      total++;
      if (total > LIMITE_ENTIDADES * 2) throw new Error(`O arquivo passa de ${LIMITE_ENTIDADES.toLocaleString("pt-BR")} entidades.`);
      const camada = e.layer && e.layer !== "0" ? e.layer : camadaPai ?? e.layer ?? "0";
      switch (e.type) {
        case "LINE":
          if (e.vertices?.length >= 2) empurra(camada, [e.vertices[0].x, e.vertices[0].y, e.vertices[1].x, e.vertices[1].y], false, m);
          break;
        case "LWPOLYLINE":
        case "POLYLINE": {
          const vs = (e.vertices ?? []).filter((v: Ent) => Number.isFinite(v.x) && Number.isFinite(v.y));
          const fechado = !!(e.shape || e.closed);
          empurra(camada, comBulge(vs, fechado), fechado, m);
          break;
        }
        case "CIRCLE":
          empurra(camada, arco(e.center.x, e.center.y, e.radius, 0, Math.PI * 2 - 1e-6), true, m);
          break;
        case "ARC":
          empurra(camada, arco(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle), false, m);
          break;
        case "ELLIPSE": {
          const mx = e.majorAxisEndPoint.x;
          const my = e.majorAxisEndPoint.y;
          const R = Math.hypot(mx, my);
          const rot = Math.atan2(my, mx);
          const r2 = R * e.axisRatio;
          const a0 = e.startAngle ?? 0;
          let a1 = e.endAngle ?? Math.PI * 2;
          if (a1 <= a0) a1 += Math.PI * 2;
          const pts: number[] = [];
          const n = 40;
          for (let i = 0; i <= n; i++) {
            const a = a0 + ((a1 - a0) * i) / n;
            const x = R * Math.cos(a);
            const y = r2 * Math.sin(a);
            pts.push(e.center.x + x * Math.cos(rot) - y * Math.sin(rot), e.center.y + x * Math.sin(rot) + y * Math.cos(rot));
          }
          empurra(camada, pts, false, m);
          break;
        }
        case "SPLINE": {
          const ps = (e.fitPoints?.length ? e.fitPoints : e.controlPoints) ?? [];
          empurra(camada, ps.flatMap((p: Ent) => [p.x, p.y]), !!e.closed, m);
          break;
        }
        case "INSERT": {
          const b = blocos[e.name];
          if (!b?.entities || prof > 6) {
            ignoradas++;
            break;
          }
          const sx = e.xScale ?? 1;
          const sy = e.yScale ?? 1;
          const r = ((e.rotation ?? 0) * Math.PI) / 180;
          const base = b.position ?? { x: 0, y: 0 };
          const cols = Math.max(1, e.columnCount ?? 1);
          const rows = Math.max(1, e.rowCount ?? 1);
          for (let ci = 0; ci < cols; ci++)
            for (let ri = 0; ri < rows; ri++) {
              const ox = e.position.x + ci * (e.columnSpacing ?? 0);
              const oy = e.position.y + ri * (e.rowSpacing ?? 0);
              // T(pos) R S T(-base)
              const local: Mat = mult(
                mult([1, 0, 0, 1, ox, oy], [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
                mult([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -base.x, -base.y]),
              );
              processa(b.entities, mult(m, local), camada, prof + 1);
            }
          break;
        }
        default:
          ignoradas++; // textos, cotas, hachuras, pontos, sólidos...
      }
    }
  };
  processa((dxf.entities ?? []) as Ent[], ID, null, 0);
  if (saida.length > LIMITE_ENTIDADES)
    throw new Error(`O arquivo tem ${saida.length.toLocaleString("pt-BR")} linhas, acima do limite de ${LIMITE_ENTIDADES.toLocaleString("pt-BR")}.`);
  if (!saida.length) throw new Error("O DXF não tem linhas ou polilinhas para usar como base.");

  // descarta entidades muito fora do conjunto (carimbo, folhas, lixo distante)
  const cx: number[] = [];
  const cy: number[] = [];
  for (const s of saida) {
    cx.push(s.pts[0]);
    cy.push(s.pts[1]);
  }
  const pct = (arr: number[], p: number) => {
    const o = [...arr].sort((a, b) => a - b);
    return o[Math.min(o.length - 1, Math.max(0, Math.floor(p * (o.length - 1))))];
  };
  const x2 = pct(cx, 0.02);
  const x98 = pct(cx, 0.98);
  const y2 = pct(cy, 0.02);
  const y98 = pct(cy, 0.98);
  const mxg = Math.max(x98 - x2, y98 - y2) * 0.6 + 1e-9;
  const dentro = (s: PolilinhaBruta) => {
    for (let i = 0; i < s.pts.length; i += 2) {
      const x = s.pts[i];
      const y = s.pts[i + 1];
      if (x < x2 - mxg || x > x98 + mxg || y < y2 - mxg || y > y98 + mxg) return false;
    }
    return true;
  };
  const filtradas = saida.filter(dentro);
  const foraDaMargem = saida.length - filtradas.length;

  const contagem = new Map<string, number>();
  for (const s of filtradas) contagem.set(s.camada, (contagem.get(s.camada) ?? 0) + 1);
  const camadas = [...contagem.entries()]
    .map(([nome, entidades]) => ({ nome, entidades, sugerida: !NOMES_IGNORAR.test(nome) }))
    .sort((a, b) => b.entidades - a.entidades);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of filtradas)
    for (let i = 0; i < s.pts.length; i += 2) {
      minX = Math.min(minX, s.pts[i]);
      maxX = Math.max(maxX, s.pts[i]);
      minY = Math.min(minY, s.pts[i + 1]);
      maxY = Math.max(maxY, s.pts[i + 1]);
    }
  return {
    polilinhas: filtradas,
    camadas,
    bbox: { minX, minY, maxX, maxY },
    unidadeArquivo: insunits ? UNIDADES_INSUNITS[insunits] ?? null : null,
    ignoradas,
    foraDaMargem,
  };
}

export const UNIDADES = [
  { id: "mm", nome: "Milímetros (mm)", fator: 0.001 },
  { id: "cm", nome: "Centímetros (cm)", fator: 0.01 },
  { id: "m", nome: "Metros (m)", fator: 1 },
  { id: "in", nome: "Polegadas (in)", fator: 0.0254 },
  { id: "ft", nome: "Pés (ft)", fator: 0.3048 },
  { id: "pers", nome: "Personalizada (pela medida)", fator: NaN },
];

/** Palpite de unidade pela largura do desenho (casas costumam ter de 3 a 60 m). */
export function palpiteUnidade(largura: number): string {
  if (largura > 3000) return "mm";
  if (largura > 300) return "cm";
  return "m";
}
