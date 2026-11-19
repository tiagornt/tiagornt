// Ponto a ponto simplificado (seção 4.6): só componente direta.
// d = sqrt((xP-xS)² + (yP-yS)² + (zP-zS)²)
// cos θ = h / d (plano horizontal); no vertical, cos θ = (S-P)·n / d
// I(α) = I0 x cos α, se α <= α_abe; senão 0
// E(S→P) = I(α) x cos θ / d²  (equivale a I(α) x cos³ θ / h² no plano horizontal)
// E_P = Σ E(S→P)

import { bloqueado, bbox, pontoNoPoligono, rad, recuarPoligono, type Seg } from "../geometria";
import type { Fonte, Pt } from "../tipos";

export const PASSO_LINEAR = 0.2;

type V3 = { x: number; y: number; z: number };

export interface Emissor {
  p: V3;
  eixo: V3; // unitário
  I0: number; // cd
  meiaAbertura: number; // rad
  codigo: string;
}

export interface Conversao {
  codigo: string;
  texto: string;
}

const normaliza = (v: V3): V3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

/** Ângulo sólido de um facho de revolução com meia abertura a. */
export const anguloSolido = (meia: number) => 2 * Math.PI * (1 - Math.cos(meia));

/**
 * Converte as fontes do desenho em emissores pontuais para o cálculo.
 * Lineares viram pontos a cada 0,20 m com o fluxo dividido.
 * Retorna também a lista de conversões (para o memorial) e as fontes sem dado.
 */
