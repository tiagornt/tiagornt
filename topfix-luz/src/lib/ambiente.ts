// Dados derivados do ambiente: contorno, área, legenda, cálculos completos e memorial.

import {
  areaPoligono,
  bbox,
  bloqueadoresDaVista,
  centroide,
  contornoDasParedes,
  dist,
  ehRetangulo,
  ladosRetangulo,
  maiorLado,
  norm,
  perp,
  sub,
  dot,
} from "./geometria";
import { fmt, metodoLumens, quantidadeParaAlvo, statusAlvo } from "./calculo/lumens";
import { emissoresDasFontes, p2pHorizontal, p2pVertical } from "./calculo/p2p";
import { AVISO_PADRAO, NOME_GRUPO, VERSAO_FORMULAS, VERSAO_TABELA_NBR, tipologia } from "./calculo/tabelas";
import type { Ambiente, Fonte, Pt, ResultadoLumens, ResultadoP2P, Vista } from "./tipos";
import { NOME_NATUREZA } from "./tipos";

const cacheContorno = new WeakMap<object, Pt[] | null>();

/** Contorno do ambiente na planta (a partir das paredes), com cache por versão das paredes. */
export function contornoAmbiente(a: Ambiente): Pt[] | null {
  const chave = a.planta.paredes;
  if (cacheContorno.has(chave)) return cacheContorno.get(chave)!;
  const c = contornoDasParedes(a.planta.paredes);
  cacheContorno.set(chave, c);
  return c;
}

export function areaAmbiente(a: Ambiente): number {
  const c = contornoAmbiente(a);
  return c ? Math.abs(areaPoligono(c)) : 0;
}

export const alvoDoAmbiente = (a: Ambiente) => a.alvoLx ?? tipologia(a.tipologiaId).eAlvo;

/** Escala pendente: há fundo (DXF/PDF/imagem) sem validação. */
export function escalaPendente(a: Ambiente): boolean {
  return !!a.planta.fundo && !a.planta.fundo.validadoEm;
}

// ---------- Legenda ----------

export interface LinhaLegenda {
  codigo: string;
  natureza: string;
  cct: number;
  quantidade: number;
  fluxo: number | null;
  exemplo: Fonte;
}

/** Agrupa por código + natureza + CCT e conta (ex.: "L01 · Difusa · 3000 K · 7"). */
export function legendaDe(fontes: Fonte[]): LinhaLegenda[] {
  const mapa = new Map<string, LinhaLegenda>();
  for (const f of fontes) {
    if (!f.visivel) continue;
    const k = `${f.codigo}|${f.natureza}|${Math.round(f.cct)}`;
    const l = mapa.get(k);
    if (l) l.quantidade++;
    else
      mapa.set(k, {
        codigo: f.codigo,
        natureza: NOME_NATUREZA[f.natureza],
        cct: Math.round(f.cct),
        quantidade: 1,
        fluxo: f.fluxo,
        exemplo: f,
      });
  }
  return [...mapa.values()].sort((a, b) => a.codigo.localeCompare(b.codigo) || a.cct - b.cct);
}

export const textoLinhaLegenda = (l: LinhaLegenda) =>
  `${l.codigo} · ${l.natureza} · ${l.cct} K · ${l.quantidade}`;

// ---------- Método dos lúmens do ambiente ----------

export interface TipoNoCalculo {
  codigo: string;
  natureza: string;
  N: number;
  fluxo: number;
  fluxoTipico: boolean;
  alturaMedia: number;
}

export function tiposDoAmbiente(a: Ambiente): { tipos: TipoNoCalculo[]; semFluxo: string[] } {
  const mapa = new Map<string, TipoNoCalculo & { somaAlt: number }>();
  const semFluxo: string[] = [];
  for (const f of a.planta.fontes) {
    if (!f.visivel) continue;
    if (!(f.fluxo && f.fluxo > 0)) {
      if (!semFluxo.includes(f.codigo)) semFluxo.push(f.codigo);
      continue;
    }
    const k = `${f.codigo}|${f.fluxo}`;
    const t = mapa.get(k);
    if (t) {
      t.N++;
      t.somaAlt += f.altura;
      t.fluxoTipico = t.fluxoTipico || !!f.valorTipico;
    } else
      mapa.set(k, {
        codigo: f.codigo,
        natureza: NOME_NATUREZA[f.natureza],
        N: 1,
        fluxo: f.fluxo,
        fluxoTipico: !!f.valorTipico,
        alturaMedia: 0,
        somaAlt: f.altura,
      });
  }
  const tipos = [...mapa.values()].map(({ somaAlt, ...t }) => ({ ...t, alturaMedia: somaAlt / t.N }));
  return { tipos: tipos.sort((x, y) => x.codigo.localeCompare(y.codigo)), semFluxo };
}

