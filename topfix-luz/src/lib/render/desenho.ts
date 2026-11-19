// Desenho do quadro (planta ou corte): usado na tela e nas exportações.

import { corFalsa, ESCALA_LUX } from "../cor";
import { areaPoligono, centroide, dirDeg, dist, lerp, norm, perp, sub, trechosSemVaos } from "../geometria";
import { fmt } from "../calculo/lumens";
import type { Ambiente, Fonte, Parede, Pt, ResultadoP2P, Vista } from "../tipos";
import { contornoAmbiente, legendaDe, textoLinhaLegenda } from "../ambiente";
import { rgbDoCCT } from "../cor";
import type { Camera } from "./camera";
import { paraTela } from "./camera";
import { assinaturaSegmentos, desenharLuzes, type ContextoLuz } from "./luz";
import { bloqueadoresDaVista, contornoDasParedes, recuarPoligono } from "../geometria";

export type Tema = "escuro" | "claro";

export const CORES = {
  escuro: {
    fundo: "#0b111d",
    grade: "rgba(150,170,210,0.06)",
    gradeForte: "rgba(150,170,210,0.11)",
    paredeFill: "rgba(205,215,232,0.16)",
    paredeLinha: "rgba(226,233,246,0.92)",
    dxf: "rgba(150,168,200,0.55)",
    texto: "#e7ecf6",
    textoFraco: "rgba(200,210,230,0.55)",
    limite: "#e8b65a",
    referencia: "rgba(190,200,220,0.6)",
    cota: "rgba(170,190,225,0.85)",
    ambiente: "rgba(120,140,190,0.05)",
  },
  claro: {
    fundo: "#f6f4ef",
    grade: "rgba(40,50,70,0.05)",
    gradeForte: "rgba(40,50,70,0.09)",
    paredeFill: "rgba(40,46,60,0.75)",
    paredeLinha: "rgba(25,30,40,0.95)",
    dxf: "rgba(70,80,100,0.5)",
    texto: "#1d2330",
    textoFraco: "rgba(40,50,70,0.55)",
    limite: "#b7791f",
    referencia: "rgba(60,70,90,0.55)",
    cota: "rgba(50,70,110,0.85)",
    ambiente: "rgba(60,80,120,0.04)",
  },
};

export const COR_SELECAO = "#56c7f5";
export const COR_MARCA = "#d9a54a";

export interface OpcoesQuadro {
  cam: Camera;
  dpr: number;
  largura: number; // px CSS
  altura: number;
  tema: Tema;
  ambiente: Ambiente;
  vista: "planta" | "corte";
  camadas: { fundo: boolean; base: boolean; vaos: boolean; cotas: boolean; croqui: boolean; calculos: boolean };
  selecao?: Set<string>;
  /** Só as manchas (PNG de luzes, fundo transparente). */
  soLuzes?: boolean;
  transparente?: boolean;
  mapa?: ResultadoP2P | null;
  grade?: boolean;
  marcadores?: boolean;
  /** Planta: mostra o plano vertical escolhido e a linha de corte. */
  extrasPlanta?: boolean;
  /** Desenho para exportação (não usa nem grava o cache da tela). */
  exportacao?: boolean;
}

let cacheCamada: { fontes: unknown; chave: string; canvas: HTMLCanvasElement } | null = null;

/** Ganho por fonte na soma (deixa folga antes de saturar os 8 bits). */
const GANHO = 0.3;
/** Teto de brilho e curva: uma fonte sozinha chega a ~66%, várias somadas se aproximam de 92% sem estourar. */
const TETO = 0.92;
const CURVA = 1.25;
const LUT = (() => {
  const t = new Float32Array(256);
  for (let m = 1; m < 256; m++) {
    const x = m / 255 / GANHO;
    t[m] = TETO * (1 - Math.exp(-CURVA * x));
  }
  return t;
})();

/**
 * Soma as manchas sobre preto e aplica o teto de brilho preservando a cor.
 * modo "tela": RGB opaco (para "screen" sobre o fundo escuro);
 * modo "alfa": cor normalizada e transparência = brilho (PNG de luzes e quadro claro).
 */
