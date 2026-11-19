// Renderização das manchas de luz do croqui (2D).
// Cada fonte vira uma máscara em escala de mundo (cache), recortada pelo polígono de visibilidade
// (sombra das paredes e limites), pintada com a cor do CCT e somada às outras (modo "lighter").

import { rgbDoCCT } from "../cor";
import { dirDeg, poligonoVisibilidade, rad, type Seg } from "../geometria";
import type { Fonte } from "../tipos";
import type { Camera } from "./camera";

export interface ContextoLuz {
  vista: "planta" | "corte";
  peDireito: number;
  alturaPlano: number;
  bloqueadores: Seg[];
  assinaturaBloq: string;
}

interface Mascara {
  chave: string;
  canvas: HTMLCanvasElement;
  minX: number;
  maxY: number;
  ppm: number;
  w: number;
  h: number;
}

const cache = new Map<string, Mascara>();

export function assinaturaSegmentos(s: Seg[]): string {
  let h = s.length * 7919;
  for (const g of s) h = (h * 31 + Math.round((g.a.x + 3 * g.a.y + 7 * g.b.x + 11 * g.b.y) * 1000)) | 0;
  return String(h);
}

/** Altura da fonte acima do plano de referência visual (na planta). */
const alturaUtil = (f: Fonte, c: ContextoLuz) => Math.max(0.35, f.altura - Math.min(c.alturaPlano, 0.75));

/** Alcance (raio) da máscara em metros. */
export function alcance(f: Fonte, c: ContextoLuz): number {
  const h = alturaUtil(f, c);
  const meia = rad(Math.max(2, Math.min(178, f.abertura)) / 2);
  if (c.vista === "corte") {
    if (f.natureza === "facho") return Math.max(1.5, c.peDireito * 1.7);
    if (f.natureza === "difusa") return 1.4 + c.peDireito * 0.25;
    return f.comprimento / 2 + 1.6;
  }
  switch (f.natureza) {
    case "difusa":
      return 0.9 + h * 1.0;
    case "facho": {
      const t = rad(Math.min(f.tilt, 80));
      if (t + meia >= rad(84)) return Math.min(9, Math.max(2.5, h * Math.tan(rad(80)) * 0.6));
      const far = h * Math.tan(t + meia);
      return Math.max(0.6, far * 1.45 + 0.25);
    }
    case "linear_dirigido": {
      const t = rad(Math.min(f.tilt, 80));
      const prof = profundidadeLinear(f, h, t, meia);
      return Math.hypot(f.comprimento / 2 + 0.4, prof + 0.2);
    }
    case "linha_difusa":
      return Math.hypot(f.comprimento / 2 + 0.5, 0.55 + h * 0.45);
  }
}

function profundidadeLinear(f: Fonte, h: number, t: number, meia: number) {
  const ang = Math.min(rad(80), t + meia / 2);
  return Math.max(0.5, Math.min(4, 0.35 + h * Math.tan(ang)));
}

function chaveDe(f: Fonte, c: ContextoLuz): string {
  return [
    c.vista,
    f.natureza,
    f.x.toFixed(4),
    f.y.toFixed(4),
    f.rotacao.toFixed(2),
    f.tilt.toFixed(2),
    f.altura.toFixed(3),
    f.abertura.toFixed(2),
    f.comprimento.toFixed(3),
    c.peDireito,
    c.alturaPlano,
    c.assinaturaBloq,
  ].join("|");
}

function criarCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  return cv;
}

/** Desenha a máscara (alfa) de uma fonte. Branco com alfa = intensidade visual relativa. */
function gerarMascara(f: Fonte, c: ContextoLuz): Mascara {
  const R = alcance(f, c);
  const ppm = Math.min(72, 1100 / (2 * R));
  const lado = Math.ceil(2 * R * ppm);
  const cv = criarCanvas(lado, lado);
  const ctx = cv.getContext("2d")!;
  const minX = f.x - R;
  const maxY = f.y + R;
  // mundo → máscara (y para cima vira y para baixo)
  ctx.setTransform(ppm, 0, 0, -ppm, -minX * ppm, maxY * ppm);

  const recortar = (o: { x: number; y: number }) => {
    const vis = poligonoVisibilidade(o, R * 1.05, c.bloqueadores);
    ctx.beginPath();
    vis.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
  };

  const linear = f.natureza === "linear_dirigido" || f.natureza === "linha_difusa";

  if (!linear) {
    ctx.save();
    recortar({ x: f.x, y: f.y });
    if (f.natureza === "difusa") desenharDifusa(ctx, f, R, c);
    else desenharFacho(ctx, f, R, c);
    ctx.restore();
  } else {
    desenharLinear(ctx, f, c);
  }
  return { chave: chaveDe(f, c), canvas: cv, minX, maxY, ppm, w: lado, h: lado };
}

