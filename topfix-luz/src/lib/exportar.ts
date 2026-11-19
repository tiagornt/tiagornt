"use client";

// Exportações: PNG da planta (com legenda), PNG só das manchas (fundo transparente) e PDF A4 paisagem.
// Sempre com a marca Topfix e o aviso de estimativa. A marca não pode ser removida.

import { jsPDF } from "jspdf";
import { alvoDoAmbiente, calcularLumens, calcularP2PH, calcularP2PV, legendaDe, memorial, textoLinhaLegenda } from "./ambiente";
import { fmt, NOME_STATUS, statusAlvo } from "./calculo/lumens";
import { AVISO_CURTO, AVISO_PADRAO, TEXTO_NBR, VERSAO_FORMULAS, VERSAO_TABELA_NBR, tipologia } from "./calculo/tabelas";
import { MARCA } from "./marca";
import { baixar } from "./baixar";
import { enquadrar } from "./render/camera";
import { CORES, desenharEscala, desenharLegenda, desenharQuadro, limitesDaVista, type Tema } from "./render/desenho";
import type { Ambiente, Projeto } from "./tipos";
import { desenharMapaVertical } from "@/components/editor/PainelCalculos";
import { corFalsa, rgbDoCCT } from "./cor";

const hoje = () => new Date().toISOString().slice(0, 10);
const limpar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "sem_nome";

export const nomeArquivo = (p: Projeto, a: Ambiente, ext: string, sufixo = "") =>
  `Topfix_Croqui_${limpar(p.nome)}_${limpar(a.nome)}${sufixo}_${hoje()}.${ext}`;

const CAMADAS_TODAS = { fundo: true, base: true, vaos: true, cotas: true, croqui: true, calculos: true };

/** Renderiza o quadro num canvas para exportação. */
export function renderizarQuadro(
  a: Ambiente,
  vista: "planta" | "corte",
  tema: Tema,
  opcoes: { largura: number; altura: number; soLuzes?: boolean; mapa?: boolean; legenda?: boolean; marca?: boolean; dpr?: number },
): HTMLCanvasElement {
  const v = vista === "planta" ? a.planta : a.corte;
  const W = opcoes.largura;
  const H = opcoes.altura;
  const dpr = opcoes.dpr ?? 1;
  const cv = document.createElement("canvas");
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d")!;
  const bb = limitesDaVista(v) ?? { minX: 0, minY: 0, maxX: 5, maxY: 4 };
  // margem: reserva espaço para cabeçalho/rodapé quando há marca
  const margem = Math.round(Math.min(W, H) * 0.08);
  const cam = enquadrar(bb, W, H - (opcoes.marca ? 70 : 0), margem);
  if (opcoes.marca) cam.oy += 40;
  desenharQuadro(ctx, {
    cam,
    dpr,
    largura: W,
    altura: H,
    tema,
    ambiente: a,
    vista,
    camadas: CAMADAS_TODAS,
    soLuzes: opcoes.soLuzes,
    transparente: opcoes.soLuzes,
    mapa: opcoes.mapa ? a.calculos.p2pH : null,
    grade: false,
    marcadores: !opcoes.soLuzes,
    exportacao: true,
  });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const esc = Math.max(1, W / 1400);
  if (opcoes.legenda && v.legendaVisivel) {
    const pos = v.legenda ?? { x: 0.015, y: 0.03 };
    const lx = Math.max(12, Math.min(W - 260 * esc, pos.x * W));
    const ly = Math.max(opcoes.marca ? 60 * esc : 12, Math.min(H - 200 * esc, pos.y * H));
    desenharLegenda(ctx, v.fontes, lx, ly, opcoes.soLuzes ? "escuro" : tema, esc);
  }
  if (opcoes.mapa && a.calculos.p2pH && !opcoes.soLuzes) {
    desenharEscala(ctx, W - 380 * esc, H - 70 * esc, 300 * esc, tema);
  }
  if (opcoes.marca) desenharMarcaPng(ctx, W, H, a, tema, esc, !!opcoes.mapa);
  return cv;
}

