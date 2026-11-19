// Resultado de UMA luminária sozinha no plano de trabalho: o que ela projeta e quanto ilumina.
// Usa o mesmo ponto a ponto da seção 4.6 (só componente direta), só com esta fonte.

import type { Fonte, Pt } from "../tipos";
import { emissoresDasFontes, iluminanciaNoPonto } from "./p2p";
import type { Seg } from "../geometria";

export interface ResultadoFonte {
  ok: true;
  /** Altura da fonte acima do plano (m). */
  h: number;
  /** Ponto para onde o eixo aponta, no plano (ou o ponto logo abaixo). */
  mira: Pt;
  /** Iluminância no ponto de mira (lx). */
  Ecentro: number;
  /** Maior iluminância encontrada (lx). */
  Emax: number;
  /** Perfil ao longo da direção da luz, passando pela fonte: u = distância em planta a partir da fonte. */
  perfil: { u: number; E: number }[];
  /** Trecho do perfil acima de 50% e de 10% do máximo (m, em u). */
  faixa50: [number, number] | null;
  faixa10: [number, number] | null;
  /** Contorno de 50% (a "mancha útil") e de 10% (o alcance) no plano, em coordenadas do mundo. */
  contorno50: Pt[];
  contorno10: Pt[];
  /** Diâmetro equivalente da mancha de 50% (m). */
  diametro50: number;
  /** Diâmetro equivalente do alcance de 10% (m). */
  diametro10: number;
  /** Iluminância média dentro da mancha de 50% (lx). */
  Emedia50: number;
  /** Área da mancha de 50% (m²). */
  area50: number;
}

export type RespostaFonte = ResultadoFonte | { ok: false; motivo: string };

const areaPoli = (p: Pt[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
};

export function resultadoDaFonte(f: Fonte, alturaPlano: number, bloq: Seg[] = []): RespostaFonte {
  const h = f.altura - alturaPlano;
  if (!(h > 0.01)) return { ok: false, motivo: "A fonte está abaixo do plano de trabalho. Aumente a altura de montagem." };
  const { emissores, semDado } = emissoresDasFontes([{ ...f, visivel: true }]);
  if (semDado.length || !emissores.length) return { ok: false, motivo: "Informe o fluxo (lm) ou a intensidade (cd) para ver o resultado." };
  const nrm = { x: 0, y: 0, z: 1 };
  const E = (p: Pt) => iluminanciaNoPonto({ x: p.x, y: p.y, z: alturaPlano }, nrm, emissores, bloq);

  // mira: onde o eixo encontra o plano (difusas: logo abaixo)
  const eixo = emissores[0].eixo;
  const k = eixo.z < -1e-6 ? h / -eixo.z : 0;
  const mira = { x: f.x + eixo.x * Math.min(k, 30), y: f.y + eixo.y * Math.min(k, 30) };

  // perfil ao longo da direção da luz
  const d = { x: Math.cos((f.rotacao * Math.PI) / 180), y: Math.sin((f.rotacao * Math.PI) / 180) };
  const alcance = Math.min(25, Math.max(3, h * 4, Math.hypot(mira.x - f.x, mira.y - f.y) * 2.5));
  const passos = 160;
  const perfil: { u: number; E: number }[] = [];
  let Emax = 0;
  for (let i = 0; i <= passos; i++) {
    const u = -alcance + (2 * alcance * i) / passos;
    const e = E({ x: f.x + d.x * u, y: f.y + d.y * u });
    perfil.push({ u, E: e });
    if (e > Emax) Emax = e;
  }
  const faixa = (lim: number): [number, number] | null => {
    const dentro = perfil.filter((p) => p.E >= lim * Emax);
    return dentro.length ? [dentro[0].u, dentro[dentro.length - 1].u] : null;
  };

  // centro da mancha: o ponto de maior iluminância do perfil
  const pico = perfil.reduce((a, b) => (b.E > a.E ? b : a), perfil[0]);
  const centro = { x: f.x + d.x * pico.u, y: f.y + d.y * pico.u };
  const contorno = (lim: number): Pt[] => {
    const pts: Pt[] = [];
    const n = 48;
    const rMax = alcance * 1.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = { x: Math.cos(a), y: Math.sin(a) };
      // anda a partir do centro até cair abaixo do limite
      let r = 0;
      const dr = Math.max(0.02, rMax / 200);
      while (r < rMax) {
        const p = { x: centro.x + v.x * (r + dr), y: centro.y + v.y * (r + dr) };
        if (E(p) < lim * Emax) break;
        r += dr;
      }
      // refina a borda entre r e r + dr por bisseção
      let lo = r;
      let hi = Math.min(rMax, r + dr);
      for (let it = 0; it < 10; it++) {
        const m = (lo + hi) / 2;
        if (E({ x: centro.x + v.x * m, y: centro.y + v.y * m }) >= lim * Emax) lo = m;
        else hi = m;
      }
      r = lo;
      pts.push({ x: centro.x + v.x * r, y: centro.y + v.y * r });
    }
    return pts;
  };
  const contorno50 = contorno(0.5);
  const contorno10 = contorno(0.1);
  const area50 = areaPoli(contorno50);
  // média dentro da mancha de 50% (amostras em grade)
  let soma = 0;
  let n = 0;
  const xs = contorno50.map((p) => p.x);
  const ys = contorno50.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const passo = Math.max(0.02, Math.max(maxX - minX, maxY - minY) / 24);
  for (let x = minX + passo / 2; x < maxX; x += passo)
    for (let y = minY + passo / 2; y < maxY; y += passo) {
      if (!dentroDe({ x, y }, contorno50)) continue;
      soma += E({ x, y });
      n++;
    }
  return {
    ok: true,
    h,
    mira,
    Ecentro: E(mira),
    Emax,
    perfil,
    faixa50: faixa(0.5),
    faixa10: faixa(0.1),
    contorno50,
    contorno10,
    diametro50: 2 * Math.sqrt(area50 / Math.PI),
    diametro10: 2 * Math.sqrt(areaPoli(contorno10) / Math.PI),
    Emedia50: n ? soma / n : Emax,
    area50,
  };
}

function dentroDe(pt: Pt, poli: Pt[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i];
    const b = poli[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}