export interface DimensoesK {
  A: number;
  C: number;
  L: number;
  retangulo: boolean;
  descricao: string;
}

export function dimensoesParaK(a: Ambiente): DimensoesK | null {
  const c = contornoAmbiente(a);
  if (!c) return null;
  const A = Math.abs(areaPoligono(c));
  const lados = ladosRetangulo(c);
  if (lados && ehRetangulo(c)) {
    return { A, C: lados[0], L: lados[1], retangulo: true, descricao: "ambiente retangular: C e L medidos" };
  }
  if (a.metodoRetangulo === "bbox") {
    const bb = bbox(c);
    return {
      A,
      C: bb.w,
      L: bb.h,
      retangulo: false,
      descricao: "polígono irregular: C e L do menor retângulo alinhado aos eixos",
    };
  }
  const Lmax = maiorLado(c);
  return {
    A,
    C: A / Lmax,
    L: Lmax,
    retangulo: false,
    descricao: "polígono irregular: L = maior lado (L_max) e C = A / L_max",
  };
}

export function alturaMontagem(a: Ambiente, tipos: TipoNoCalculo[]): number {
  if (a.alturaMontagemCalculo != null) return a.alturaMontagemCalculo;
  const somaF = tipos.reduce((s, t) => s + t.N * t.fluxo, 0);
  if (!somaF) return a.peDireito;
  return tipos.reduce((s, t) => s + t.N * t.fluxo * t.alturaMedia, 0) / somaF;
}

export function calcularLumens(a: Ambiente): ResultadoLumens | { erro: string } {
  if (escalaPendente(a)) return { erro: "Escala do fundo pendente: valide a escala antes de calcular." };
  const dim = dimensoesParaK(a);
  if (!dim) return { erro: "O ambiente ainda não tem paredes fechadas. Desenhe ou feche o contorno para calcular a área." };
  const { tipos, semFluxo } = tiposDoAmbiente(a);
  const avisos: string[] = [];
  if (semFluxo.length) avisos.push(`Sem fluxo informado (fora do cálculo): ${semFluxo.join(", ")}. Informe o fluxo (lm).`);
  if (tipos.some((t) => t.fluxoTipico)) avisos.push("Há fluxos com valor típico de biblioteca: confirme com a ficha da luminária.");
  const alt = alturaMontagem(a, tipos);
  const hm = alt - a.alturaPlano;
  if (!(hm > 0)) return { erro: "Altura de montagem precisa ficar acima do plano de trabalho." };
  const r = metodoLumens({
    A: dim.A,
    C: dim.C,
    L: dim.L,
    hm,
    FM: a.fm,
    grupo: a.grupoCores,
    rho: a.rho,
    tipos: tipos.map((t) => ({ codigo: t.codigo, N: t.N, fluxo: t.fluxo })),
  });
  return {
    versao: VERSAO_FORMULAS,
    calculadoEm: new Date().toISOString(),
    entradas: {
      tipos,
      descricaoDim: dim.descricao,
      descricaoFU: r.descricaoFU,
      grupo: a.grupoCores,
      rho: a.rho,
      alturaPlano: a.alturaPlano,
      alturaMontagem: alt,
      tipologiaId: a.tipologiaId,
      alvoProprio: a.alvoLx != null,
    },
    A: dim.A,
    C: dim.C,
    L: dim.L,
    hm,
    K: r.K,
    FU: r.FU,
    FM: a.fm,
    somaFluxo: r.somaFluxo,
    Emed: r.Emed,
    Ealvo: alvoDoAmbiente(a),
    avisos: [...avisos, ...r.avisos],
  };
}

