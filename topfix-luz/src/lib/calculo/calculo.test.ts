import { describe, expect, it } from "vitest";
import { indiceLocal, metodoLumens, quantidadeParaAlvo, statusAlvo, fuDoGrupo, fatorUtilizacao } from "./lumens";
import { emissoresDasFontes, iluminanciaNoPonto, p2pHorizontal, p2pVertical, anguloSolido } from "./p2p";
import { bloqueadoresDaVista, contornoDasParedes, areaPoligono, seg, poligonoVisibilidade } from "../geometria";
import type { Fonte, Parede } from "../tipos";

const fonte = (p: Partial<Fonte>): Fonte => ({
  id: "f",
  codigo: "L01",
  natureza: "difusa",
  x: 0,
  y: 0,
  rotacao: 0,
  tilt: 0,
  cct: 3000,
  intensidadePct: 100,
  altura: 2.75,
  fluxo: 1000,
  intensidadeCd: null,
  potencia: null,
  abertura: 120,
  comprimento: 1,
  visivel: true,
  ...p,
});

describe("método dos lúmens", () => {
  it("caso 1: sala 4 x 5, pé-direito 2,75, 6 x 1000 lm, claras, FM 0,80", () => {
    // h_m = 2,75 - 0,75 = 2,00; K = 20 / (2 x 9) = 1,111...
    const K = indiceLocal(4, 5, 2);
    expect(K).toBeCloseTo(1.1111, 4);
    const r = metodoLumens({ A: 20, C: 4, L: 5, hm: 2, FM: 0.8, grupo: "claras", tipos: [{ codigo: "L01", N: 6, fluxo: 1000 }] });
    // FU interpolado entre K 1,0 (0,50) e 1,25 (0,55): 0,50 + 0,05 x 0,4444 = 0,52222
    expect(r.FU).toBeCloseTo(0.52222, 4);
    // E = 6000 x 0,52222 x 0,8 / 20 = 125,33 lx
    expect(r.Emed).toBeCloseTo(125.333, 2);
  });

  it("caso 2: quantidade para 300 lx em 6 x 8, médias, FM 0,70, 2000 lm", () => {
    // h_m = 2,0 ; K = 48 / (2 x 14) = 1,714 ; FU médias = 0,53 + (0,59-0,53) x 0,4286 = 0,55571
    const K = indiceLocal(6, 8, 2);
    const fu = fuDoGrupo(K, "medias").FU;
    expect(fu).toBeCloseTo(0.555714, 5);
    // N = 300 x 48 / (2000 x 0,555714 x 0,70) = 18,51 → 19
    expect(quantidadeParaAlvo(300, 48, 2000, fu, 0.7)).toBe(19);
    const r = metodoLumens({ A: 48, C: 6, L: 8, hm: 2, FM: 0.7, grupo: "medias", tipos: [{ codigo: "L01", N: 19, fluxo: 2000 }] });
    // E = 38000 x 0,555714 x 0,70 / 48 = 307,96 lx
    expect(r.Emed).toBeCloseTo(307.958, 2);
  });

  it("caso 3: vários tipos somam N x Φ e K fora da tabela avisa", () => {
    const r = metodoLumens({
      A: 4,
      C: 2,
      L: 2,
      hm: 2.5,
      FM: 0.6,
      grupo: "escuras",
      tipos: [
        { codigo: "L01", N: 2, fluxo: 800 },
        { codigo: "L02", N: 1, fluxo: 400 },
      ],
    });
    // K = 4 / (2,5 x 4) = 0,4 → usa linha 0,6 (escuras 0,26) e avisa
    expect(r.K).toBeCloseTo(0.4, 6);
    expect(r.FU).toBeCloseTo(0.26, 6);
    expect(r.avisos.length).toBe(1);
    expect(r.somaFluxo).toBe(2000);
    // E = 2000 x 0,26 x 0,6 / 4 = 78 lx
    expect(r.Emed).toBeCloseTo(78, 6);
  });

  it("FU personalizado usa a linha mais próxima", () => {
    const r = fatorUtilizacao(1.0, "personalizado", { teto: 0.7, paredes: 0.5, piso: 0.28 });
    expect(r.FU).toBeCloseTo(0.5, 6);
  });

  it("status do alvo: -10% abaixo, até +20% na faixa", () => {
    expect(statusAlvo(89, 100).status).toBe("abaixo");
    expect(statusAlvo(91, 100).status).toBe("na_faixa");
    expect(statusAlvo(120, 100).status).toBe("na_faixa");
    expect(statusAlvo(121, 100).status).toBe("acima");
  });
});

