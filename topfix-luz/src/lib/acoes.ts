"use client";

// Ações de edição sobre a vista atual. Todas passam pelo histórico (desfazer/refazer).

import { contornoAmbiente } from "./ambiente";
import { fonteDoPreset, PADRAO_NATUREZA, presetPorId, PRESETS } from "./presets";
import { paredesRetangulo, proximoCodigo } from "./fabrica";
import {
  bbox,
  dist,
  distSegmento,
  intersecaoSegmentos,
  lerp,
  pontoNoPoligono,
  recuarPoligono,
  sub,
  dot,
  norm,
  uid,
  dirDeg,
} from "./geometria";
import { ambienteAtual, mudarAmbiente, mudarVista, useEditor, vistaDe, type ItemSel } from "./store";
import type { Ambiente, Fonte, Natureza, Pt, Vista } from "./tipos";

const est = () => useEditor.getState();

export function vistaAtualSnapshot(): Vista | null {
  const s = est();
  const a = ambienteAtual(s);
  return a ? vistaDe(a, s.vista) : null;
}

/** Cria um ambiente retangular (medidas internas). Se já houver paredes, coloca ao lado. */
export function criarRetangulo(w: number, h: number, origem?: Pt) {
  if (!(w > 0) || !(h > 0)) return;
  mudarVista((v) => {
    let o = origem;
    if (!o) {
      if (v.paredes.length) {
        const bb = bbox(v.paredes.flatMap((p) => [p.a, p.b]));
        o = { x: bb.maxX + 1, y: bb.minY };
      } else o = { x: 0, y: 0 };
    }
    v.paredes.push(...paredesRetangulo(o.x, o.y, w, h));
  });
  est().set({ pedidoEnquadrar: est().pedidoEnquadrar + 1 });
}

export function adicionarFonte(natureza: Natureza, pos: Pt, presetId?: string) {
  const s = est();
  const a = ambienteAtual(s);
  if (!a) return;
  const v = vistaDe(a, s.vista);
  const id = presetId ?? s.presetPorNatureza[natureza] ?? PADRAO_NATUREZA[natureza];
  const preset = presetPorId(id) ?? PRESETS.find((p) => p.natureza === natureza)!;
  // mesmo preset já usado na vista: reaproveita o código (mesmo tipo de luminária)
  const igual = v.fontes.find((f) => f.presetId === preset.id && f.natureza === preset.natureza);
  const codigo = igual ? igual.codigo : proximoCodigo(v.fontes);
  const nova = fonteDoPreset(preset, pos, a.peDireito, codigo, uid("fnt_"), s.vista);
  if (igual) {
    // copia os valores já ajustados do tipo
    Object.assign(nova, {
      cct: igual.cct,
      intensidadePct: igual.intensidadePct,
      fluxo: igual.fluxo,
      intensidadeCd: igual.intensidadeCd,
      potencia: igual.potencia,
      abertura: igual.abertura,
      comprimento: igual.comprimento,
      tilt: igual.tilt,
      valorTipico: igual.valorTipico,
      altura: s.vista === "corte" ? pos.y : igual.altura,
      rotacao: igual.rotacao,
    });
  }
  mudarVista((vv) => {
    vv.fontes.push(nova);
  });
  est().set({ selecao: [{ tipo: "fonte", id: nova.id }] });
}

export function apagarSelecao() {
  const sel = est().selecao;
  if (!sel.length) return;
  const ids = new Set(sel.map((x) => x.id));
  mudarVista((v) => {
    v.fontes = v.fontes.filter((f) => !ids.has(f.id));
    v.paredes = v.paredes.filter((p) => !ids.has(p.id));
    v.aberturas = v.aberturas.filter((x) => !ids.has(x.id) && !ids.has(x.paredeId));
    v.linhas = v.linhas.filter((x) => !ids.has(x.id));
    v.cotas = v.cotas.filter((x) => !ids.has(x.id));
    v.textos = v.textos.filter((x) => !ids.has(x.id));
  });
  est().set({ selecao: [] });
}