export function emissoresDasFontes(fontes: Fonte[]): {
  emissores: Emissor[];
  conversoes: Conversao[];
  semDado: string[];
} {
  const emissores: Emissor[] = [];
  const conversoes: Conversao[] = [];
  const semDado: string[] = [];
  const vistos = new Set<string>();
  for (const f of fontes) {
    if (!f.visivel) continue;
    const temFluxo = f.fluxo != null && f.fluxo > 0;
    const temI = f.intensidadeCd != null && f.intensidadeCd > 0;
    if (!temFluxo && !temI) {
      if (!semDado.includes(f.codigo)) semDado.push(f.codigo);
      continue;
    }
    const difusa = f.natureza === "difusa" || f.natureza === "linha_difusa";
    const linear = f.natureza === "linear_dirigido" || f.natureza === "linha_difusa";
    const meia = difusa ? Math.PI / 2 : rad(Math.max(1, Math.min(179, f.abertura)) / 2);
    const tilt = difusa ? 0 : rad(f.tilt);
    const r = rad(f.rotacao);
    const eixo = normaliza({ x: Math.sin(tilt) * Math.cos(r), y: Math.sin(tilt) * Math.sin(r), z: -Math.cos(tilt) });
    const n = linear ? Math.max(1, Math.round(f.comprimento / PASSO_LINEAR)) : 1;
    let I0total: number;
    let texto: string;
    if (temI) {
      I0total = f.intensidadeCd!;
      texto = `I0 = ${I0total.toFixed(0)} cd (informado)`;
    } else if (difusa) {
      I0total = f.fluxo! / Math.PI;
      texto = `I0 = Φ / π = ${f.fluxo!.toFixed(0)} / π = ${I0total.toFixed(1)} cd (lambertiana simples)`;
    } else {
      const om = anguloSolido(meia);
      I0total = f.fluxo! / om;
      texto = `I0 = Φ / Ω, Ω = 2π(1 - cos ${(f.abertura / 2).toFixed(1)}°) = ${om.toFixed(3)} sr, I0 = ${I0total.toFixed(1)} cd`;
    }
    if (linear) texto += `; linear discretizada de ${PASSO_LINEAR.toFixed(2).replace(".", ",")} m (${n} pontos de ${(I0total / n).toFixed(1)} cd)`;
    const chave = `${f.codigo}|${texto}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      conversoes.push({ codigo: f.codigo, texto });
    }
    // direção da linha: perpendicular à direção da luz
    const dl = { x: -Math.sin(r), y: Math.cos(r) };
    for (let i = 0; i < n; i++) {
      const s = linear ? (i + 0.5) / n - 0.5 : 0;
      emissores.push({
        p: { x: f.x + dl.x * s * f.comprimento, y: f.y + dl.y * s * f.comprimento, z: f.altura },
        eixo,
        I0: I0total / n,
        meiaAbertura: meia,
        codigo: f.codigo,
      });
    }
  }
  return { emissores, conversoes, semDado };
}

/** Iluminância direta num ponto P com normal n (unitária) de todos os emissores. */
export function iluminanciaNoPonto(P: V3, n: V3, emissores: Emissor[], bloq: Seg[], offset2d?: Pt): number {
  let E = 0;
  const p2: Pt = offset2d ?? { x: P.x, y: P.y };
  for (const e of emissores) {
    const dx = P.x - e.p.x;
    const dy = P.y - e.p.y;
    const dz = P.z - e.p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-12) continue;
    const d = Math.sqrt(d2);
    // cos θ: ângulo entre a normal do plano e a direção ponto → fonte
    const cosT = -(dx * n.x + dy * n.y + dz * n.z) / d;
    if (cosT <= 0) continue;
    // α: ângulo entre o eixo da fonte e o raio fonte → ponto
    const cosA = (dx * e.eixo.x + dy * e.eixo.y + dz * e.eixo.z) / d;
    const alfa = Math.acos(Math.max(-1, Math.min(1, cosA)));
    if (alfa > e.meiaAbertura) continue;
    const I = e.I0 * Math.cos(alfa);
    if (I <= 0) continue;
    if (bloq.length && bloqueado({ x: e.p.x, y: e.p.y }, p2, bloq)) continue;
    E += (I * cosT) / d2;
  }
  return E;
}

export interface SaidaGrade {
  Emed: number;
  Emin: number;
  Emax: number;
  U0: number;
  pontos: number;
  grade: { nx: number; ny: number; x0: number; y0: number; passo: number; valores: number[] };
}

function resumo(vals: number[]): Omit<SaidaGrade, "grade"> {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { Emed: 0, Emin: 0, Emax: 0, U0: 0, pontos: 0 };
  let s = 0;
  let mn = Infinity;
  let mx = -Infinity;
  for (const x of v) {
    s += x;
    if (x < mn) mn = x;
    if (x > mx) mx = x;
  }
  const Emed = s / v.length;
  return { Emed, Emin: mn, Emax: mx, U0: Emed > 0 ? mn / Emed : 0, pontos: v.length };
}

/** P2P no plano horizontal (z = altura do plano de trabalho), cobrindo o polígono do ambiente. */
export function p2pHorizontal(
  poligono: Pt[],
  zPlano: number,
  passo: number,
  margem: boolean,
  emissores: Emissor[],
  bloq: Seg[],
): SaidaGrade {
  const area = margem ? recuarPoligono(poligono, 0.2) : poligono;
  const bb = bbox(poligono);
  const nx = Math.max(1, Math.floor(bb.w / passo));
  const ny = Math.max(1, Math.floor(bb.h / passo));
  // centraliza a grade no ambiente
  const x0 = bb.minX + (bb.w - (nx - 1) * passo) / 2;
  const y0 = bb.minY + (bb.h - (ny - 1) * passo) / 2;
  const valores: number[] = new Array(nx * ny).fill(NaN);
  const nrm = { x: 0, y: 0, z: 1 };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = { x: x0 + i * passo, y: y0 + j * passo };
      if (!pontoNoPoligono(p, area)) continue;
      valores[j * nx + i] = iluminanciaNoPonto({ x: p.x, y: p.y, z: zPlano }, nrm, emissores, bloq);
    }
  }
  return { ...resumo(valores), grade: { nx, ny, x0, y0, passo, valores } };
}

/**
 * P2P num plano vertical sobre o segmento a-b, de z = 0 até a altura.
 * A normal aponta para o lado `normal` (unitário, no plano xy).
 * Na grade: i = posição ao longo do segmento (u), j = altura (z).
 */
export function p2pVertical(
  a: Pt,
  b: Pt,
  normal: Pt,
  altura: number,
  passo: number,
  margem: boolean,
  emissores: Emissor[],
  bloq: Seg[],
): SaidaGrade {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const m = margem ? 0.2 : 0;
  const nx = Math.max(1, Math.floor((L - 2 * m) / passo) + 1);
  const ny = Math.max(1, Math.floor((altura - 2 * m) / passo) + 1);
  const x0 = (L - (nx - 1) * passo) / 2;
  const y0 = (altura - (ny - 1) * passo) / 2;
  const valores: number[] = new Array(nx * ny).fill(NaN);
  const nrm = { x: normal.x, y: normal.y, z: 0 };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const s = x0 + i * passo;
      const z = y0 + j * passo;
      if (s < 0 || s > L || z < 0 || z > altura) continue;
      const P = { x: a.x + u.x * s, y: a.y + u.y * s, z };
      // ponto 1 cm à frente da parede, para o teste de sombra não esbarrar nela mesma
      const p2 = { x: P.x + normal.x * 0.01, y: P.y + normal.y * 0.01 };
      valores[j * nx + i] = iluminanciaNoPonto(P, nrm, emissores, bloq, p2);
    }
  }
  return { ...resumo(valores), grade: { nx, ny, x0, y0, passo, valores } };
}
