"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ambienteAtual, mudarAmbiente, mudarVista, useEditor, vistaDe, type Ferramenta, type ItemSel } from "@/lib/store";
import { enquadrar, paraMundo, paraTela, type Camera } from "@/lib/render/camera";
import { alcaRotacao, COR_MARCA, COR_SELECAO, desenharQuadro, limitesDaVista, quandoImagemCarregar } from "@/lib/render/desenho";
import { add, deg, dist, distSegmento, lerp, norm, sub, uid } from "@/lib/geometria";
import { adicionarFonte, apagarSelecao, criarRetangulo, duplicarSelecao, gerarCorte } from "@/lib/acoes";
import { fmt } from "@/lib/calculo/lumens";
import type { Ambiente, Natureza, Pt, Vista } from "@/lib/tipos";
import { contornoAmbiente } from "@/lib/ambiente";
import { DialogoCalibrar } from "./DialogoCalibrar";

type Arrasto =
  | { tipo: "pan"; x: number; y: number; cam: Camera }
  | { tipo: "mover"; inicio: Pt; itens: ItemSel[]; base: Vista; moveu: boolean }
  | { tipo: "ponta"; alvo: { tipo: "parede" | "linha" | "cota"; id: string; ponta: "a" | "b" }; original: Pt; base: Vista }
  | { tipo: "rotacao"; id: string }
  | { tipo: "caixa"; inicio: Pt; atual: Pt }
  | { tipo: "retangulo"; inicio: Pt; atual: Pt }
  | { tipo: "fundo"; inicio: Pt; base: Vista };

const NATUREZAS_FERRAMENTA: Natureza[] = ["facho", "linear_dirigido", "linha_difusa", "difusa"];
const FERRAMENTAS_DOIS_PONTOS: Ferramenta[] = ["limite", "referencia", "cota", "medir", "calibrar", "plano_vertical", "linha_corte"];