function camadaDeLuz(
  fontes: Fonte[],
  cl: ContextoLuz,
  cam: Camera,
  Wcss: number,
  Hcss: number,
  tema: Tema,
  k: number,
  modo: "tela" | "alfa",
): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(Wcss * k));
  cv.height = Math.max(1, Math.ceil(Hcss * k));
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, cv.width, cv.height);
  desenharLuzes(c, fontes, cl, cam, tema, k, GANHO);
  const img = c.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (mx === 0) {
      if (modo === "alfa") d[i + 3] = 0;
      continue;
    }
    const y = LUT[mx];
    if (modo === "tela") {
      const s = (y * 255) / mx;
      d[i] = r * s;
      d[i + 1] = g * s;
      d[i + 2] = b * s;
    } else {
      const s = 255 / mx;
      d[i] = r * s;
      d[i + 1] = g * s;
      d[i + 2] = b * s;
      d[i + 3] = y * 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

const cacheLimite = new WeakMap<object, Pt[] | null>();
/** Contorno externo das paredes da vista, um pouco afastado (para incluir a espessura das paredes). */
function contornoDaVista(v: Vista): Pt[] | null {
  if (cacheLimite.has(v.paredes)) return cacheLimite.get(v.paredes)!;
  const c = contornoDasParedes(v.paredes);
  const r = c ? recuarPoligono(c, -0.01) : null;
  cacheLimite.set(v.paredes, r);
  return r;
}

const imagens = new Map<string, HTMLImageElement>();
let aoCarregarImagem: (() => void) | null = null;
export function quandoImagemCarregar(fn: () => void) {
  aoCarregarImagem = fn;
}

export function imagemDe(dataUrl: string): HTMLImageElement | null {
  let img = imagens.get(dataUrl);
  if (!img) {
    img = new Image();
    img.onload = () => aoCarregarImagem?.();
    img.src = dataUrl;
    imagens.set(dataUrl, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const cacheDxf = new WeakMap<object, { chave: string; caminho: Path2D }>();

function caminhoDxf(v: Vista): Path2D | null {
  const f = v.fundo;
  if (!f?.entidades) return null;
  const chave = (f.camadas ?? []).map((c) => (c.visivel ? "1" : "0")).join("");
  const c = cacheDxf.get(f.entidades);
  if (c && c.chave === chave) return c.caminho;
  const visiveis = new Set((f.camadas ?? []).filter((x) => x.visivel).map((x) => x.nome));
  const p = new Path2D();
  for (const e of f.entidades) {
    if (!visiveis.has(e.camada)) continue;
    const q = e.pts;
    if (q.length < 4) continue;
    p.moveTo(q[0], q[1]);
    for (let i = 2; i < q.length; i += 2) p.lineTo(q[i], q[i + 1]);
    if (e.fechado) p.closePath();
  }
  cacheDxf.set(f.entidades, { chave, caminho: p });
  return p;
}

/** Quadrilátero da parede com espessura (estendido nas pontas ligadas a outras paredes). */
export function quadParede(p: Parede, a: Pt, b: Pt, estA: number, estB: number): Pt[] {
  const d = norm(sub(b, a));
  const dir = { x: d.y, y: -d.x }; // direita (mundo com y para cima)
  const e = p.espessura;
  const a2 = { x: a.x - d.x * estA, y: a.y - d.y * estA };
  const b2 = { x: b.x + d.x * estB, y: b.y + d.y * estB };
  let o1 = 0;
  let o2 = 0;
  if (p.lado === "direita") o2 = e;
  else if (p.lado === "esquerda") o1 = -e;
  else {
    o1 = -e / 2;
    o2 = e / 2;
  }
  return [
    { x: a2.x + dir.x * o1, y: a2.y + dir.y * o1 },
    { x: b2.x + dir.x * o1, y: b2.y + dir.y * o1 },
    { x: b2.x + dir.x * o2, y: b2.y + dir.y * o2 },
    { x: a2.x + dir.x * o2, y: a2.y + dir.y * o2 },
  ];
}

function pontaLigada(p: Parede, ponta: Pt, todas: Parede[]) {
  return todas.some((q) => q !== p && (dist(q.a, ponta) < 0.02 || dist(q.b, ponta) < 0.02));
}

function texto(
  ctx: CanvasRenderingContext2D,
  o: OpcoesQuadro,
  p: Pt,
  t: string,
  tam: number,
  cor: string,
  alinhar: CanvasTextAlign = "center",
  base: CanvasTextBaseline = "middle",
  peso = 500,
  angulo = 0,
) {
  const s = paraTela(o.cam, p);
  ctx.save();
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.translate(s.x, s.y);
  if (angulo) ctx.rotate(angulo);
  ctx.font = `${peso} ${tam}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = base;
  ctx.fillText(t, 0, 0);
  ctx.restore();
}

/** Desenha o quadro completo. */
export function desenharQuadro(ctx: CanvasRenderingContext2D, o: OpcoesQuadro) {
  const c = CORES[o.tema];
  const v = o.vista === "planta" ? o.ambiente.planta : o.ambiente.corte;
  const W = o.largura * o.dpr;
  const H = o.altura * o.dpr;
  const px = 1 / o.cam.s; // 1 pixel CSS em metros
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!o.transparente && !o.soLuzes) {
    ctx.fillStyle = c.fundo;
    ctx.fillRect(0, 0, W, H);
  }
  const mundo = () => ctx.setTransform(o.cam.s * o.dpr, 0, 0, -o.cam.s * o.dpr, o.cam.ox * o.dpr, o.cam.oy * o.dpr);
  mundo();

  // grade
  if (o.grade && !o.soLuzes) desenharGrade(ctx, o, c);

  // fundo (DXF/PDF/imagem)
  if (!o.soLuzes && o.camadas.fundo && v.fundo?.visivel) {
    ctx.save();
    ctx.globalAlpha = v.fundo.opacidade;
    if (v.fundo.imagem) {
      const im = v.fundo.imagem;
      const img = imagemDe(im.dataUrl);
      if (img) {
        ctx.translate(im.x, im.y);
        ctx.rotate((im.rotacao * Math.PI) / 180);
        ctx.scale(im.escala, -im.escala);
        if (o.tema === "escuro") ctx.filter = "invert(1) hue-rotate(180deg) brightness(0.85)";
        ctx.drawImage(img, 0, 0);
        ctx.filter = "none";
      }
    }
    const cam = caminhoDxf(v);
    if (cam) {
      ctx.lineWidth = px * 0.9;
      ctx.strokeStyle = c.dxf;
      ctx.stroke(cam);
    }
    ctx.restore();
  }

  // contorno do ambiente (planta)
  const contorno = o.vista === "planta" ? contornoAmbiente(o.ambiente) : null;
  if (!o.soLuzes && contorno && o.camadas.base) {
    ctx.beginPath();
    contorno.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = c.ambiente;
    ctx.fill();
  }

  // mapa de cores falsas (P2P horizontal)
  if (!o.soLuzes && o.mapa && o.mapa.tipo === "h" && o.camadas.calculos && contorno) {
    desenharMapa(ctx, o, o.mapa, contorno);
  }

  // luzes
  if (o.camadas.croqui && v.fontes.length) {
    const bloq = bloqueadoresDaVista(v);
    const cl: ContextoLuz = {
      vista: o.vista,
      peDireito: o.ambiente.peDireito,
      alturaPlano: o.ambiente.alturaPlano,
      bloqueadores: bloq,
      assinaturaBloq: assinaturaSegmentos(bloq),
    };
    // camada de luz reaproveitada enquanto fontes, paredes, câmera e tamanho não mudam
    const k = o.exportacao ? o.dpr : Math.min(o.dpr, 1.5);
    const modo = o.soLuzes || o.tema === "claro" ? "alfa" : "tela";
    const chave = `${cl.assinaturaBloq}|${o.cam.s}|${o.cam.ox}|${o.cam.oy}|${W}|${H}|${o.tema}|${o.vista}|${modo}|${k}`;
    let camada: HTMLCanvasElement;
    if (!o.exportacao && cacheCamada && cacheCamada.fontes === v.fontes && cacheCamada.chave === chave) camada = cacheCamada.canvas;
    else {
      camada = camadaDeLuz(v.fontes, cl, o.cam, o.largura, o.altura, o.tema, k, modo);
      if (!o.exportacao) cacheCamada = { fontes: v.fontes, chave, canvas: camada };
    }
    ctx.save();
    // a luz fica dentro do contorno externo das paredes (não "vaza" pela janela para fora da planta)
    const lim = contornoDaVista(v);
    if (lim) {
      mundo();
      ctx.beginPath();
      lim.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (o.mapa) ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = o.soLuzes ? "source-over" : o.tema === "escuro" ? "screen" : "multiply";
    if (!o.soLuzes) ctx.filter = "blur(0.6px)";
    ctx.drawImage(camada, 0, 0, W, H);
    ctx.filter = "none";
    ctx.restore();
  }
  mundo();

  if (!o.soLuzes) {
    if (o.camadas.base) desenharParedes(ctx, o, v, c, px);
    if (o.camadas.vaos && o.vista === "planta") desenharAberturas(ctx, o, v, c, px);
    if (o.camadas.base) desenharLinhas(ctx, o, v, c, px);
    if (o.camadas.cotas) desenharCotas(ctx, o, v, c, px);
    if (o.camadas.base) for (const t of v.textos) texto(ctx, o, t.p, t.texto, Math.max(9, t.tamanho * o.cam.s), c.texto, "left", "alphabetic", 500);
    if (contorno && o.camadas.base) {
      const ce = centroide(contorno);
      const A = Math.abs(areaPoligono(contorno));
      texto(ctx, o, ce, `${o.ambiente.nome}`, 12, c.textoFraco, "center", "bottom", 600);
      texto(ctx, o, ce, `${fmt(A, 2)} m²`, 11, c.textoFraco, "center", "top", 500);
    }
    if (o.vista === "corte") desenharCotasCorte(ctx, o, v, c);
    if (o.extrasPlanta && o.vista === "planta") desenharExtrasPlanta(ctx, o, px);
  }
  if (o.marcadores !== false && !o.soLuzes && o.camadas.croqui) desenharMarcadores(ctx, o, v, px);
  ctx.restore();
}


function desenharGrade(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, c: (typeof CORES)["escuro"]) {
  const s = o.cam.s;
  let passo = 0.5;
  if (s * passo < 14) passo = 1;
  if (s * passo < 14) passo = 5;
  if (s * 0.1 > 18) passo = 0.1;
  const x0 = -o.cam.ox / s;
  const x1 = (o.largura - o.cam.ox) / s;
  const y1 = o.cam.oy / s;
  const y0 = (o.cam.oy - o.altura) / s;
  ctx.lineWidth = 1 / s;
  for (let x = Math.floor(x0 / passo) * passo; x <= x1; x += passo) {
    ctx.strokeStyle = Math.abs(x % (passo * 5)) < 1e-6 ? c.gradeForte : c.grade;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
  for (let y = Math.floor(y0 / passo) * passo; y <= y1; y += passo) {
    ctx.strokeStyle = Math.abs(y % (passo * 5)) < 1e-6 ? c.gradeForte : c.grade;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
}

function desenharParedes(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, c: (typeof CORES)["escuro"], px: number) {
  for (const p of v.paredes) {
    const sel = o.selecao?.has(p.id);
    const trechos = trechosSemVaos(p, v.aberturas);
    const L = dist(p.a, p.b);
    for (const [a, b] of trechos) {
      const ligadoA = dist(a, p.a) < 1e-6 && pontaLigada(p, p.a, v.paredes);
      const ligadoB = dist(b, p.b) < 1e-6 && pontaLigada(p, p.b, v.paredes);
      const estA = ligadoA ? (p.lado === "centro" ? p.espessura / 2 : 0) : 0;
      const estB = ligadoB ? (p.lado === "centro" ? p.espessura / 2 : p.espessura) : 0;
      const q = quadParede(p, a, b, estA, estB);
      ctx.beginPath();
      q.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = sel ? "rgba(86,199,245,0.35)" : c.paredeFill;
      ctx.fill();
      ctx.lineWidth = px * (sel ? 1.8 : 1.1);
      ctx.strokeStyle = sel ? COR_SELECAO : c.paredeLinha;
      ctx.stroke();
    }
    if (!p.bloqueia) {
      ctx.save();
      ctx.setLineDash([px * 4, px * 4]);
      ctx.strokeStyle = c.textoFraco;
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(p.a.x, p.a.y);
      ctx.lineTo(p.b.x, p.b.y);
      ctx.stroke();
      ctx.restore();
    }
    if (sel && L > 0) {
      // comprimento da parede selecionada
      const m = lerp(p.a, p.b, 0.5);
      const n = perp(norm(sub(p.b, p.a)));
      texto(ctx, o, { x: m.x + n.x * 0.35, y: m.y + n.y * 0.35 }, `${fmt(L, 2)} m`, 11, COR_SELECAO, "center", "middle", 700);
    }
  }
}

function desenharAberturas(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, c: (typeof CORES)["escuro"], px: number) {
  for (const ab of v.aberturas) {
    const p = v.paredes.find((w) => w.id === ab.paredeId);
    if (!p) continue;
    const L = dist(p.a, p.b);
    if (L < 1e-6) continue;
    const d = norm(sub(p.b, p.a));
    const dir = { x: d.y, y: -d.x };
    const meio = lerp(p.a, p.b, ab.t);
    const h = ab.largura / 2;
    const a = { x: meio.x - d.x * h, y: meio.y - d.y * h };
    const b = { x: meio.x + d.x * h, y: meio.y + d.y * h };
    const sel = o.selecao?.has(ab.id);
    ctx.lineWidth = px * (sel ? 2 : 1.1);
    ctx.strokeStyle = sel ? COR_SELECAO : c.paredeLinha;
    // faces do vão
    const e = p.espessura;
    const o1 = p.lado === "direita" ? 0 : p.lado === "esquerda" ? -e : -e / 2;
    const o2 = o1 + e;
    if (ab.tipo === "janela") {
      for (const off of [o1, (o1 + o2) / 2 - e * 0.12, (o1 + o2) / 2 + e * 0.12, o2]) {
        ctx.beginPath();
        ctx.moveTo(a.x + dir.x * off, a.y + dir.y * off);
        ctx.lineTo(b.x + dir.x * off, b.y + dir.y * off);
        ctx.stroke();
      }
      for (const pt of [a, b]) {
        ctx.beginPath();
        ctx.moveTo(pt.x + dir.x * o1, pt.y + dir.y * o1);
        ctx.lineTo(pt.x + dir.x * o2, pt.y + dir.y * o2);
        ctx.stroke();
      }
    } else {
      // porta: folha + arco, abrindo para dentro (lado oposto da espessura) por padrão
      const lado = ab.abreParaDentro === false ? 1 : -1;
      const n = { x: dir.x * lado, y: dir.y * lado };
      const dobradica = ab.inverter ? b : a;
      const outra = ab.inverter ? a : b;
      const folha = { x: dobradica.x + n.x * ab.largura, y: dobradica.y + n.y * ab.largura };
      ctx.beginPath();
      ctx.moveTo(dobradica.x, dobradica.y);
      ctx.lineTo(folha.x, folha.y);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([px * 3, px * 3]);
      ctx.beginPath();
      const ang0 = Math.atan2(folha.y - dobradica.y, folha.x - dobradica.x);
      const ang1 = Math.atan2(outra.y - dobradica.y, outra.x - dobradica.x);
      let dA = ang1 - ang0;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      ctx.arc(dobradica.x, dobradica.y, ab.largura, ang0, ang1, dA < 0);
      ctx.stroke();
      ctx.restore();
      for (const pt of [a, b]) {
        ctx.beginPath();
        ctx.moveTo(pt.x + dir.x * o1, pt.y + dir.y * o1);
        ctx.lineTo(pt.x + dir.x * o2, pt.y + dir.y * o2);
        ctx.stroke();
      }
    }
  }
}

function desenharLinhas(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, c: (typeof CORES)["escuro"], px: number) {
  for (const l of v.linhas) {
    const sel = o.selecao?.has(l.id);
    ctx.save();
    ctx.lineWidth = px * (l.tipo === "limite" ? 1.6 : 1) * (sel ? 1.5 : 1);
    ctx.strokeStyle = sel ? COR_SELECAO : l.tipo === "limite" ? c.limite : c.referencia;
    if (l.tipo === "referencia") ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
    ctx.restore();
  }
}

function desenharCotas(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, c: (typeof CORES)["escuro"], px: number) {
  for (const k of v.cotas) {
    const sel = o.selecao?.has(k.id);
    const n = perp(norm(sub(k.b, k.a)));
    const a = { x: k.a.x + n.x * k.offset, y: k.a.y + n.y * k.offset };
    const b = { x: k.b.x + n.x * k.offset, y: k.b.y + n.y * k.offset };
    ctx.lineWidth = px;
    ctx.strokeStyle = sel ? COR_SELECAO : c.cota;
    ctx.beginPath();
    ctx.moveTo(k.a.x + n.x * k.offset * 0.15, k.a.y + n.y * k.offset * 0.15);
    ctx.lineTo(a.x + n.x * 0.06 * Math.sign(k.offset || 1), a.y + n.y * 0.06 * Math.sign(k.offset || 1));
    ctx.moveTo(k.b.x + n.x * k.offset * 0.15, k.b.y + n.y * k.offset * 0.15);
    ctx.lineTo(b.x + n.x * 0.06 * Math.sign(k.offset || 1), b.y + n.y * 0.06 * Math.sign(k.offset || 1));
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // tiques a 45°
    const d = norm(sub(b, a));
    const t = { x: (d.x + n.x) * 0.06, y: (d.y + n.y) * 0.06 };
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x - t.x, p.y - t.y);
      ctx.lineTo(p.x + t.x, p.y + t.y);
      ctx.stroke();
    }
    const m = lerp(a, b, 0.5);
    let ang = -Math.atan2(b.y - a.y, b.x - a.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    texto(ctx, o, { x: m.x + n.x * 0.12, y: m.y + n.y * 0.12 }, fmt(dist(k.a, k.b), 2), 11, sel ? COR_SELECAO : c.cota, "center", "middle", 600, ang);
  }
}

function desenharCotasCorte(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, c: (typeof CORES)["escuro"]) {
  // marca do pé-direito e do plano de trabalho no corte
  const xs = v.paredes.flatMap((p) => [p.a.x, p.b.x]);
  if (!xs.length) return;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const pl = o.ambiente.alturaPlano;
  ctx.save();
  ctx.setLineDash([4 / o.cam.s, 4 / o.cam.s]);
  ctx.strokeStyle = c.textoFraco;
  ctx.lineWidth = 1 / o.cam.s;
  ctx.beginPath();
  ctx.moveTo(minX, pl);
  ctx.lineTo(maxX, pl);
  ctx.stroke();
  ctx.restore();
  const px2 = 1 / o.cam.s;
  texto(ctx, o, { x: minX + px2 * 8, y: pl + px2 * 3 }, `plano de trabalho ${fmt(pl, 2)} m`, 10, c.textoFraco, "left", "bottom");
  texto(ctx, o, { x: minX + px2 * 8, y: o.ambiente.peDireito - px2 * 4 }, `pé-direito ${fmt(o.ambiente.peDireito, 2)} m`, 10, c.textoFraco, "left", "top");
}

function desenharExtrasPlanta(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, px: number) {
  const pv = o.ambiente.p2p.planoVertical;
  if (pv) {
    ctx.save();
    ctx.lineWidth = px * 4;
    ctx.strokeStyle = "rgba(86,199,245,0.55)";
    ctx.beginPath();
    ctx.moveTo(pv.a.x, pv.a.y);
    ctx.lineTo(pv.b.x, pv.b.y);
    ctx.stroke();
    ctx.restore();
    texto(ctx, o, lerp(pv.a, pv.b, 0.5), "plano vertical", 10, COR_SELECAO, "center", "bottom", 600);
  }
  const lc = o.ambiente.corte.linhaCorte;
  if (lc) {
    ctx.save();
    ctx.setLineDash([px * 10, px * 4, px * 2, px * 4]);
    ctx.lineWidth = px * 1.4;
    ctx.strokeStyle = COR_MARCA;
    ctx.beginPath();
    ctx.moveTo(lc.a.x, lc.a.y);
    ctx.lineTo(lc.b.x, lc.b.y);
    ctx.stroke();
    ctx.restore();
    texto(ctx, o, lc.a, "A", 12, COR_MARCA, "center", "middle", 800);
    texto(ctx, o, lc.b, "A", 12, COR_MARCA, "center", "middle", 800);
  }
}

function desenharMarcadores(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, v: Vista, px: number) {
  for (const f of v.fontes) {
    const sel = o.selecao?.has(f.id);
    const [r, g, b] = rgbDoCCT(f.cct);
    const cor = `rgb(${r},${g},${b})`;
    ctx.save();
    ctx.globalAlpha = f.visivel ? 1 : 0.35;
    const linear = f.natureza === "linear_dirigido" || f.natureza === "linha_difusa";
    const dl = dirDeg(f.rotacao + 90);
    if (linear) {
      ctx.lineWidth = px * 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = cor;
      ctx.beginPath();
      ctx.moveTo(f.x - (dl.x * f.comprimento) / 2, f.y - (dl.y * f.comprimento) / 2);
      ctx.lineTo(f.x + (dl.x * f.comprimento) / 2, f.y + (dl.y * f.comprimento) / 2);
      ctx.stroke();
      if (f.natureza === "linear_dirigido") {
        const d = dirDeg(f.rotacao);
        ctx.lineWidth = px * 1.2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + d.x * px * 14, f.y + d.y * px * 14);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(f.x, f.y, px * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = px;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      if (f.natureza === "facho" && (o.vista === "corte" || f.tilt > 2)) {
        const d = dirDeg(f.rotacao);
        ctx.strokeStyle = cor;
        ctx.lineWidth = px * 1.4;
        ctx.beginPath();
        ctx.moveTo(f.x + d.x * px * 5, f.y + d.y * px * 5);
        ctx.lineTo(f.x + d.x * px * 15, f.y + d.y * px * 15);
        ctx.stroke();
      }
    }
    if (sel) {
      ctx.strokeStyle = COR_SELECAO;
      ctx.lineWidth = px * 1.5;
      ctx.beginPath();
      if (linear) {
        const L = f.comprimento / 2 + px * 6;
        ctx.moveTo(f.x - dl.x * L, f.y - dl.y * L);
        ctx.lineTo(f.x + dl.x * L, f.y + dl.y * L);
      } else ctx.arc(f.x, f.y, px * 8, 0, Math.PI * 2);
      ctx.stroke();
      // alça de rotação
      if (f.natureza !== "difusa") {
        const h = alcaRotacao(f, o.cam);
        ctx.setLineDash([px * 3, px * 3]);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(h.x, h.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COR_SELECAO;
        ctx.beginPath();
        ctx.arc(h.x, h.y, px * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    texto(ctx, o, { x: f.x + px * 8, y: f.y + px * 8 }, f.codigo, 10, sel ? COR_SELECAO : "rgba(230,236,248,0.75)", "left", "bottom", 600);
  }
}

/** Posição da alça de rotação de uma fonte (35 px da fonte, na direção da luz). */
export function alcaRotacao(f: Fonte, cam: Camera): Pt {
  const d = dirDeg(f.rotacao);
  const r = 38 / cam.s + (f.natureza === "linear_dirigido" || f.natureza === "linha_difusa" ? 0 : 0);
  return { x: f.x + d.x * r, y: f.y + d.y * r };
}

/** Mapa de cores falsas, recortado no ambiente, com valores nos pontos quando há espaço. */
export function desenharMapa(ctx: CanvasRenderingContext2D, o: OpcoesQuadro, m: ResultadoP2P, contorno: Pt[]) {
  const g = m.grade;
  const img = document.createElement("canvas");
  img.width = g.nx;
  img.height = g.ny;
  const ictx = img.getContext("2d")!;
  const dados = ictx.createImageData(g.nx, g.ny);
  // vizinho válido para preencher pontos fora (borda suave no recorte)
  const valor = (i: number, j: number) => {
    const v = g.valores[j * g.nx + i];
    if (Number.isFinite(v)) return v;
    let s = 0;
    let n = 0;
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        const w = g.valores[jj * g.nx + ii];
        if (Number.isFinite(w)) {
          s += w;
          n++;
        }
      }
    return n ? s / n : NaN;
  };
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++) {
      const v = valor(i, j);
      const k = ((g.ny - 1 - j) * g.nx + i) * 4;
      if (!Number.isFinite(v)) {
        dados.data[k + 3] = 0;
        continue;
      }
      const [r, gg, b] = corFalsa(v);
      dados.data[k] = r;
      dados.data[k + 1] = gg;
      dados.data[k + 2] = b;
      dados.data[k + 3] = 255;
    }
  ictx.putImageData(dados, 0, 0);
  ctx.save();
  ctx.beginPath();
  contorno.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = 0.85;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // a imagem cobre de x0 - passo/2 até x0 + (nx - 1/2) passo; y invertido (linha 0 da imagem = topo)
  ctx.translate(g.x0 - g.passo / 2, g.y0 + (g.ny - 0.5) * g.passo);
  ctx.scale(g.passo, -g.passo);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  // valores nos pontos
  if (o.cam.s * g.passo >= 30) {
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        const v = g.valores[j * g.nx + i];
        if (!Number.isFinite(v)) continue;
        texto(ctx, o, { x: g.x0 + i * g.passo, y: g.y0 + j * g.passo }, fmt(v), 9.5, "rgba(10,14,24,0.9)", "center", "middle", 700);
      }
  }
}

/** Escala de cores (para PNG/PDF; na tela é um componente). */
export function desenharEscala(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, tema: Tema) {
  const n = ESCALA_LUX.length;
  const h = 12;
  for (let i = 0; i < n; i++) {
    const [r, g, b] = corFalsa(ESCALA_LUX[i] + 0.01);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x + (i * w) / n, y, w / n, h);
    ctx.fillStyle = tema === "escuro" ? "#e7ecf6" : "#1d2330";
    ctx.font = '600 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(ESCALA_LUX[i]), x + (i * w) / n + w / n / 2, y + h + 3);
  }
  ctx.textAlign = "left";
  ctx.fillText("lx", x + w + 6, y);
}

/** Legenda automática desenhada num canvas (exportações). */
export function desenharLegenda(ctx: CanvasRenderingContext2D, fontes: Fonte[], x: number, y: number, tema: Tema, escala = 1) {
  const linhas = legendaDe(fontes);
  if (!linhas.length) return { w: 0, h: 0 };
  const pad = 12 * escala;
  const lh = 20 * escala;
  ctx.save();
  ctx.font = `600 ${12 * escala}px "Inter", system-ui, sans-serif`;
  const larg = Math.max(...linhas.map((l) => ctx.measureText(textoLinhaLegenda(l)).width)) + pad * 2 + 22 * escala;
  const alt = pad * 2 + lh * (linhas.length + 1);
  ctx.fillStyle = tema === "escuro" ? "rgba(13,19,32,0.88)" : "rgba(255,255,255,0.92)";
  ctx.strokeStyle = tema === "escuro" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, larg, alt, 8 * escala);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR_MARCA;
  ctx.font = `700 ${11 * escala}px "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("LEGENDA", x + pad, y + pad + lh / 2);
  ctx.font = `500 ${12 * escala}px "Inter", system-ui, sans-serif`;
  linhas.forEach((l, i) => {
    const yy = y + pad + lh * (i + 1.5);
    const [r, g, b] = rgbDoCCT(l.cct);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(x + pad + 6 * escala, yy, 5 * escala, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tema === "escuro" ? "#e7ecf6" : "#1d2330";
    ctx.fillText(textoLinhaLegenda(l), x + pad + 18 * escala, yy);
  });
  ctx.restore();
  return { w: larg, h: alt };
}

/** Limites do desenho da vista (para enquadrar). */
export function limitesDaVista(v: Vista, extra: Pt[] = []): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts: Pt[] = [...extra];
  for (const p of v.paredes) pts.push(p.a, p.b);
  for (const l of v.linhas) pts.push(l.a, l.b);
  for (const f of v.fontes) pts.push({ x: f.x, y: f.y });
  for (const t of v.textos) pts.push(t.p);
  if (v.fundo?.imagem) {
    const im = v.fundo.imagem;
    pts.push({ x: im.x, y: im.y }, { x: im.x + im.larguraPx * im.escala, y: im.y - im.alturaPx * im.escala });
  }
  if (v.fundo?.entidades?.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of v.fundo.entidades)
      for (let i = 0; i < e.pts.length; i += 2) {
        minX = Math.min(minX, e.pts[i]);
        maxX = Math.max(maxX, e.pts[i]);
        minY = Math.min(minY, e.pts[i + 1]);
        maxY = Math.max(maxY, e.pts[i + 1]);
      }
    pts.push({ x: minX, y: minY }, { x: maxX, y: maxY });
  }
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