export function sugerirQuantidade(a: Ambiente, codigo: string): { N: number; atual: number; fluxo: number } | null {
  const r = calcularLumens(a);
  if ("erro" in r) return null;
  const { tipos } = tiposDoAmbiente(a);
  const t = tipos.find((x) => x.codigo === codigo);
  if (!t) return null;
  const outros = tipos.filter((x) => x !== t).reduce((s, x) => s + x.N * x.fluxo, 0);
  const N = quantidadeParaAlvo(alvoDoAmbiente(a), r.A, t.fluxo, r.FU, r.FM, outros);
  return { N, atual: t.N, fluxo: t.fluxo };
}

// ---------- Ponto a ponto do ambiente ----------

export function calcularP2PH(a: Ambiente): ResultadoP2P | { erro: string } {
  if (escalaPendente(a)) return { erro: "Escala do fundo pendente: valide a escala antes de calcular." };
  const c = contornoAmbiente(a);
  if (!c) return { erro: "O ambiente ainda não tem paredes fechadas." };
  const { emissores, semDado } = emissoresDasFontes(a.planta.fontes);
  const avisos: string[] = [];
  if (semDado.length) avisos.push(`Sem fluxo nem intensidade (fora do cálculo): ${semDado.join(", ")}.`);
  if (!emissores.length) return { erro: "Nenhuma fonte com fluxo ou intensidade para calcular." };
  const bloq = bloqueadoresDaVista(a.planta);
  const g = p2pHorizontal(c, a.alturaPlano, a.p2p.espacamento, a.p2p.margem, emissores, bloq);
  return { versao: VERSAO_FORMULAS, calculadoEm: new Date().toISOString(), tipo: "h", ...g, avisos };
}

/** Normal do plano vertical apontando para o lado do ambiente (centroide). */
export function normalDoPlano(a: Ambiente, p: { a: Pt; b: Pt }): Pt {
  const n = perp(norm(sub(p.b, p.a)));
  const c = contornoAmbiente(a);
  const ref = c ? centroide(c) : null;
  if (ref) {
    const meio = { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 };
    if (dot(sub(ref, meio), n) < 0) return { x: -n.x, y: -n.y };
  }
  return n;
}

export function calcularP2PV(a: Ambiente): ResultadoP2P | { erro: string } {
  if (escalaPendente(a)) return { erro: "Escala do fundo pendente: valide a escala antes de calcular." };
  const plano = a.p2p.planoVertical;
  if (!plano || dist(plano.a, plano.b) < 0.1) return { erro: "Escolha a parede (ou desenhe o segmento) do plano vertical." };
  const { emissores, semDado } = emissoresDasFontes(a.planta.fontes);
  if (!emissores.length) return { erro: "Nenhuma fonte com fluxo ou intensidade para calcular." };
  const avisos: string[] = [];
  if (semDado.length) avisos.push(`Sem fluxo nem intensidade (fora do cálculo): ${semDado.join(", ")}.`);
  const n = normalDoPlano(a, plano);
  const bloq = bloqueadoresDaVista(a.planta);
  const g = p2pVertical(plano.a, plano.b, n, a.peDireito, a.p2p.espacamento, a.p2p.margem, emissores, bloq);
  return {
    versao: VERSAO_FORMULAS,
    calculadoEm: new Date().toISOString(),
    tipo: "v",
    ...g,
    plano: { a: plano.a, b: plano.b, altura: a.peDireito },
    avisos,
  };
}

// ---------- Memorial ----------