export function duplicarSelecao(desloc = 0.5) {
  const sel = est().selecao;
  if (!sel.length) return;
  const ids = new Set(sel.map((x) => x.id));
  const novos: ItemSel[] = [];
  mudarVista((v) => {
    for (const f of v.fontes.filter((x) => ids.has(x.id))) {
      const n = { ...f, id: uid("fnt_"), x: f.x + desloc, y: f.y - desloc };
      v.fontes.push(n);
      novos.push({ tipo: "fonte", id: n.id });
    }
    for (const l of v.linhas.filter((x) => ids.has(x.id))) {
      const n = { ...l, id: uid("lin_"), a: { x: l.a.x + desloc, y: l.a.y - desloc }, b: { x: l.b.x + desloc, y: l.b.y - desloc } };
      v.linhas.push(n);
      novos.push({ tipo: "linha", id: n.id });
    }
    for (const t of v.textos.filter((x) => ids.has(x.id))) {
      const n = { ...t, id: uid("txt_"), p: { x: t.p.x + desloc, y: t.p.y - desloc } };
      v.textos.push(n);
      novos.push({ tipo: "texto", id: n.id });
    }
    for (const p of v.paredes.filter((x) => ids.has(x.id))) {
      const n = { ...p, id: uid("par_"), a: { x: p.a.x + desloc, y: p.a.y - desloc }, b: { x: p.b.x + desloc, y: p.b.y - desloc } };
      v.paredes.push(n);
      novos.push({ tipo: "parede", id: n.id });
    }
  });
  if (novos.length) est().set({ selecao: novos });
}

export function fontesSelecionadas(v: Vista | null): Fonte[] {
  if (!v) return [];
  const ids = new Set(est().selecao.filter((x) => x.tipo === "fonte").map((x) => x.id));
  return v.fontes.filter((f) => ids.has(f.id));
}

export function alinhar(eixo: "x" | "y") {
  const v = vistaAtualSnapshot();
  const fs = fontesSelecionadas(v);
  if (fs.length < 2) return;
  const media = fs.reduce((s, f) => s + f[eixo], 0) / fs.length;
  const ids = new Set(fs.map((f) => f.id));
  mudarVista((vv) => {
    for (const f of vv.fontes) if (ids.has(f.id)) f[eixo] = Math.round(media * 1000) / 1000;
  });
}

export function distribuir(eixo: "x" | "y") {
  const v = vistaAtualSnapshot();
  const fs = [...fontesSelecionadas(v)].sort((a, b) => a[eixo] - b[eixo]);
  if (fs.length < 3) return;
  const ini = fs[0][eixo];
  const fim = fs[fs.length - 1][eixo];
  const passo = (fim - ini) / (fs.length - 1);
  const pos = new Map(fs.map((f, i) => [f.id, ini + passo * i]));
  mudarVista((vv) => {
    for (const f of vv.fontes) if (pos.has(f.id)) f[eixo] = Math.round(pos.get(f.id)! * 1000) / 1000;
  });
}

/** Copia CCT e intensidade da primeira fonte selecionada para as outras. */
export function copiarPropriedades() {
  const v = vistaAtualSnapshot();
  const fs = fontesSelecionadas(v);
  if (fs.length < 2) return;
  const [base, ...resto] = fs;
  const ids = new Set(resto.map((f) => f.id));
  mudarVista((vv) => {
    for (const f of vv.fontes)
      if (ids.has(f.id)) {
        f.cct = base.cct;
        f.intensidadePct = base.intensidadePct;
      }
  });
}

/**
 * Redistribui as fontes de um código numa grade regular dentro do ambiente,
 * com N peças (usado pelo "sugerir quantidade" do método dos lúmens).
 */
export function aplicarQuantidade(codigo: string, N: number) {
  const s = est();
  const a = ambienteAtual(s);
  if (!a) return;
  const c = contornoAmbiente(a);
  if (!c || N < 1) return;
  const modelo = a.planta.fontes.find((f) => f.codigo === codigo);
  if (!modelo) return;
  const pontos = gradeNoPoligono(c, N);
  mudarAmbiente((am) => {
    const outras = am.planta.fontes.filter((f) => f.codigo !== codigo);
    const novas: Fonte[] = pontos.map((p, i) => ({ ...modelo, id: i === 0 ? modelo.id : uid("fnt_"), x: p.x, y: p.y }));
    am.planta.fontes = [...outras, ...novas];
  });
}