export function Quadro() {
  const ref = useRef<HTMLCanvasElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 800, h: 600 });
  const camRef = useRef<Camera>({ s: 60, ox: 200, oy: 500 });
  const [, forcar] = useState(0);
  const redesenhar = useCallback(() => forcar((n) => n + 1), []);

  const projeto = useEditor((s) => s.projeto);
  const ambienteId = useEditor((s) => s.ambienteId);
  const vistaNome = useEditor((s) => s.vista);
  const ferramenta = useEditor((s) => s.ferramenta);
  const selecao = useEditor((s) => s.selecao);
  const camadas = useEditor((s) => s.camadas);
  const aba = useEditor((s) => s.aba);
  const snapAtivo = useEditor((s) => s.snapAtivo);
  const passoSnap = useEditor((s) => s.passoSnap);
  const pedidoEnquadrar = useEditor((s) => s.pedidoEnquadrar);
  const amb = ambienteAtual({ projeto, ambienteId });
  const vista = amb ? vistaDe(amb, vistaNome) : null;

  // estado da interação
  const arrasto = useRef<Arrasto | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [snapTipo, setSnapTipo] = useState<"ponta" | "grade" | "angulo" | null>(null);
  const [pontos, setPontos] = useState<Pt[]>([]); // polilinha de parede ou primeiro ponto de 2 pontos
  const [buffer, setBuffer] = useState("");
  const [medida, setMedida] = useState<{ a: Pt; b: Pt } | null>(null);
  const [calibrar, setCalibrar] = useState<{ a: Pt; b: Pt } | null>(null);
  const espaco = useRef(false);
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ d: number; cx: number; cy: number; cam: Camera } | null>(null);

  // tamanho
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setTam({ w: Math.max(100, Math.floor(r.width)), h: Math.max(100, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => quandoImagemCarregar(redesenhar), [redesenhar]);

  // zoom pelos botões da barra (centro do quadro)
  useEffect(() => {
    const f = (e: Event) => {
      const k = (e as CustomEvent<number>).detail;
      mexeuNaCamera.current = true;
      const cam = camRef.current;
      const sx = tam.w / 2;
      const sy = tam.h / 2;
      const w = paraMundo(cam, sx, sy);
      const s = Math.max(5, Math.min(2000, cam.s * k));
      camRef.current = { s, ox: sx - w.x * s, oy: sy + w.y * s };
      redesenhar();
    };
    window.addEventListener("quadro-zoom", f);
    return () => window.removeEventListener("quadro-zoom", f);
  }, [tam.w, tam.h, redesenhar]);

  // enquadrar quando pedido, ao trocar de ambiente ou de vista
  const enquadrarAgora = useCallback(() => {
    const s = useEditor.getState();
    const a = ambienteAtual(s);
    if (!a) return;
    const v = vistaDe(a, s.vista);
    const bb = limitesDaVista(v);
    camRef.current = bb ? enquadrar(bb, tam.w, tam.h, 70) : { s: 60, ox: tam.w / 2 - 3 * 60, oy: tam.h / 2 + 2 * 60 };
    redesenhar();
  }, [tam.w, tam.h, redesenhar]);

  // o usuário já mexeu na câmera (pan/zoom)? Se não, o quadro se reenquadra quando muda de tamanho.
  const mexeuNaCamera = useRef(false);
  useEffect(() => {
    mexeuNaCamera.current = false;
    enquadrarAgora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoEnquadrar, ambienteId, vistaNome]);
  useEffect(() => {
    if (!mexeuNaCamera.current) enquadrarAgora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tam.w, tam.h]);

  // limpa o desenho em andamento ao trocar de ferramenta
  useEffect(() => {
    setPontos([]);
    setBuffer("");
    setMedida(null);
  }, [ferramenta, vistaNome, ambienteId]);

  // ---------- desenho ----------
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !amb || !projeto) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = tam.w * dpr;
    cv.height = tam.h * dpr;
    const ctx = cv.getContext("2d")!;
    const mapa = aba === "p2ph" && vistaNome === "planta" ? amb.calculos.p2pH : null;
    desenharQuadro(ctx, {
      cam: camRef.current,
      dpr,
      largura: tam.w,
      altura: tam.h,
      tema: projeto.temaQuadro,
      ambiente: amb,
      vista: vistaNome,
      camadas,
      selecao: new Set(selecao.map((s) => s.id)),
      mapa,
      grade: true,
      extrasPlanta: true,
    });
    desenharPrevia(ctx, dpr);
  });

  function desenharPrevia(ctx: CanvasRenderingContext2D, dpr: number) {
    const cam = camRef.current;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = (p: Pt) => paraTela(cam, p);
    const linha = (a: Pt, b: Pt, cor: string, larg = 1.5, tracejado = false) => {
      const A = T(a);
      const B = T(b);
      ctx.strokeStyle = cor;
      ctx.lineWidth = larg;
      ctx.setLineDash(tracejado ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const rotulo = (p: Pt, t: string) => {
      const P = T(p);
      ctx.font = '700 12px "Inter", system-ui, sans-serif';
      const w = ctx.measureText(t).width + 12;
      ctx.fillStyle = "rgba(10,14,24,0.85)";
      ctx.beginPath();
      ctx.roundRect(P.x + 12, P.y - 26, w, 20, 5);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(t, P.x + 18, P.y - 16);
    };
    // parede em andamento
    if ((ferramenta === "parede" || FERRAMENTAS_DOIS_PONTOS.includes(ferramenta)) && pontos.length) {
      for (let i = 0; i < pontos.length - 1; i++) linha(pontos[i], pontos[i + 1], COR_SELECAO, 3);
      if (cursor) {
        const ult = pontos[pontos.length - 1];
        const cor = ferramenta === "calibrar" ? "#f0c060" : COR_SELECAO;
        linha(ult, cursor, cor, 2, true);
        rotulo(cursor, `${fmt(dist(ult, cursor), 2)} m${ferramenta === "parede" ? `  ${fmt(((deg(Math.atan2(cursor.y - ult.y, cursor.x - ult.x)) + 360) % 360), 0)}°` : ""}`);
      }
    }
    // retângulo arrastado
    const ar = arrasto.current;
    if (ar && (ar.tipo === "retangulo" || ar.tipo === "caixa")) {
      const A = T(ar.inicio);
      const B = T(ar.atual);
      ctx.strokeStyle = ar.tipo === "caixa" ? "rgba(86,199,245,0.9)" : COR_SELECAO;
      ctx.fillStyle = ar.tipo === "caixa" ? "rgba(86,199,245,0.08)" : "rgba(86,199,245,0.06)";
      ctx.setLineDash(ar.tipo === "caixa" ? [4, 3] : []);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.abs(B.x - A.x), Math.abs(B.y - A.y));
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (ar.tipo === "retangulo")
        rotulo(ar.atual, `${fmt(Math.abs(ar.atual.x - ar.inicio.x), 2)} × ${fmt(Math.abs(ar.atual.y - ar.inicio.y), 2)} m`);
    }
    // medida feita
    if (medida) {
      linha(medida.a, medida.b, "#f0c060", 2);
      rotulo(medida.b, `${fmt(dist(medida.a, medida.b), 3)} m`);
    }
    // prévia de porta/janela
    if ((ferramenta === "porta" || ferramenta === "janela") && cursor && vista) {
      const alvo = paredeProxima(cursor, vista, 14 / cam.s);
      if (alvo) {
        const largura = ferramenta === "porta" ? 0.8 : 1.2;
        const p = vista.paredes.find((w) => w.id === alvo.id)!;
        const L = dist(p.a, p.b);
        const t = Math.max(largura / 2 / L, Math.min(1 - largura / 2 / L, alvo.t));
        const d = norm(sub(p.b, p.a));
        const m = lerp(p.a, p.b, t);
        linha({ x: m.x - (d.x * largura) / 2, y: m.y - (d.y * largura) / 2 }, { x: m.x + (d.x * largura) / 2, y: m.y + (d.y * largura) / 2 }, COR_MARCA, 6);
      }
    }
    // prévia do plano vertical: parede sob o cursor
    if ((ferramenta === "promover" || ferramenta === "plano_vertical") && cursor && vista && !pontos.length) {
      if (ferramenta === "plano_vertical") {
        const alvo = paredeProxima(cursor, vista, 12 / cam.s);
        if (alvo) {
          const p = vista.paredes.find((w) => w.id === alvo.id)!;
          linha(p.a, p.b, COR_SELECAO, 5);
        }
      } else {
        const s = segmentoDxfProximo(cursor, vista, 10 / cam.s);
        if (s) linha(s.a, s.b, COR_MARCA, 4);
      }
    }
    // cursor com snap
    if (cursor && ferramenta !== "selecionar" && ferramenta !== "mao") {
      const P = T(cursor);
      ctx.strokeStyle = snapTipo === "ponta" ? "#7CFC9A" : "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (snapTipo === "ponta") ctx.rect(P.x - 6, P.y - 6, 12, 12);
      else {
        ctx.moveTo(P.x - 8, P.y);
        ctx.lineTo(P.x + 8, P.y);
        ctx.moveTo(P.x, P.y - 8);
        ctx.lineTo(P.x, P.y + 8);
      }
      ctx.stroke();
    }
    // alças das pontas selecionadas
    if (vista) {
      ctx.fillStyle = "#0b111d";
      ctx.strokeStyle = COR_SELECAO;
      ctx.lineWidth = 1.5;
      for (const s of selecao) {
        const item =
          s.tipo === "parede" ? vista.paredes.find((x) => x.id === s.id) : s.tipo === "linha" ? vista.linhas.find((x) => x.id === s.id) : s.tipo === "cota" ? vista.cotas.find((x) => x.id === s.id) : null;
        if (!item) continue;
        for (const p of [item.a, item.b]) {
          const P = T(p);
          ctx.beginPath();
          ctx.rect(P.x - 4.5, P.y - 4.5, 9, 9);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---------- busca e snap ----------

  function paredeProxima(p: Pt, v: Vista, tol: number) {
    let melhor: { id: string; t: number; d: number } | null = null;
    for (const w of v.paredes) {
      const r = distSegmento(p, w.a, w.b);
      const lim = Math.max(tol, w.espessura);
      if (r.d < lim && (!melhor || r.d < melhor.d)) melhor = { id: w.id, t: r.t, d: r.d };
    }
    return melhor;
  }

  function segmentoDxfProximo(p: Pt, v: Vista, tol: number): { a: Pt; b: Pt; ent: { pts: number[]; fechado: boolean } } | null {
    const f = v.fundo;
    if (!f?.entidades) return null;
    const vis = new Set((f.camadas ?? []).filter((c) => c.visivel).map((c) => c.nome));
    let melhor: { a: Pt; b: Pt; d: number; ent: { pts: number[]; fechado: boolean } } | null = null;
    for (const e of f.entidades) {
      if (!vis.has(e.camada)) continue;
      const q = e.pts;
      const n = q.length / 2;
      const total = e.fechado ? n : n - 1;
      for (let i = 0; i < total; i++) {
        const a = { x: q[2 * i], y: q[2 * i + 1] };
        const j = (i + 1) % n;
        const b = { x: q[2 * j], y: q[2 * j + 1] };
        const r = distSegmento(p, a, b);
        if (r.d < tol && (!melhor || r.d < melhor.d)) melhor = { a, b, d: r.d, ent: e };
      }
    }
    return melhor;
  }

  /** Aplica snap: pontas (paredes, linhas, DXF) > ângulo e comprimento > grade. */
  function aplicarSnap(p: Pt, anterior?: Pt, livre = false): { p: Pt; tipo: "ponta" | "grade" | "angulo" | null } {
    if (!vista) return { p, tipo: null };
    const tol = 10 / camRef.current.s;
    let melhor: Pt | null = null;
    let dm = tol;
    const testa = (q: Pt) => {
      const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
      if (d < dm) {
        dm = d;
        melhor = q;
      }
    };
    for (const w of vista.paredes) {
      testa(w.a);
      testa(w.b);
    }
    for (const l of vista.linhas) {
      testa(l.a);
      testa(l.b);
    }
    for (const pt of pontos) testa(pt);
    if (vista.fundo?.entidades && vista.fundo.camadas) {
      const vis = new Set(vista.fundo.camadas.filter((c) => c.visivel).map((c) => c.nome));
      for (const e of vista.fundo.entidades) {
        if (!vis.has(e.camada)) continue;
        for (let i = 0; i < e.pts.length; i += 2) {
          const x = e.pts[i];
          const y = e.pts[i + 1];
          if (Math.abs(x - p.x) < tol && Math.abs(y - p.y) < tol) testa({ x, y });
        }
      }
    }
    if (melhor) return { p: melhor, tipo: "ponta" };
    if (!snapAtivo || livre) return { p, tipo: null };
    const g = passoSnap;
    if (anterior) {
      const d = sub(p, anterior);
      const ang = Math.atan2(d.y, d.x);
      const passoAng = Math.PI / 4;
      const alvo = Math.round(ang / passoAng) * passoAng;
      if (Math.abs(ang - alvo) < (5 * Math.PI) / 180) {
        const L = Math.round(Math.hypot(d.x, d.y) / g) * g;
        return { p: { x: anterior.x + Math.cos(alvo) * L, y: anterior.y + Math.sin(alvo) * L }, tipo: "angulo" };
      }
    }
    return { p: { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }, tipo: "grade" };
  }

  function itemNoPonto(p: Pt): ItemSel | null {
    if (!vista) return null;
    const cam = camRef.current;
    const tol = 8 / cam.s;
    // fontes primeiro
    for (let i = vista.fontes.length - 1; i >= 0; i--) {
      const f = vista.fontes[i];
      const linear = f.natureza === "linear_dirigido" || f.natureza === "linha_difusa";
      if (linear) {
        const d = { x: Math.cos(((f.rotacao + 90) * Math.PI) / 180), y: Math.sin(((f.rotacao + 90) * Math.PI) / 180) };
        const a = { x: f.x - (d.x * f.comprimento) / 2, y: f.y - (d.y * f.comprimento) / 2 };
        const b = { x: f.x + (d.x * f.comprimento) / 2, y: f.y + (d.y * f.comprimento) / 2 };
        if (distSegmento(p, a, b).d < tol) return { tipo: "fonte", id: f.id };
      } else if (dist(p, f) < tol * 1.3) return { tipo: "fonte", id: f.id };
    }
    if (useEditor.getState().camadas.vaos)
      for (const ab of vista.aberturas) {
        const w = vista.paredes.find((x) => x.id === ab.paredeId);
        if (!w) continue;
        const m = lerp(w.a, w.b, ab.t);
        const d = norm(sub(w.b, w.a));
        const a = add(m, { x: (-d.x * ab.largura) / 2, y: (-d.y * ab.largura) / 2 });
        const b = add(m, { x: (d.x * ab.largura) / 2, y: (d.y * ab.largura) / 2 });
        if (distSegmento(p, a, b).d < Math.max(tol, w.espessura)) return { tipo: "abertura", id: ab.id };
      }
    for (const t of vista.textos) if (dist(p, t.p) < tol * 2.5) return { tipo: "texto", id: t.id };
    for (const k of vista.cotas) {
      const n = { x: -(k.b.y - k.a.y), y: k.b.x - k.a.x };
      const nn = norm(n);
      const a = add(k.a, { x: nn.x * k.offset, y: nn.y * k.offset });
      const b = add(k.b, { x: nn.x * k.offset, y: nn.y * k.offset });
      if (distSegmento(p, a, b).d < tol) return { tipo: "cota", id: k.id };
    }
    for (const l of vista.linhas) if (distSegmento(p, l.a, l.b).d < tol) return { tipo: "linha", id: l.id };
    const w = paredeProxima(p, vista, tol);
    if (w) return { tipo: "parede", id: w.id };
    return null;
  }

  function pontaNoPonto(p: Pt): Arrasto | null {
    if (!vista) return null;
    const tol = 7 / camRef.current.s;
    for (const s of useEditor.getState().selecao) {
      const lista = s.tipo === "parede" ? vista.paredes : s.tipo === "linha" ? vista.linhas : s.tipo === "cota" ? vista.cotas : null;
      const item = lista?.find((x) => x.id === s.id);
      if (!item) continue;
      for (const ponta of ["a", "b"] as const) {
        if (dist(p, item[ponta]) < tol)
          return { tipo: "ponta", alvo: { tipo: s.tipo as "parede" | "linha" | "cota", id: s.id, ponta }, original: item[ponta], base: vista };
      }
      if (s.tipo === "fonte") {
        /* fontes não têm pontas */
      }
    }
    for (const s of useEditor.getState().selecao) {
      if (s.tipo !== "fonte") continue;
      const f = vista.fontes.find((x) => x.id === s.id);
      if (f && f.natureza !== "difusa" && dist(p, alcaRotacao(f, camRef.current)) < tol * 1.3) return { tipo: "rotacao", id: f.id };
    }
    return null;
  }

  // ---------- eventos ----------

  const pontoDoEvento = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  };

  function terminarParede(fechar = false) {
    if (pontos.length >= 2) {
      const pts = fechar ? [...pontos, pontos[0]] : pontos;
      mudarVista((v) => {
        for (let i = 0; i < pts.length - 1; i++) {
          if (dist(pts[i], pts[i + 1]) < 0.01) continue;
          v.paredes.push({ id: uid("par_"), a: pts[i], b: pts[i + 1], espessura: 0.15, lado: "centro", bloqueia: true });
        }
      });
      if (fechar) orientarParedesParaFora();
    }
    setPontos([]);
    setBuffer("");
  }

  /** Depois de fechar um contorno, faz a espessura das paredes do contorno crescer para fora. */
  function orientarParedesParaFora() {
    const s = useEditor.getState();
    const a = ambienteAtual(s);
    if (!a || s.vista !== "planta") return;
    const c = contornoAmbiente(a);
    if (!c) return;
    mudarAmbiente((am) => {
      for (const p of am.planta.paredes) {
        // a parede está no contorno se o meio dela está sobre uma aresta do contorno
        const m = lerp(p.a, p.b, 0.5);
        for (let i = 0; i < c.length; i++) {
          const q0 = c[i];
          const q1 = c[(i + 1) % c.length];
          if (distSegmento(m, q0, q1).d < 0.01) {
            // contorno anti-horário: fora fica à direita do sentido q0 → q1
            const mesmoSentido = (p.b.x - p.a.x) * (q1.x - q0.x) + (p.b.y - p.a.y) * (q1.y - q0.y) > 0;
            p.lado = mesmoSentido ? "direita" : "esquerda";
            break;
          }
        }
      }
    }, false);
  }

  function concluirDoisPontos(a: Pt, b: Pt) {
    const f = ferramenta;
    if (dist(a, b) < 0.01) return;
    if (f === "limite" || f === "referencia") {
      const id = uid("lin_");
      mudarVista((v) => {
        v.linhas.push({ id, a, b, tipo: f });
      });
    } else if (f === "cota") {
      mudarVista((v) => {
        v.cotas.push({ id: uid("cot_"), a, b, offset: 0.35 });
      });
    } else if (f === "medir") {
      setMedida({ a, b });
    } else if (f === "calibrar") {
      setCalibrar({ a, b });
    } else if (f === "plano_vertical") {
      mudarAmbiente((am) => {
        am.p2p.planoVertical = { a, b };
        am.calculos.p2pV = null;
      });
      useEditor.getState().set({ ferramenta: "selecionar" });
    } else if (f === "linha_corte") {
      if (amb) gerarCorte(amb, { a, b });
      useEditor.getState().set({ ferramenta: "selecionar" });
      useEditor.getState().avisar("Corte gerado. Abra a vista Corte para desenhar a luz em corte.");
    }
    setPontos([]);
    setBuffer("");
  }

  function aoPressionar(e: React.PointerEvent) {
    if (!vista || !amb) return;
    const cv = ref.current!;
    cv.setPointerCapture(e.pointerId);
    const { sx, sy } = pontoDoEvento(e);
    ponteiros.current.set(e.pointerId, { x: sx, y: sy });
    if (ponteiros.current.size === 2) {
      const [p1, p2] = [...ponteiros.current.values()];
      pinca.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2, cam: { ...camRef.current } };
      arrasto.current = null;
      return;
    }
    const cam = camRef.current;
    const pm = paraMundo(cam, sx, sy);
    const est = useEditor.getState();

    if (e.button === 1 || e.button === 2 || ferramenta === "mao" || espaco.current) {
      arrasto.current = { tipo: "pan", x: sx, y: sy, cam: { ...cam } };
      return;
    }
    if (e.button !== 0) return;

    const anterior = pontos.length ? pontos[pontos.length - 1] : undefined;
    const sn = aplicarSnap(pm, anterior, e.altKey);

    switch (ferramenta) {
      case "selecionar": {
        const pa = pontaNoPonto(pm);
        if (pa) {
          useEditor.getState().marcarHistorico();
          arrasto.current = pa;
          return;
        }
        const item = itemNoPonto(pm);
        if (item) {
          let sel = est.selecao;
          const ja = sel.some((s) => s.id === item.id);
          if (e.shiftKey) sel = ja ? sel.filter((s) => s.id !== item.id) : [...sel, item];
          else if (!ja) sel = [item];
          est.set({ selecao: sel });
          arrasto.current = { tipo: "mover", inicio: pm, itens: sel, base: vista, moveu: false };
        } else {
          if (vista.fundo && !vista.fundo.travado && vista.fundo.visivel && !e.shiftKey) {
            useEditor.getState().marcarHistorico();
            est.set({ selecao: [] });
            arrasto.current = { tipo: "fundo", inicio: pm, base: vista };
            return;
          }
          if (!e.shiftKey) est.set({ selecao: [] });
          arrasto.current = { tipo: "caixa", inicio: pm, atual: pm };
        }
        return;
      }
      case "parede": {
        if (pontos.length >= 3 && dist(sn.p, pontos[0]) < 1e-6) {
          terminarParede(true);
          return;
        }
        setPontos([...pontos, sn.p]);
        return;
      }
      case "retangulo": {
        const s2 = aplicarSnap(pm);
        arrasto.current = { tipo: "retangulo", inicio: s2.p, atual: s2.p };
        return;
      }
      case "porta":
      case "janela": {
        const alvo = paredeProxima(pm, vista, 14 / cam.s);
        if (!alvo) {
          est.avisar("Clique sobre uma parede para colocar o vão.");
          return;
        }
        const p = vista.paredes.find((w) => w.id === alvo.id)!;
        const L = dist(p.a, p.b);
        const largura = Math.min(ferramenta === "porta" ? 0.8 : 1.2, L);
        const t = Math.max(largura / 2 / L, Math.min(1 - largura / 2 / L, alvo.t));
        const id = uid("abe_");
        mudarVista((v) => {
          v.aberturas.push({
            id,
            paredeId: p.id,
            tipo: ferramenta,
            t,
            largura,
            peitoril: ferramenta === "janela" ? 1.1 : 0,
            altura: ferramenta === "janela" ? 1.1 : 2.1,
          });
        });
        est.set({ selecao: [{ tipo: "abertura", id }] });
        return;
      }
      case "texto": {
        const t = window.prompt("Texto:");
        if (t && t.trim()) {
          const id = uid("txt_");
          mudarVista((v) => {
            v.textos.push({ id, p: sn.p, texto: t.trim(), tamanho: 0.22 });
          });
        }
        return;
      }
      case "promover": {
        const s = segmentoDxfProximo(pm, vista, 10 / cam.s);
        if (!s) {
          est.avisar("Clique sobre uma linha do DXF para transformá-la em parede.");
          return;
        }
        mudarVista((v) => {
          if (e.shiftKey) {
            // polilinha inteira vira paredes
            const q = s.ent.pts;
            const n = q.length / 2;
            const total = s.ent.fechado ? n : n - 1;
            for (let i = 0; i < total; i++) {
              const j = (i + 1) % n;
              const a = { x: q[2 * i], y: q[2 * i + 1] };
              const b = { x: q[2 * j], y: q[2 * j + 1] };
              if (dist(a, b) > 0.02) v.paredes.push({ id: uid("par_"), a, b, espessura: 0.15, lado: "centro", bloqueia: true });
            }
          } else v.paredes.push({ id: uid("par_"), a: s.a, b: s.b, espessura: 0.15, lado: "centro", bloqueia: true });
        });
        orientarParedesParaFora();
        return;
      }
      case "plano_vertical": {
        if (!pontos.length) {
          const alvo = paredeProxima(pm, vista, 12 / cam.s);
          if (alvo) {
            const p = vista.paredes.find((w) => w.id === alvo.id)!;
            concluirDoisPontos(p.a, p.b);
            return;
          }
        }
        if (pontos.length) concluirDoisPontos(pontos[0], sn.p);
        else setPontos([sn.p]);
        return;
      }
      default:
        break;
    }
    if (FERRAMENTAS_DOIS_PONTOS.includes(ferramenta)) {
      const snap = ferramenta === "calibrar" || ferramenta === "medir" ? aplicarSnap(pm, anterior, true) : sn;
      if (pontos.length) concluirDoisPontos(pontos[0], snap.p);
      else {
        setMedida(null);
        setPontos([snap.p]);
      }
      return;
    }
    if ((NATUREZAS_FERRAMENTA as string[]).includes(ferramenta)) {
      adicionarFonte(ferramenta as Natureza, sn.p);
      return;
    }
  }

  function aoMover(e: React.PointerEvent) {
    if (!vista) return;
    const { sx, sy } = pontoDoEvento(e);
    if (ponteiros.current.has(e.pointerId)) ponteiros.current.set(e.pointerId, { x: sx, y: sy });
    if (pinca.current && ponteiros.current.size === 2) {
      const [p1, p2] = [...ponteiros.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const c0 = pinca.current.cam;
      const k = d / pinca.current.d;
      mexeuNaCamera.current = true;
      const s = Math.max(5, Math.min(2000, c0.s * k));
      const w = paraMundo(c0, pinca.current.cx, pinca.current.cy);
      camRef.current = { s, ox: cx - w.x * s, oy: cy + w.y * s };
      redesenhar();
      return;
    }
    const cam = camRef.current;
    const pm = paraMundo(cam, sx, sy);
    const ar = arrasto.current;
    const anterior = pontos.length ? pontos[pontos.length - 1] : undefined;
    if (!ar) {
      const livre = e.altKey || ferramenta === "calibrar" || ferramenta === "medir";
      const sn = ferramenta === "selecionar" || ferramenta === "mao" ? { p: pm, tipo: null } : aplicarSnap(pm, anterior, livre);
      setCursor(sn.p);
      setSnapTipo(sn.tipo);
      return;
    }
    if (ar.tipo === "pan") {
      mexeuNaCamera.current = true;
      camRef.current = { ...ar.cam, ox: ar.cam.ox + (sx - ar.x), oy: ar.cam.oy + (sy - ar.y) };
      redesenhar();
      return;
    }
    if (ar.tipo === "caixa" || ar.tipo === "retangulo") {
      ar.atual = ar.tipo === "retangulo" ? aplicarSnap(pm).p : pm;
      setCursor(ar.atual);
      redesenhar();
      return;
    }
    if (ar.tipo === "fundo") {
      const d = sub(pm, ar.inicio);
      const fb = ar.base.fundo;
      if (!fb) return;
      mudarVista((v) => {
        if (!v.fundo) return;
        if (v.fundo.imagem && fb.imagem) {
          v.fundo.imagem.x = fb.imagem.x + d.x;
          v.fundo.imagem.y = fb.imagem.y + d.y;
        }
        if (v.fundo.entidades && fb.entidades) {
          v.fundo.entidades = fb.entidades.map((en) => ({ ...en, pts: en.pts.map((val, i) => val + (i % 2 === 0 ? d.x : d.y)) }));
        }
      }, false);
      return;
    }
    if (ar.tipo === "rotacao") {
      const f = vista.fontes.find((x) => x.id === ar.id);
      if (!f) return;
      let ang = deg(Math.atan2(pm.y - f.y, pm.x - f.x));
      if (!e.altKey) ang = Math.round(ang / 15) * 15;
      mudarVista((v) => {
        const ff = v.fontes.find((x) => x.id === ar.id);
        if (ff) ff.rotacao = ang;
      }, false);
      return;
    }
    if (ar.tipo === "ponta") {
      const sn = aplicarSnap(pm, undefined, e.altKey);
      const alvo = ar.alvo;
      const orig = ar.original;
      mudarVista((v) => {
        if (alvo.tipo === "parede") {
          // move a ponta e as pontas coincidentes das outras paredes
          for (const w of v.paredes) {
            const bw = ar.base.paredes.find((x) => x.id === w.id);
            if (!bw) continue;
            if (dist(bw.a, orig) < 0.02 && (w.id === alvo.id ? alvo.ponta === "a" : true)) w.a = sn.p;
            if (dist(bw.b, orig) < 0.02 && (w.id === alvo.id ? alvo.ponta === "b" : true)) w.b = sn.p;
          }
        } else {
          const lista = alvo.tipo === "linha" ? v.linhas : v.cotas;
          const it = lista.find((x) => x.id === alvo.id);
          if (it) it[alvo.ponta] = sn.p;
        }
      }, false);
      return;
    }
    if (ar.tipo === "mover") {
      let d = sub(pm, ar.inicio);
      if (snapAtivo && !e.altKey) d = { x: Math.round(d.x / passoSnap) * passoSnap, y: Math.round(d.y / passoSnap) * passoSnap };
      if (!ar.moveu) {
        if (Math.hypot(d.x, d.y) * cam.s < 3) return;
        ar.moveu = true;
        useEditor.getState().marcarHistorico();
      }
      const ids = new Set(ar.itens.map((s) => s.id));
      const base = ar.base;
      const mov = (p: Pt) => ({ x: p.x + d.x, y: p.y + d.y });
      mudarVista((v) => {
        for (const f of v.fontes) {
          if (!ids.has(f.id)) continue;
          const b = base.fontes.find((x) => x.id === f.id)!;
          f.x = b.x + d.x;
          f.y = b.y + d.y;
          if (useEditor.getState().vista === "corte") f.altura = f.y;
        }
        for (const t of v.textos) if (ids.has(t.id)) t.p = mov(base.textos.find((x) => x.id === t.id)!.p);
        for (const l of v.linhas)
          if (ids.has(l.id)) {
            const b = base.linhas.find((x) => x.id === l.id)!;
            l.a = mov(b.a);
            l.b = mov(b.b);
          }
        for (const k of v.cotas)
          if (ids.has(k.id)) {
            const b = base.cotas.find((x) => x.id === k.id)!;
            k.a = mov(b.a);
            k.b = mov(b.b);
          }
        // paredes: move as selecionadas e estica as ligadas
        const movidas = base.paredes.filter((w) => ids.has(w.id));
        if (movidas.length) {
          const pontas = movidas.flatMap((w) => [w.a, w.b]);
          for (const w of v.paredes) {
            const b = base.paredes.find((x) => x.id === w.id)!;
            if (ids.has(w.id)) {
              w.a = mov(b.a);
              w.b = mov(b.b);
            } else {
              if (pontas.some((q) => dist(q, b.a) < 0.02)) w.a = mov(b.a);
              if (pontas.some((q) => dist(q, b.b) < 0.02)) w.b = mov(b.b);
            }
          }
        }
        // aberturas: desliza ao longo da parede
        for (const ab of v.aberturas) {
          if (!ids.has(ab.id)) continue;
          const b = base.aberturas.find((x) => x.id === ab.id)!;
          const w = v.paredes.find((x) => x.id === ab.paredeId);
          if (!w) continue;
          const L = dist(w.a, w.b);
          const u = norm(sub(w.b, w.a));
          const dt = (d.x * u.x + d.y * u.y) / L;
          ab.t = Math.max(ab.largura / 2 / L, Math.min(1 - ab.largura / 2 / L, b.t + dt));
        }
      }, false);
    }
  }

  function aoSoltar(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size < 2) pinca.current = null;
    const ar = arrasto.current;
    arrasto.current = null;
    if (!ar || !vista) return;
    if (ar.tipo === "caixa") {
      const x0 = Math.min(ar.inicio.x, ar.atual.x);
      const x1 = Math.max(ar.inicio.x, ar.atual.x);
      const y0 = Math.min(ar.inicio.y, ar.atual.y);
      const y1 = Math.max(ar.inicio.y, ar.atual.y);
      if ((x1 - x0) * camRef.current.s < 4 && (y1 - y0) * camRef.current.s < 4) {
        redesenhar();
        return;
      }
      const dentro = (p: Pt) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
      const sel: ItemSel[] = [
        ...vista.fontes.filter((f) => dentro(f)).map((f) => ({ tipo: "fonte" as const, id: f.id })),
        ...vista.textos.filter((t) => dentro(t.p)).map((t) => ({ tipo: "texto" as const, id: t.id })),
        ...vista.linhas.filter((l) => dentro(l.a) && dentro(l.b)).map((l) => ({ tipo: "linha" as const, id: l.id })),
        ...vista.paredes.filter((w) => dentro(w.a) && dentro(w.b)).map((w) => ({ tipo: "parede" as const, id: w.id })),
        ...vista.cotas.filter((k) => dentro(k.a) && dentro(k.b)).map((k) => ({ tipo: "cota" as const, id: k.id })),
      ];
      const atual = e.shiftKey ? useEditor.getState().selecao : [];
      useEditor.getState().set({ selecao: [...atual, ...sel.filter((s) => !atual.some((a) => a.id === s.id))] });
      redesenhar();
      return;
    }
    if (ar.tipo === "retangulo") {
      const w = Math.abs(ar.atual.x - ar.inicio.x);
      const h = Math.abs(ar.atual.y - ar.inicio.y);
      if (w > 0.1 && h > 0.1) {
        criarRetangulo(w, h, { x: Math.min(ar.inicio.x, ar.atual.x), y: Math.min(ar.inicio.y, ar.atual.y) });
        useEditor.getState().set({ ferramenta: "selecionar" });
      }
      redesenhar();
      return;
    }
    if (ar.tipo === "ponta" || ar.tipo === "rotacao") {
      if (ar.tipo === "ponta" && ar.alvo.tipo === "parede") orientarParedesParaFora();
      redesenhar();
    }
  }

  function aoDuploClique() {
    if (ferramenta === "parede") terminarParede(false);
  }

  function aoRolar(e: React.WheelEvent) {
    mexeuNaCamera.current = true;
    const { sx, sy } = pontoDoEvento(e);
    const cam = camRef.current;
    const k = Math.exp(-e.deltaY * 0.0015);
    const s = Math.max(5, Math.min(2000, cam.s * k));
    const w = paraMundo(cam, sx, sy);
    camRef.current = { s, ox: sx - w.x * s, oy: sy + w.y * s };
    redesenhar();
  }

  // ---------- teclado ----------
  useEffect(() => {
    function emCampo(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (emCampo(e)) return;
      const est = useEditor.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === " ") {
        espaco.current = true;
        e.preventDefault();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) est.refazer();
        else est.desfazer();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        est.refazer();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicarSelecao();
        return;
      }
      if (ctrl) return;
      // medidas digitadas (parede, linha, cota, retângulo)
      const aceitaNumero = ["parede", "retangulo", "limite", "referencia", "cota"].includes(est.ferramenta);
      if (aceitaNumero && /^[0-9.,xX*]$/.test(e.key)) {
        setBuffer((b) => b + e.key.replace("X", "x").replace("*", "x"));
        e.preventDefault();
        return;
      }
      if (aceitaNumero && e.key === "Backspace" && buffer) {
        setBuffer((b) => b.slice(0, -1));
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        aplicarBuffer();
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (est.ferramenta === "parede" && pontos.length >= 2) terminarParede(false);
        else if (pontos.length || buffer) {
          setPontos([]);
          setBuffer("");
        } else if (est.ferramenta !== "selecionar") est.set({ ferramenta: "selecionar" });
        else est.set({ selecao: [] });
        setMedida(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && est.selecao.length) {
        apagarSelecao();
        e.preventDefault();
        return;
      }
      if (e.key.startsWith("Arrow") && est.selecao.length) {
        const passo = e.shiftKey ? 0.5 : 0.05;
        const d = { ArrowLeft: { x: -passo, y: 0 }, ArrowRight: { x: passo, y: 0 }, ArrowUp: { x: 0, y: passo }, ArrowDown: { x: 0, y: -passo } }[e.key];
        if (d) {
          const ids = new Set(est.selecao.map((s) => s.id));
          mudarVista((v) => {
            for (const f of v.fontes)
              if (ids.has(f.id)) {
                f.x += d.x;
                f.y += d.y;
              }
            for (const t of v.textos)
              if (ids.has(t.id)) t.p = { x: t.p.x + d.x, y: t.p.y + d.y };
            for (const l of v.linhas)
              if (ids.has(l.id)) {
                l.a = { x: l.a.x + d.x, y: l.a.y + d.y };
                l.b = { x: l.b.x + d.x, y: l.b.y + d.y };
              }
          });
          e.preventDefault();
        }
        return;
      }
      const atalhos: Record<string, Ferramenta> = {
        v: "selecionar",
        h: "mao",
        w: "parede",
        r: "retangulo",
        p: "porta",
        j: "janela",
        l: "limite",
        c: "cota",
        t: "texto",
        m: "medir",
        "1": "facho",
        "2": "linear_dirigido",
        "3": "linha_difusa",
        "4": "difusa",
      };
      const f = atalhos[e.key.toLowerCase()];
      if (f && !(aceitaNumero && /[0-9]/.test(e.key))) {
        est.set({ ferramenta: f });
        return;
      }
      if (e.key.toLowerCase() === "f") enquadrarAgora();
    }
    function aoSoltarTecla(e: KeyboardEvent) {
      if (e.key === " ") espaco.current = false;
    }
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("keyup", aoSoltarTecla);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("keyup", aoSoltarTecla);
    };
  });

  function aplicarBuffer() {
    const est = useEditor.getState();
    const txt = buffer.replace(/,/g, ".");
    if (est.ferramenta === "retangulo") {
      const m = txt.match(/^([0-9.]+)x([0-9.]+)$/);
      if (m) {
        criarRetangulo(parseFloat(m[1]), parseFloat(m[2]));
        est.set({ ferramenta: "selecionar" });
      } else if (txt) est.avisar('Digite largura x comprimento, por exemplo "6x3", e Enter.');
      setBuffer("");
      return;
    }
    if (est.ferramenta === "parede") {
      if (!txt) {
        terminarParede(false);
        return;
      }
      const L = parseFloat(txt);
      if (pontos.length && L > 0 && cursor) {
        const ult = pontos[pontos.length - 1];
        const d = norm(sub(cursor, ult));
        if (d.x || d.y) setPontos([...pontos, { x: ult.x + d.x * L, y: ult.y + d.y * L }]);
      }
      setBuffer("");
      return;
    }
    if (["limite", "referencia", "cota"].includes(est.ferramenta) && pontos.length && cursor) {
      const L = parseFloat(txt);
      const ult = pontos[0];
      const d = norm(sub(cursor, ult));
      if (L > 0 && (d.x || d.y)) concluirDoisPontos(ult, { x: ult.x + d.x * L, y: ult.y + d.y * L });
      setBuffer("");
    }
  }

  // ---------- cursor CSS ----------
  const cursorCss =
    ferramenta === "mao" ? "grab" : ferramenta === "selecionar" ? "default" : "none";

  const telaCursor = cursor ? paraTela(camRef.current, cursor) : null;
  const vazio = vista && !vista.paredes.length && !vista.fontes.length && !vista.fundo && !vista.linhas.length;

  return (
    <div ref={caixaRef} className="relative h-full w-full overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={ref}
        style={{ width: tam.w, height: tam.h, cursor: cursorCss, touchAction: "none" }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={aoDuploClique}
        onWheel={aoRolar}
      />
      {buffer && telaCursor && (
        <div
          className="pointer-events-none absolute rounded-md border border-[var(--marca)] bg-[var(--painel)] px-2 py-1 font-mono text-sm text-white shadow-lg"
          style={{ left: telaCursor.x + 16, top: telaCursor.y + 14 }}
        >
          {buffer}
          <span className="ml-2 text-xs text-[var(--fraco)]">Enter</span>
        </div>
      )}
      {vazio && vistaNome === "planta" && <AjudaVazio />}
      {vazio && vistaNome === "corte" && <AjudaCorteVazio amb={amb!} />}
      {calibrar && (
        <DialogoCalibrar
          medidaDesenho={dist(calibrar.a, calibrar.b)}
          temDesenho={!!vista && (vista.paredes.length > 0 || vista.fontes.length > 0)}
          aoFechar={() => setCalibrar(null)}
          p1={calibrar.a}
          p2={calibrar.b}
        />
      )}
    </div>
  );
}

function AjudaVazio() {
  const set = useEditor((s) => s.set);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-[var(--borda)] bg-[var(--painel)]/95 p-6 text-center shadow-2xl">
        <div className="text-xs font-bold tracking-[0.2em] text-[var(--marca)]">COMECE PELA BASE</div>
        <h2 className="mt-2 text-lg font-semibold">Como você quer montar o ambiente?</h2>
        <div className="mt-4 grid gap-2 text-left text-sm">
          <button className="botao-opcao" onClick={() => set({ ferramenta: "retangulo" })}>
            <b>Retângulo rápido</b>
            <span>Tecle R, digite 4x5 e Enter (medidas internas, em metros).</span>
          </button>
          <button className="botao-opcao" onClick={() => set({ ferramenta: "parede" })}>
            <b>Desenhar paredes</b>
            <span>Tecle W, clique ponto a ponto, digite a medida e Enter. Clique no primeiro ponto para fechar.</span>
          </button>
          <button className="botao-opcao" onClick={() => document.getElementById("entrada-cad")?.click()}>
            <b>Importar planta CAD (DXF)</b>
            <span>Confira a unidade e a escala antes de usar.</span>
          </button>
          <button className="botao-opcao" onClick={() => document.getElementById("entrada-fundo")?.click()}>
            <b>PDF ou imagem como fundo</b>
            <span>Calibre marcando duas pontas de uma medida conhecida e decalque as paredes.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AjudaCorteVazio({ amb }: { amb: Ambiente }) {
  const set = useEditor((s) => s.set);
  const gerar = () => {
    const c = contornoAmbiente(amb);
    if (!c) {
      useEditor.getState().avisar("Desenhe o ambiente na planta antes de gerar o corte.", "erro");
      return;
    }
    // corte pelo meio, ao longo do lado maior
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of c) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const horizontal = maxX - minX >= maxY - minY;
    const linha = horizontal
      ? { a: { x: minX - 0.5, y: (minY + maxY) / 2 }, b: { x: maxX + 0.5, y: (minY + maxY) / 2 } }
      : { a: { x: (minX + maxX) / 2, y: maxY + 0.5 }, b: { x: (minX + maxX) / 2, y: minY - 0.5 } };
    gerarCorte(amb, linha);
    useEditor.getState().set({ pedidoEnquadrar: useEditor.getState().pedidoEnquadrar + 1 });
  };
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-[var(--borda)] bg-[var(--painel)]/95 p-6 text-center shadow-2xl">
        <div className="text-xs font-bold tracking-[0.2em] text-[var(--marca)]">CORTE</div>
        <h2 className="mt-2 text-lg font-semibold">Gere o corte a partir da planta</h2>
        <div className="mt-4 grid gap-2 text-left text-sm">
          <button className="botao-opcao" onClick={gerar}>
            <b>Corte automático pelo meio</b>
            <span>Pé-direito, piso, teto e os vãos da parede ao fundo. Depois você corrige na mão.</span>
          </button>
          <button
            className="botao-opcao"
            onClick={() => {
              useEditor.getState().set({ vista: "planta" });
              set({ ferramenta: "linha_corte" });
            }}
          >
            <b>Escolher a linha de corte na planta</b>
            <span>Clique em duas pontas; o corte olha para a esquerda da linha.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