export function memorial(a: Ambiente): string[] {
  const linhas: string[] = [];
  const tip = tipologia(a.tipologiaId);
  linhas.push(`Ambiente: ${a.nome}. Tipologia: ${tip.nome} (${tip.uso}).`);
  linhas.push(
    `Alvo: ${fmt(alvoDoAmbiente(a))} lx ${a.alvoLx != null ? "(alvo próprio do projeto)" : "(tabela de referência NBR ISO/CIE 8995-1)"}.`,
  );
  const l = a.calculos.lumens;
  if (l) {
    const e = l.entradas as { tipos?: TipoNoCalculo[]; descricaoDim?: string; descricaoFU?: string; alturaMontagem?: number };
    linhas.push("");
    linhas.push("MÉTODO DOS LÚMENS");
    linhas.push("E_med = (Σ N_i × Φ_i × FU × FM) / A");
    linhas.push("N = (E_alvo × A) / (Φ × FU × FM), arredondado para cima");
    linhas.push("K = (C × L) / (h_m × (C + L))");
    linhas.push(
      `A = ${fmt(l.A, 2)} m²; C = ${fmt(l.C, 2)} m; L = ${fmt(l.L, 2)} m (${e.descricaoDim ?? ""}).`,
    );
    linhas.push(
      `h_m = altura de montagem ${fmt(e.alturaMontagem ?? 0, 2)} m - plano ${fmt(a.alturaPlano, 2)} m = ${fmt(l.hm, 2)} m.`,
    );
    linhas.push(`K = ${fmt(l.K, 2)}; FU = ${fmt(l.FU, 2)} (${e.descricaoFU ?? ""}); FM = ${fmt(l.FM, 2)}.`);
    linhas.push(`Refletâncias (${NOME_GRUPO[a.grupoCores]}): teto ${fmt(a.rho.teto, 2)}, paredes ${fmt(a.rho.paredes, 2)}, piso ${fmt(a.rho.piso, 2)}.`);
    for (const t of e.tipos ?? []) linhas.push(`${t.codigo} (${t.natureza}): N = ${t.N}, Φ = ${fmt(t.fluxo)} lm${t.fluxoTipico ? " (valor típico, confirme)" : ""}.`);
    linhas.push(`Σ N × Φ = ${fmt(l.somaFluxo)} lm. E_med estimada = ${fmt(l.Emed)} lx.`);
    const st = statusAlvo(l.Emed, l.Ealvo);
    if (l.Ealvo) linhas.push(`Comparado ao alvo de referência: ${fmt(st.dif * 100, 0)}%.`);
    for (const av of l.avisos) linhas.push(`Observação: ${av}`);
    linhas.push("FU único por ambiente (simplificação da Fase 1). Sem inter-reflexão além do FU tabelado.");
  }
  const ph = a.calculos.p2pH;
  const pv = a.calculos.p2pV;
  if (ph || pv) {
    const { conversoes } = emissoresDasFontes(a.planta.fontes);
    linhas.push("");
    linhas.push("PONTO A PONTO (SÓ COMPONENTE DIRETA)");
    linhas.push("d = √((x_P - x_S)² + (y_P - y_S)² + (z_P - z_S)²); cos θ = h / d");
    linhas.push("I(α) = I_0 × cos α, se α ≤ α_abe; senão 0");
    linhas.push("E(S→P) = I(α) × cos θ / d² = I(α) × cos³ θ / h² (plano horizontal); E_P = Σ E(S→P)");
    for (const c of conversoes) linhas.push(`${c.codigo}: ${c.texto}.`);
    linhas.push("Paredes e limites bloqueiam a fonte quando cruzam a projeção horizontal do raio (sombra 2D simplificada).");
    linhas.push("A intensidade relativa (%) do croqui é só visual e não entra no cálculo.");
    if (ph)
      linhas.push(
        `Horizontal (plano a ${fmt(a.alturaPlano, 2)} m, grade ${fmt(ph.grade.passo, 2)} m, ${ph.pontos} pontos${a.p2p.margem ? ", margem de 0,20 m" : ""}): E_med ${fmt(ph.Emed)} lx, E_mín ${fmt(ph.Emin)} lx, E_máx ${fmt(ph.Emax)} lx, U0 ${fmt(ph.U0, 2)}.`,
      );
    if (pv)
      linhas.push(
        `Vertical (plano de ${fmt(dist(pv.plano!.a, pv.plano!.b), 2)} m × ${fmt(pv.plano!.altura, 2)} m, ${pv.pontos} pontos): E_med ${fmt(pv.Emed)} lx, E_mín ${fmt(pv.Emin)} lx, E_máx ${fmt(pv.Emax)} lx, U0 ${fmt(pv.U0, 2)}.`,
      );
  }
  linhas.push("");
  linhas.push(`Versão das fórmulas: ${VERSAO_FORMULAS}. Tabela de alvos: ${VERSAO_TABELA_NBR}.`);
  linhas.push(AVISO_PADRAO);
  return linhas;
}

export function vistaTemConteudo(v: Vista): boolean {
  return !!(v.paredes.length || v.linhas.length || v.fontes.length || v.fundo || v.textos.length);
}