function desenharMarcaPng(ctx: CanvasRenderingContext2D, W: number, H: number, a: Ambiente, tema: Tema, esc: number, comMapa: boolean) {
  const c = CORES[tema];
  ctx.save();
  ctx.fillStyle = MARCA.cor;
  ctx.font = `800 ${22 * esc}px "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(MARCA.nome, 24 * esc, 18 * esc);
  const wM = ctx.measureText(MARCA.nome).width;
  ctx.font = `500 ${13 * esc}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = c.textoFraco;
  ctx.fillText(`Croqui de luz · ${a.nome} · ${new Date().toLocaleDateString("pt-BR")}`, 24 * esc + wM + 14 * esc, 25 * esc);
  ctx.font = `500 ${11 * esc}px "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(`${MARCA.site} · ${comMapa ? AVISO_CURTO : "Croqui de intenção, não é laudo."}`, 24 * esc, H - 14 * esc);
  ctx.restore();
}


export function exportarPngPlanta(p: Projeto, a: Ambiente, vista: "planta" | "corte", comMapa: boolean) {
  const cv = renderizarQuadro(a, vista, p.temaQuadro, { largura: 2400, altura: 1600, legenda: true, marca: true, mapa: comMapa && vista === "planta" });
  baixar(cv.toDataURL("image/png"), nomeArquivo(p, a, "png", vista === "corte" ? "_corte" : ""));
}

export function exportarPngLuzes(p: Projeto, a: Ambiente, vista: "planta" | "corte", comLegenda: boolean) {
  const cv = renderizarQuadro(a, vista, p.temaQuadro, { largura: 2400, altura: 1600, soLuzes: true, legenda: comLegenda });
  baixar(cv.toDataURL("image/png"), nomeArquivo(p, a, "png", vista === "corte" ? "_luzes_corte" : "_luzes"));
}

// ---------- PDF ----------

let fontesCarregadas: { normal: string; negrito: string } | null = null;

async function base64DaUrl(url: string): Promise<string> {
  const r = await fetch(url);
  const buf = new Uint8Array(await r.arrayBuffer());
  let s = "";
  const passo = 0x8000;
  for (let i = 0; i < buf.length; i += passo) s += String.fromCharCode(...buf.subarray(i, i + passo));
  return btoa(s);
}

async function prepararFontes(doc: jsPDF) {
  if (!fontesCarregadas) {
    fontesCarregadas = {
      normal: await base64DaUrl("/fontes/DejaVuSans.ttf"),
      negrito: await base64DaUrl("/fontes/DejaVuSans-Bold.ttf"),
    };
  }
  doc.addFileToVFS("DejaVuSans.ttf", fontesCarregadas.normal);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fontesCarregadas.negrito);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "normal");
}

/** Atualiza os cálculos gravados do ambiente antes de exportar (snapshot). */
export function calculosAtualizados(a: Ambiente): Ambiente["calculos"] {
  const l = calcularLumens(a);
  const h = calcularP2PH(a);
  const v = a.p2p.planoVertical ? calcularP2PV(a) : null;
  return {
    lumens: "erro" in l ? null : l,
    p2pH: "erro" in h ? null : h,
    p2pV: v && !("erro" in v) ? v : null,
  };
}

export async function exportarPdf(p: Projeto, ambientes: Ambiente[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await prepararFontes(doc);
  const W = 297;
  const H = 210;
  let primeira = true;
  for (const a of ambientes) {
    if (!primeira) doc.addPage();
    primeira = false;
    paginaCroqui(doc, p, a, W, H);
    paginaMemorial(doc, p, a, W, H);
  }
  doc.save(ambientes.length === 1 ? nomeArquivo(p, ambientes[0], "pdf") : `Topfix_Croqui_${limpar(p.nome)}_${hoje()}.pdf`);
}

function cabecalho(doc: jsPDF, p: Projeto, a: Ambiente, W: number, titulo: string) {
  const [r, g, b] = hexParaRgb(MARCA.cor);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, W, 2.2, "F");
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  doc.setTextColor(r, g, b);
  doc.text(MARCA.nome, 12, 13);
  const wM = doc.getTextWidth(MARCA.nome);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 96, 110);
  doc.text(titulo, 12 + wM + 4, 13);
  doc.setFontSize(9);
  doc.setTextColor(30, 34, 44);
  const direita = `${p.nome}${p.cliente ? ` · ${p.cliente}` : ""} · ${a.nome} · ${new Date().toLocaleDateString("pt-BR")}`;
  doc.text(direita, W - 12, 13, { align: "right" });
  doc.setDrawColor(220, 222, 228);
  doc.line(12, 17, W - 12, 17);
}

function rodape(doc: jsPDF, W: number, H: number) {
  doc.setDrawColor(220, 222, 228);
  doc.line(12, H - 15, W - 12, H - 15);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(110, 114, 124);
  const linhas = doc.splitTextToSize(AVISO_PADRAO, W - 24 - 70);
  doc.text(linhas, 12, H - 11.5);
  doc.setFontSize(7.5);
  doc.setTextColor(30, 34, 44);
  doc.setFont("DejaVu", "bold");
  doc.text(`${MARCA.nome} · ${MARCA.site}`, W - 12, H - 10.5, { align: "right" });
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(7);
  doc.text(MARCA.chamada, W - 12, H - 6.5, { align: "right" });
}

function paginaCroqui(doc: jsPDF, p: Projeto, a: Ambiente, W: number, H: number) {
  cabecalho(doc, p, a, W, "Croqui de luz · estudo de intenção");
  const temCorte = a.corte.paredes.length > 0 || a.corte.fontes.length > 0;
  // área do desenho (esquerda) e coluna de resumo (direita)
  const colW = 78;
  const dx = 12;
  const dy = 21;
  const dw = W - 24 - colW - 6;
  const dh = H - dy - 19;
  const altPlanta = temCorte ? dh * 0.64 : dh;
  const pxmm = 300 / 25.4; // 300 dpi
  const tema = p.temaQuadro;
  const comMapa = !!a.calculos.p2pH;
  const planta = renderizarQuadro(a, "planta", tema, {
    largura: Math.round(dw * pxmm * 0.5),
    altura: Math.round(altPlanta * pxmm * 0.5),
    legenda: false,
    mapa: false,
    dpr: 2,
  });
  doc.addImage(planta, "PNG", dx, dy, dw, altPlanta, undefined, "FAST");
  rotuloImagem(doc, dx, dy, "PLANTA");
  if (temCorte) {
    const altC = dh - altPlanta - 3;
    const corte = renderizarQuadro(a, "corte", tema, {
      largura: Math.round(dw * pxmm * 0.5),
      altura: Math.round(altC * pxmm * 0.5),
      legenda: false,
      dpr: 2,
    });
    doc.addImage(corte, "PNG", dx, dy + altPlanta + 3, dw, altC, undefined, "FAST");
    rotuloImagem(doc, dx, dy + altPlanta + 3, "CORTE");
  }
  // coluna de resumo
  const cx = W - 12 - colW;
  let y = dy + 2;
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(8);
  doc.setTextColor(150, 110, 40);
  doc.text("LEGENDA", cx, y + 3);
  y += 7;
  doc.setFont("DejaVu", "normal");
  doc.setTextColor(30, 34, 44);
  const fontes = [...a.planta.fontes, ...a.corte.fontes.filter((f) => !a.planta.fontes.some((g) => g.codigo === f.codigo))];
  const leg = legendaDe(fontes);
  if (!leg.length) {
    doc.setFontSize(8);
    doc.text("Sem fontes.", cx, y);
    y += 5;
  }
  for (const l of leg) {
    const [r, g, b] = rgbDoCCT(l.cct);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(150, 150, 150);
    doc.circle(cx + 1.4, y - 1, 1.3, "FD");
    doc.setFontSize(8);
    doc.text(textoLinhaLegenda(l), cx + 4.5, y);
    y += 4.6;
    if (y > dy + 70) break;
  }
  y += 3;
  const tip = tipologia(a.tipologiaId);
  const alvo = alvoDoAmbiente(a);
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(8);
  doc.setTextColor(150, 110, 40);
  doc.text("RESUMO DA ESTIMATIVA", cx, y);
  y += 5;
  doc.setTextColor(30, 34, 44);
  const linha = (r: string, v: string) => {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(90, 96, 110);
    doc.text(r, cx, y);
    doc.setTextColor(30, 34, 44);
    doc.setFont("DejaVu", "bold");
    doc.text(v, cx + colW, y, { align: "right" });
    y += 4.4;
  };
  linha("Tipologia", tip.nome.length > 32 ? tip.nome.slice(0, 31) + "…" : tip.nome);
  linha(a.alvoLx != null ? "Alvo do projeto" : "Alvo de referência (NBR)", `${fmt(alvo)} lx`);
  const l = a.calculos.lumens;
  if (l) {
    linha("Área", `${fmt(l.A, 2)} m²`);
    linha("K / FU / FM", `${fmt(l.K, 2)} / ${fmt(l.FU, 2)} / ${fmt(l.FM, 2)}`);
    linha("E_med (método dos lúmens)", `${fmt(l.Emed)} lx`);
    linha("Comparado ao alvo", `${NOME_STATUS[statusAlvo(l.Emed, alvo).status]} (${fmt(statusAlvo(l.Emed, alvo).dif * 100)}%)`);
  }
  const ph = a.calculos.p2pH;
  if (ph) {
    linha("P2P horiz.: E_med", `${fmt(ph.Emed)} lx`);
    linha("P2P horiz.: E_mín / E_máx", `${fmt(ph.Emin)} / ${fmt(ph.Emax)} lx`);
    linha("P2P horiz.: U0", fmt(ph.U0, 2));
  }
  const pv = a.calculos.p2pV;
  if (pv) linha("P2P vert.: E_med / E_máx", `${fmt(pv.Emed)} / ${fmt(pv.Emax)} lx`);
  if (!l && !ph) {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7.5);
    doc.text("Cálculos ainda não feitos para este ambiente.", cx, y);
    y += 5;
  }
  y += 2;
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(90, 96, 110);
  doc.text(doc.splitTextToSize(TEXTO_NBR + " Comparado ao alvo de referência, não é aprovação pela norma.", colW), cx, y);
  y += 10;
  if (comMapa && y < H - 70) {
    doc.text("Mapa de cores do ponto a ponto na página seguinte.", cx, y);
  }
  rodape(doc, W, H);
}

function rotuloImagem(doc: jsPDF, x: number, y: number, t: string) {
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(7);
  doc.setFillColor(20, 24, 34);
  const w = doc.getTextWidth(t) + 4;
  doc.rect(x + 2, y + 2, w, 4.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(t, x + 4, y + 5.4);
}

function paginaMemorial(doc: jsPDF, p: Projeto, a: Ambiente, W: number, H: number) {
  const temMapa = !!a.calculos.p2pH || !!a.calculos.p2pV;
  const temCalc = !!a.calculos.lumens || temMapa;
  if (!temCalc) return;
  doc.addPage();
  cabecalho(doc, p, a, W, "Memorial de cálculo · estimativa");
  const colTexto = temMapa ? 150 : W - 24;
  let y = 24;
  doc.setTextColor(30, 34, 44);
  for (const linha of memorial(a)) {
    if (!linha) {
      y += 2;
      continue;
    }
    const titulo = linha === linha.toUpperCase() && linha.length < 60;
    doc.setFont("DejaVu", titulo ? "bold" : "normal");
    doc.setFontSize(titulo ? 8.4 : 7.6);
    if (titulo) doc.setTextColor(150, 110, 40);
    else doc.setTextColor(30, 34, 44);
    const partes = doc.splitTextToSize(linha, colTexto);
    if (y + partes.length * 3.6 > H - 19) break;
    doc.text(partes, 12, y);
    y += partes.length * 3.6 + 0.6;
  }
  if (temMapa) {
    const mx = 12 + colTexto + 8;
    const mw = W - 12 - mx;
    let my = 24;
    const pxmm = 300 / 25.4;
    if (a.calculos.p2pH) {
      const mh = 70;
      const cv = renderizarQuadro(a, "planta", p.temaQuadro, { largura: Math.round(mw * pxmm * 0.5), altura: Math.round(mh * pxmm * 0.5), mapa: true, dpr: 2 });
      doc.addImage(cv, "PNG", mx, my, mw, mh, undefined, "FAST");
      rotuloImagem(doc, mx, my, "P2P HORIZONTAL");
      my += mh + 2;
      my = escalaPdf(doc, mx, my, mw) + 4;
    }
    if (a.calculos.p2pV?.plano) {
      const r = a.calculos.p2pV;
      const L = Math.hypot(r.plano!.b.x - r.plano!.a.x, r.plano!.b.y - r.plano!.a.y);
      const mh = Math.min(50, (mw * r.plano!.altura) / L);
      const cv = document.createElement("canvas");
      desenharMapaVertical(cv, r, Math.round(mw * pxmm * 0.5), Math.round(mh * pxmm * 0.5), 2);
      doc.addImage(cv, "PNG", mx, my, mw, mh, undefined, "FAST");
      rotuloImagem(doc, mx, my, "P2P VERTICAL (PAREDE)");
      my += mh + 2;
      escalaPdf(doc, mx, my, mw);
    }
  }
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(110, 114, 124);
  doc.text(`Fórmulas ${VERSAO_FORMULAS} · ${VERSAO_TABELA_NBR}`, 12, H - 17);
  rodape(doc, W, H);
}

function escalaPdf(doc: jsPDF, x: number, y: number, w: number): number {
  const passos = [0, 50, 100, 200, 300, 500, 750, 1000];
  const cw = w / passos.length;
  passos.forEach((v, i) => {
    const [r, g, b] = corFalsa(v + 0.01);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * cw, y, cw, 3, "F");
    doc.setFontSize(6);
    doc.setTextColor(60, 64, 74);
    doc.text(String(v), x + i * cw + cw / 2, y + 6, { align: "center" });
  });
  doc.text("lx", x + w, y + 6, { align: "right" });
  return y + 8;
}

function hexParaRgb(h: string): [number, number, number] {
  const x = h.replace("#", "");
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}