describe("ponto a ponto", () => {
  it("fonte pontual sobre um ponto no eixo: E = I0 / h² (cosseno cúbico com θ = 0)", () => {
    const { emissores } = emissoresDasFontes([fonte({ natureza: "facho", intensidadeCd: 1000, fluxo: null, abertura: 60, altura: 2.75 })]);
    const E = iluminanciaNoPonto({ x: 0, y: 0, z: 0.75 }, { x: 0, y: 0, z: 1 }, emissores, []);
    expect(E).toBeCloseTo(1000 / 4, 6); // h = 2,0
  });

  it("fora do eixo bate com I(α) x cos³θ / h²", () => {
    const { emissores } = emissoresDasFontes([fonte({ natureza: "difusa", intensidadeCd: 500, fluxo: null })]);
    const h = 2;
    const x = 1.5;
    const E = iluminanciaNoPonto({ x, y: 0, z: 0.75 }, { x: 0, y: 0, z: 1 }, emissores, []);
    const cosT = h / Math.hypot(h, x);
    // difusa: eixo para baixo, α = θ, I = 500 cos θ
    expect(E).toBeCloseTo((500 * cosT * cosT ** 3) / (h * h), 6);
  });

  it("fora da abertura do facho não contribui", () => {
    const { emissores } = emissoresDasFontes([fonte({ natureza: "facho", intensidadeCd: 1000, fluxo: null, abertura: 20 })]);
    const E = iluminanciaNoPonto({ x: 2, y: 0, z: 0.75 }, { x: 0, y: 0, z: 1 }, emissores, []);
    expect(E).toBe(0);
  });

  it("conversão Φ → I0 de facho usa Ω = 2π(1 - cos α)", () => {
    const { emissores } = emissoresDasFontes([fonte({ natureza: "facho", fluxo: 600, abertura: 36 })]);
    expect(emissores[0].I0).toBeCloseTo(600 / anguloSolido((18 * Math.PI) / 180), 6);
  });

  it("linear é discretizada a cada 0,20 m com o fluxo dividido", () => {
    const { emissores } = emissoresDasFontes([fonte({ natureza: "linha_difusa", fluxo: 1000, comprimento: 1.2 })]);
    expect(emissores.length).toBe(6);
    expect(emissores.reduce((s, e) => s + e.I0, 0)).toBeCloseTo(1000 / Math.PI, 6);
  });

  it("parede entre a fonte e o ponto faz sombra", () => {
    const { emissores } = emissoresDasFontes([fonte({ x: 0, y: 0, intensidadeCd: 500, fluxo: null })]);
    const bloq = [seg({ x: 1, y: -5 }, { x: 1, y: 5 })];
    const E = iluminanciaNoPonto({ x: 2, y: 0, z: 0.75 }, { x: 0, y: 0, z: 1 }, emissores, bloq);
    expect(E).toBe(0);
  });

  it("grade horizontal e vertical dão resumo coerente", () => {
    const sala = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const { emissores } = emissoresDasFontes([fonte({ x: 2, y: 2, fluxo: 3000 })]);
    const h = p2pHorizontal(sala, 0.75, 0.5, true, emissores, []);
    expect(h.pontos).toBeGreaterThan(20);
    expect(h.Emax).toBeGreaterThan(h.Emed);
    expect(h.U0).toBeGreaterThan(0);
    expect(h.U0).toBeLessThanOrEqual(1);
    const v = p2pVertical({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, 2.75, 0.5, true, emissores, []);
    expect(v.pontos).toBeGreaterThan(5);
    expect(v.Emed).toBeGreaterThan(0);
  });
});

describe("geometria", () => {
  const parede = (ax: number, ay: number, bx: number, by: number): Parede => ({
    id: `${ax}${ay}${bx}${by}`,
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    espessura: 0.15,
    lado: "centro",
    bloqueia: true,
  });

  it("detecta o contorno de um retângulo de paredes", () => {
    const c = contornoDasParedes([parede(0, 0, 4, 0), parede(4, 0, 4, 5), parede(4, 5, 0, 5), parede(0, 5, 0, 0)]);
    expect(c).not.toBeNull();
    expect(areaPoligono(c!)).toBeCloseTo(20, 6);
  });

  it("contorno ignora parede solta e divisória interna (área total)", () => {
    const c = contornoDasParedes([
      parede(0, 0, 6, 0),
      parede(6, 0, 6, 4),
      parede(6, 4, 0, 4),
      parede(0, 4, 0, 0),
      parede(3, 0, 3, 4), // divisória
      parede(6, 4, 8, 6), // ponta solta
    ]);
    expect(c).not.toBeNull();
    expect(areaPoligono(c!)).toBeCloseTo(24, 6);
  });

  it("paredes que não fecham não geram contorno", () => {
    expect(contornoDasParedes([parede(0, 0, 4, 0), parede(4, 0, 4, 5), parede(4, 5, 0, 5)])).toBeNull();
  });

  it("vão de porta não bloqueia a luz", () => {
    const p = parede(0, 0, 4, 0);
    const b = bloqueadoresDaVista({
      paredes: [p],
      aberturas: [{ id: "a", paredeId: p.id, tipo: "porta", t: 0.5, largura: 0.8, peitoril: 0, altura: 2.1 }],
      linhas: [],
    });
    expect(b.length).toBe(2);
    expect(b[0].b.x).toBeCloseTo(1.6, 6);
    expect(b[1].a.x).toBeCloseTo(2.4, 6);
  });

  it("polígono de visibilidade para na parede", () => {
    const poli = poligonoVisibilidade({ x: 0, y: 0 }, 5, [seg({ x: 1, y: -1 }, { x: 1, y: 1 })]);
    const maxX = Math.max(...poli.map((p) => p.x));
    expect(maxX).toBeLessThanOrEqual(5.0001);
    const aDireita = poli.filter((p) => Math.abs(p.y) < 0.5 && p.x > 0);
    for (const p of aDireita) expect(p.x).toBeLessThanOrEqual(1.0001);
  });
});

import { resultadoDaFonte } from "./fonte";

describe("resultado de uma luminária", () => {
  it("facho de 36° a 1,95 m do plano: mancha de 50% com Ø = 2 h tan(18°) e E no centro = I0 / h²", () => {
    const f = fonte({ natureza: "facho", fluxo: 550, abertura: 36, altura: 2.7 });
    const r = resultadoDaFonte(f, 0.75);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.h).toBeCloseTo(1.95, 6);
    expect(r.diametro50).toBeCloseTo(2 * 1.95 * Math.tan((18 * Math.PI) / 180), 1);
    const I0 = 550 / anguloSolido((18 * Math.PI) / 180);
    expect(r.Ecentro).toBeCloseTo(I0 / 1.95 ** 2, 3);
  });

  it("sem fluxo nem intensidade avisa em vez de inventar número", () => {
    const r = resultadoDaFonte(fonte({ fluxo: null, intensidadeCd: null }), 0.75);
    expect(r.ok).toBe(false);
  });
});