/** N pontos bem distribuídos dentro do polígono (grade com proporção do ambiente). */
export function gradeNoPoligono(poli: Pt[], N: number): Pt[] {
  const area = recuarPoligono(poli, 0.3);
  const bb = bbox(poli);
  for (let tent = 0; tent < 30; tent++) {
    const alvo = N + tent;
    const nx = Math.max(1, Math.round(Math.sqrt((alvo * bb.w) / Math.max(0.1, bb.h))));
    const ny = Math.max(1, Math.ceil(alvo / nx));
    const pts: Pt[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = { x: bb.minX + (bb.w * (i + 0.5)) / nx, y: bb.minY + (bb.h * (j + 0.5)) / ny };
        if (pontoNoPoligono(p, area)) pts.push({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
      }
    if (pts.length >= N) return pts.slice(0, N);
  }
  return [];
}

/** Gera (ou regenera) o corte esquemático a partir de uma linha desenhada na planta. */
export function gerarCorte(a: Ambiente, linha: { a: Pt; b: Pt }) {
  const c = contornoAmbiente(a);
  const L0 = dist(linha.a, linha.b);
  if (L0 < 0.2) return;
  const u = norm(sub(linha.b, linha.a));
  // trecho do corte dentro do ambiente: interseções da linha (estendida) com o contorno
  let t0 = 0;
  let t1 = L0;
  if (c) {
    const ts: number[] = [];
    const A = { x: linha.a.x - u.x * 100, y: linha.a.y - u.y * 100 };
    const B = { x: linha.b.x + u.x * 100, y: linha.b.y + u.y * 100 };
    for (let i = 0; i < c.length; i++) {
      const r = intersecaoSegmentos(A, B, c[i], c[(i + 1) % c.length]);
      if (r) ts.push(r.t * dist(A, B) - 100);
    }
    if (ts.length >= 2) {
      t0 = Math.min(...ts);
      t1 = Math.max(...ts);
    }
  }
  const W = Math.max(0.5, t1 - t0);
  const H = a.peDireito;
  const e = 0.15;
  const parede = (ax: number, ay: number, bx: number, by: number, lado: "direita" | "esquerda") => ({
    id: uid("par_"),
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    espessura: e,
    lado,
    bloqueia: true,
  });
  // vãos das paredes vistas ao fundo (lado esquerdo da linha de corte), em elevação
  const n = { x: -u.y, y: u.x };
  const refs: { a: Pt; b: Pt }[] = [];
  for (const ab of a.planta.aberturas) {
    const p = a.planta.paredes.find((w) => w.id === ab.paredeId);
    if (!p) continue;
    const dp = norm(sub(p.b, p.a));
    if (Math.abs(dot(dp, u)) < 0.9) continue; // só paredes paralelas ao corte
    const meio = lerp(p.a, p.b, ab.t);
    if (dot(sub(meio, linha.a), n) < 0) continue; // atrás de quem olha
    const s = dot(sub(meio, linha.a), u) - t0;
    const x0 = s - ab.largura / 2;
    const x1 = s + ab.largura / 2;
    const y0 = ab.tipo === "janela" ? ab.peitoril : 0;
    const y1 = Math.min(H, y0 + ab.altura);
    refs.push({ a: { x: x0, y: y0 }, b: { x: x1, y: y0 } }, { a: { x: x1, y: y0 }, b: { x: x1, y: y1 } }, { a: { x: x1, y: y1 }, b: { x: x0, y: y1 } }, { a: { x: x0, y: y1 }, b: { x: x0, y: y0 } });
  }
  mudarAmbiente((am) => {
    const fontesAntigas = am.corte.fontes;
    am.corte.linhaCorte = linha;
    am.corte.paredes = [
      parede(0, 0, W, 0, "direita"), // piso
      parede(W, 0, W, H, "direita"),
      parede(W, H, 0, H, "direita"), // teto
      parede(0, H, 0, 0, "direita"),
    ];
    am.corte.linhas = [
      ...am.corte.linhas.filter((l) => l.tipo === "limite"),
      ...refs.map((r) => ({ id: uid("lin_"), a: r.a, b: r.b, tipo: "referencia" as const })),
    ];
    am.corte.fontes = fontesAntigas;
  });
}

/** Traz as fontes da planta para o corte (projetadas na linha de corte, perto dela). */
export function trazerFontesParaCorte(faixa = 1.5) {
  const s = est();
  const a = ambienteAtual(s);
  if (!a?.corte.linhaCorte) return 0;
  const lc = a.corte.linhaCorte;
  const u = norm(sub(lc.b, lc.a));
  const xs = a.corte.paredes.flatMap((p) => [p.a.x, p.b.x]);
  const W = xs.length ? Math.max(...xs) : dist(lc.a, lc.b);
  // descobre t0 pelo mesmo critério do gerarCorte: o x=0 do corte é o início do ambiente na linha
  const c = contornoAmbiente(a);
  let t0 = 0;
  if (c) {
    const A = { x: lc.a.x - u.x * 100, y: lc.a.y - u.y * 100 };
    const B = { x: lc.b.x + u.x * 100, y: lc.b.y + u.y * 100 };
    const ts: number[] = [];
    for (let i = 0; i < c.length; i++) {
      const r = intersecaoSegmentos(A, B, c[i], c[(i + 1) % c.length]);
      if (r) ts.push(r.t * dist(A, B) - 100);
    }
    if (ts.length >= 2) t0 = Math.min(...ts);
  }
  let n = 0;
  mudarAmbiente((am) => {
    for (const f of am.planta.fontes) {
      const r = distSegmento({ x: f.x, y: f.y }, { x: lc.a.x - u.x * 100, y: lc.a.y - u.y * 100 }, { x: lc.b.x + u.x * 100, y: lc.b.y + u.y * 100 });
      if (r.d > faixa) continue;
      const x = dot(sub({ x: f.x, y: f.y }, lc.a), u) - t0;
      if (x < -0.05 || x > W + 0.05) continue;
      am.corte.fontes.push({
        ...f,
        id: uid("fnt_"),
        x,
        y: f.altura,
        // no corte, x = direção da linha: o facho inclinado gira para o lado em que aponta na planta
        rotacao: f.natureza === "facho" ? -90 + (f.tilt || 0) * (dot(dirDeg(f.rotacao), u) >= 0 ? 1 : -1) : -90,
      });
      n++;
    }
  });
  return n;
}

/** Calibra a escala do fundo: duas pontas (mundo) e a medida real. Opcional: redimensiona o desenho. */
export function aplicarCalibracao(p1: Pt, p2: Pt, medidaM: number, redimensionarDesenho: boolean) {
  const med = dist(p1, p2);
  if (!(med > 1e-6) || !(medidaM > 0)) return;
  const k = medidaM / med;
  const esc = (p: Pt): Pt => ({ x: p1.x + (p.x - p1.x) * k, y: p1.y + (p.y - p1.y) * k });
  mudarVista((v) => {
    const f = v.fundo;
    if (!f) return;
    if (f.imagem) {
      const o = esc({ x: f.imagem.x, y: f.imagem.y });
      f.imagem.x = o.x;
      f.imagem.y = o.y;
      f.imagem.escala *= k;
    }
    if (f.entidades) {
      for (const e of f.entidades)
        for (let i = 0; i < e.pts.length; i += 2) {
          const q = esc({ x: e.pts[i], y: e.pts[i + 1] });
          e.pts[i] = q.x;
          e.pts[i + 1] = q.y;
        }
    }
    f.calibracao = { p1: esc(p1), p2: esc(p2), medidaM };
    f.validadoEm = new Date().toISOString();
    if (redimensionarDesenho) {
      for (const p of v.paredes) {
        p.a = esc(p.a);
        p.b = esc(p.b);
      }
      for (const l of v.linhas) {
        l.a = esc(l.a);
        l.b = esc(l.b);
      }
      for (const c of v.cotas) {
        c.a = esc(c.a);
        c.b = esc(c.b);
      }
      for (const t of v.textos) t.p = esc(t.p);
      for (const fo of v.fontes) {
        const q = esc({ x: fo.x, y: fo.y });
        fo.x = q.x;
        fo.y = q.y;
      }
    }
  });
}