function gradRadial(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, paradas: [number, number][]) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, a] of paradas) g.addColorStop(Math.max(0, Math.min(1, o)), `rgba(255,255,255,${a})`);
  return g;
}

/** Queda suave tipo gaussiana. */
const gauss = (n: number): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [t, Math.exp(-4.2 * t * t) * (1 - t * t * t)] as [number, number];
  });

function desenharDifusa(ctx: CanvasRenderingContext2D, f: Fonte, R: number, c: ContextoLuz) {
  ctx.fillStyle = gradRadial(ctx, f.x, f.y, 0, R, gauss(12));
  ctx.fillRect(f.x - R, f.y - R, 2 * R, 2 * R);
  // núcleo levemente mais forte perto da fonte
  const nucleo = c.vista === "corte" ? 0.35 : 0.22 + 0.05 * alturaUtil(f, c);
  ctx.fillStyle = gradRadial(ctx, f.x, f.y, 0, nucleo, [
    [0, 0.55],
    [1, 0],
  ]);
  ctx.fillRect(f.x - R, f.y - R, 2 * R, 2 * R);
}

function desenharFacho(ctx: CanvasRenderingContext2D, f: Fonte, R: number, c: ContextoLuz) {
  const meia = rad(Math.max(2, Math.min(178, f.abertura)) / 2);
  const dir = rad(f.rotacao);
  const h = alturaUtil(f, c);
  const t = c.vista === "corte" ? Math.PI / 2 : rad(Math.min(f.tilt, 80));

  // Facho apontado para baixo (ou quase), na planta: mancha elíptica com borda mais nítida.
  if (c.vista === "planta" && t < meia * 0.9) {
    const centro = h * Math.tan(t);
    const cx = f.x + Math.cos(dir) * centro;
    const cy = f.y + Math.sin(dir) * centro;
    const rx = Math.max(0.18, (h * (Math.tan(Math.min(t + meia, rad(80))) - Math.tan(t - meia))) / 2);
    const ry = Math.max(0.18, h * Math.tan(meia) / Math.max(0.3, Math.cos(t)));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir);
    ctx.scale(rx, ry);
    // dentro da abertura: queda tipo cosseno; borda curta para não serrilhar
    ctx.fillStyle = gradRadial(ctx, 0, 0, 0, 1.28, [
      [0, 1],
      [0.35, 0.9],
      [0.6, 0.7],
      [0.74, 0.48],
      [0.8, 0.2],
      [0.88, 0.06],
      [1, 0],
    ]);
    ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
    ctx.restore();
    // halo suave (luz que escapa do facho)
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = gradRadial(ctx, cx, cy, 0, Math.max(rx, ry) * 1.9, gauss(8));
    ctx.fillRect(f.x - R, f.y - R, 2 * R, 2 * R);
    ctx.globalAlpha = 1;
    return;
  }

  // Facho inclinado (planta) ou no corte: cone a partir da fonte.
  // Meia abertura aparente vista de cima: atan(tan(α) / sen(tilt)).
  const meiaPlano = c.vista === "corte" ? meia : Math.min(rad(80), Math.atan(Math.tan(meia) / Math.max(0.05, Math.sin(t))));
  // perfil angular (cosseno até a borda, corte rápido fora) via gradiente cônico
  const cone = ctx.createConicGradient(0, f.x, f.y);
  // O gradiente é definido em coordenadas do mundo: a parada i corresponde ao ângulo a = 2π i/N.
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const d = Math.abs(((a - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    let v = 0;
    if (d <= meiaPlano) v = 0.25 + 0.75 * Math.cos((d / meiaPlano) * (Math.PI / 2)) ** 0.8;
    else if (d <= meiaPlano * 1.12) v = 0.25 * (1 - (d - meiaPlano) / (meiaPlano * 0.12));
    cone.addColorStop(i / N, `rgba(255,255,255,${v.toFixed(3)})`);
  }
  // perfil radial: forte perto, cai com a distância (aprox. do inverso do quadrado, suavizado)
  const r0 = c.vista === "corte" ? 0.35 : Math.max(0.3, h * 0.35);
  const paradasRadiais: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const tt = i / 14;
    const r = tt * R;
    const v = (1 / (1 + (r / r0) ** 2)) ** 0.55 * (1 - tt ** 3);
    paradasRadiais.push([tt, Math.max(0, v)]);
  }
  // compõe: desenha o cônico, depois multiplica (destination-in) pelo radial
  const tmp = criarCanvas(ctx.canvas.width, ctx.canvas.height);
  const tctx = tmp.getContext("2d")!;
  tctx.setTransform(ctx.getTransform());
  tctx.fillStyle = cone;
  tctx.fillRect(f.x - R, f.y - R, 2 * R, 2 * R);
  tctx.globalCompositeOperation = "destination-in";
  tctx.fillStyle = gradRadial(tctx, f.x, f.y, 0, R, paradasRadiais);
  tctx.fillRect(f.x - R, f.y - R, 2 * R, 2 * R);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

function desenharLinear(ctx: CanvasRenderingContext2D, f: Fonte, c: ContextoLuz) {
  const L = Math.max(0.1, f.comprimento);
  const dirLuz = dirDeg(f.rotacao);
  const dirLinha = { x: -dirLuz.y, y: dirLuz.x };
  const h = alturaUtil(f, c);
  const dirigido = f.natureza === "linear_dirigido";
  const meia = rad(Math.max(2, Math.min(178, f.abertura)) / 2);
  const t = rad(Math.min(f.tilt, 80));
  const prof = c.vista === "corte" ? 1.4 : dirigido ? profundidadeLinear(f, h, t, meia) : 0.5 + h * 0.4;
  const atras = dirigido ? 0.12 : prof;
  const pedacos = Math.max(1, Math.min(14, Math.ceil(L / 0.35)));
  const larg = L / pedacos;

  const tmp = criarCanvas(ctx.canvas.width, ctx.canvas.height);
  const tctx = tmp.getContext("2d")!;
  tctx.setTransform(ctx.getTransform());

  for (let i = 0; i < pedacos; i++) {
    const s = (i + 0.5) / pedacos - 0.5;
    const o = { x: f.x + dirLinha.x * s * L, y: f.y + dirLinha.y * s * L };
    tctx.save();
    // recorte de visibilidade a partir do centro do pedaço
    const vis = poligonoVisibilidade(o, Math.hypot(larg, prof) + 0.3, c.bloqueadores);
    tctx.beginPath();
    vis.forEach((p, k) => (k ? tctx.lineTo(p.x, p.y) : tctx.moveTo(p.x, p.y)));
    tctx.closePath();
    tctx.clip();
    const g = tctx.createLinearGradient(o.x - dirLuz.x * atras, o.y - dirLuz.y * atras, o.x + dirLuz.x * prof, o.y + dirLuz.y * prof);
    const total = atras + prof;
    const z = atras / total;
    if (dirigido) {
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(z * 0.5, "rgba(255,255,255,0.35)");
      g.addColorStop(z, "rgba(255,255,255,1)");
      g.addColorStop(z + (1 - z) * 0.25, "rgba(255,255,255,0.7)");
      g.addColorStop(z + (1 - z) * 0.6, "rgba(255,255,255,0.28)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const d = Math.abs(u - 0.5) * 2;
        g.addColorStop(u, `rgba(255,255,255,${(Math.exp(-3.5 * d * d) * (1 - d ** 4)).toFixed(3)})`);
      }
    }
    tctx.fillStyle = g;
    // retângulo do pedaço, com um pouco de sobreposição
    const meiaL = larg / 2 + 0.01;
    tctx.beginPath();
    const p0 = { x: o.x - dirLinha.x * meiaL - dirLuz.x * atras, y: o.y - dirLinha.y * meiaL - dirLuz.y * atras };
    const p1 = { x: o.x + dirLinha.x * meiaL - dirLuz.x * atras, y: o.y + dirLinha.y * meiaL - dirLuz.y * atras };
    const p2 = { x: p1.x + dirLuz.x * total, y: p1.y + dirLuz.y * total };
    const p3 = { x: p0.x + dirLuz.x * total, y: p0.y + dirLuz.y * total };
    tctx.moveTo(p0.x, p0.y);
    tctx.lineTo(p1.x, p1.y);
    tctx.lineTo(p2.x, p2.y);
    tctx.lineTo(p3.x, p3.y);
    tctx.closePath();
    tctx.fill();
    tctx.restore();
  }
  // pontas suaves ao longo da linha
  tctx.globalCompositeOperation = "destination-in";
  const ext = Math.min(0.45, L * 0.3) + 0.15;
  const a0 = { x: f.x - dirLinha.x * (L / 2 + ext), y: f.y - dirLinha.y * (L / 2 + ext) };
  const a1 = { x: f.x + dirLinha.x * (L / 2 + ext), y: f.y + dirLinha.y * (L / 2 + ext) };
  const ge = tctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
  const tot = L + 2 * ext;
  ge.addColorStop(0, "rgba(255,255,255,0)");
  ge.addColorStop((ext + 0.05) / tot, "rgba(255,255,255,0.85)");
  ge.addColorStop((ext + Math.min(0.3, L / 2)) / tot, "rgba(255,255,255,1)");
  ge.addColorStop(1 - (ext + Math.min(0.3, L / 2)) / tot, "rgba(255,255,255,1)");
  ge.addColorStop(1 - (ext + 0.05) / tot, "rgba(255,255,255,0.85)");
  ge.addColorStop(1, "rgba(255,255,255,0)");
  tctx.fillStyle = ge;
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

function obterMascara(f: Fonte, c: ContextoLuz): Mascara {
  const chave = chaveDe(f, c);
  const k = `${c.vista}:${f.id}`;
  const m = cache.get(k);
  if (m && m.chave === chave) return m;
  const nova = gerarMascara(f, c);
  cache.set(k, nova);
  if (cache.size > 600) {
    const primeiro = cache.keys().next().value;
    if (primeiro) cache.delete(primeiro);
  }
  return nova;
}

/** Pinta uma máscara com a cor do CCT e a intensidade. */
const pintadas = new Map<string, { chave: string; canvas: HTMLCanvasElement }>();

function mascaraPintada(f: Fonte, c: ContextoLuz, tema: "escuro" | "claro"): Mascara & { pintada: HTMLCanvasElement } {
  const m = obterMascara(f, c);
  const chave = `${m.chave}|${f.cct}|${f.intensidadePct}|${tema}`;
  const k = `${c.vista}:${f.id}`;
  const p = pintadas.get(k);
  if (p && p.chave === chave) return { ...m, pintada: p.canvas };
  const cv = criarCanvas(m.w, m.h);
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(m.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  let [r, g, b] = rgbDoCCT(f.cct);
  if (tema === "claro") {
    // no fundo claro a luz vira "marca-texto": cor mais saturada
    const media = (r + g + b) / 3;
    r = Math.round(Math.max(0, Math.min(255, media + (r - media) * 3.2)));
    g = Math.round(Math.max(0, Math.min(255, media + (g - media) * 3.2 - 25)));
    b = Math.round(Math.max(0, Math.min(255, media + (b - media) * 3.2 - 50)));
  }
  const alfa = Math.max(0, Math.min(1, f.intensidadePct / 100));
  ctx.fillStyle = `rgba(${r},${g},${b},${(alfa * 0.95).toFixed(3)})`;
  ctx.fillRect(0, 0, m.w, m.h);
  pintadas.set(k, { chave, canvas: cv });
  return { ...m, pintada: cv };
}

/**
 * Desenha todas as manchas numa camada (canvas do tamanho da tela/exportação).
 * A soma é aditiva; o brilho satura (teto) para o fundo da planta continuar legível.
 */
export function desenharLuzes(
  destino: CanvasRenderingContext2D,
  fontes: Fonte[],
  c: ContextoLuz,
  cam: Camera,
  tema: "escuro" | "claro",
  dpr = 1,
) {
  const W = destino.canvas.width;
  const H = destino.canvas.height;
  destino.save();
  destino.setTransform(1, 0, 0, 1, 0, 0);
  destino.globalCompositeOperation = "lighter";
  for (const f of fontes) {
    if (!f.visivel || f.intensidadePct <= 0) continue;
    const m = mascaraPintada(f, c, tema);
    const esc = (cam.s / m.ppm) * dpr;
    const x = (m.minX * cam.s + cam.ox) * dpr;
    const y = (-m.maxY * cam.s + cam.oy) * dpr;
    const w = m.w * esc;
    const h = m.h * esc;
    if (x > W || y > H || x + w < 0 || y + h < 0) continue;
    destino.drawImage(m.pintada, x, y, w, h);
  }
  destino.restore();
}

export function limparCacheLuz() {
  cache.clear();
  pintadas.clear();
}
