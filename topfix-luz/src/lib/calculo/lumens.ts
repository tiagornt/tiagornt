// Método dos lúmens (seção 4.5 da especificação).
// E_med = (Σ N_i x Φ_i x FU x FM) / A
// N = (E_alvo x A) / (Φ x FU x FM), arredondado para cima
// K = (C x L) / (h_m x (C + L))

import type { GrupoCores } from "../tipos";
import { REFLETANCIAS, TABELA_FU } from "./tabelas";

export function indiceLocal(C: number, L: number, hm: number): number {
  if (!(hm > 0) || !(C > 0) || !(L > 0)) return NaN;
  return (C * L) / (hm * (C + L));
}

type Grupo3 = "claras" | "medias" | "escuras";

/** FU interpolado na tabela para um grupo. Avisa se K está fora da tabela. */
export function fuDoGrupo(K: number, grupo: Grupo3): { FU: number; aviso: string | null } {
  const t = TABELA_FU;
  if (!(K >= t[0].K)) {
    return {
      FU: t[0][grupo],
      aviso: `K = ${fmt(K, 2)} abaixo de 0,6: usada a linha 0,6. O ambiente é muito alto ou estreito para a tabela.`,
    };
  }
  if (K >= t[t.length - 1].K) {
    return {
      FU: t[t.length - 1][grupo],
      aviso:
        K > t[t.length - 1].K
          ? `K = ${fmt(K, 2)} acima de 5,0: usada a linha 5,0. O ambiente é muito largo e baixo para a tabela.`
          : null,
    };
  }
  for (let i = 0; i < t.length - 1; i++) {
    if (K >= t[i].K && K <= t[i + 1].K) {
      const f = (K - t[i].K) / (t[i + 1].K - t[i].K);
      return { FU: t[i][grupo] + (t[i + 1][grupo] - t[i][grupo]) * f, aviso: null };
    }
  }
  return { FU: t[0][grupo], aviso: null };
}

/**
 * FU para qualquer grupo. No personalizado, usa o grupo de refletâncias mais próximo;
 * se nenhum estiver perto (distância > 0,1), interpola entre os dois mais próximos.
 */
export function fatorUtilizacao(
  K: number,
  grupo: GrupoCores,
  rho?: { teto: number; paredes: number; piso: number },
): { FU: number; avisos: string[]; descricao: string } {
  const avisos: string[] = [];
  if (grupo !== "personalizado") {
    const r = fuDoGrupo(K, grupo);
    if (r.aviso) avisos.push(r.aviso);
    return { FU: r.FU, avisos, descricao: `tabela, grupo ${grupo}` };
  }
  const alvo = rho ?? REFLETANCIAS.medias;
  const dists = (Object.keys(REFLETANCIAS) as Grupo3[])
    .map((g) => {
      const r = REFLETANCIAS[g];
      const d = Math.hypot(r.teto - alvo.teto, r.paredes - alvo.paredes, r.piso - alvo.piso);
      return { g, d };
    })
    .sort((a, b) => a.d - b.d);
  const [p1, p2] = dists;
  const f1 = fuDoGrupo(K, p1.g);
  if (f1.aviso) avisos.push(f1.aviso);
  if (p1.d <= 0.1) {
    return { FU: f1.FU, avisos, descricao: `personalizado, linha mais próxima: ${p1.g}` };
  }
  const f2 = fuDoGrupo(K, p2.g);
  const w1 = 1 / p1.d;
  const w2 = 1 / p2.d;
  const FU = (f1.FU * w1 + f2.FU * w2) / (w1 + w2);
  return {
    FU,
    avisos,
    descricao: `personalizado, interpolado entre ${p1.g} e ${p2.g} (pelo inverso da distância das refletâncias)`,
  };
}

export interface EntradaLumens {
  A: number;
  C: number;
  L: number;
  hm: number;
  FM: number;
  grupo: GrupoCores;
  rho?: { teto: number; paredes: number; piso: number };
  /** Tipos de fonte: quantidade e fluxo de cada um (lm). */
  tipos: { codigo: string; N: number; fluxo: number }[];
}

export interface SaidaLumens {
  K: number;
  FU: number;
  somaFluxo: number;
  Emed: number;
  avisos: string[];
  descricaoFU: string;
}

export function metodoLumens(e: EntradaLumens): SaidaLumens {
  const K = indiceLocal(e.C, e.L, e.hm);
  const fu = fatorUtilizacao(K, e.grupo, e.rho);
  const somaFluxo = e.tipos.reduce((s, t) => s + t.N * t.fluxo, 0);
  const Emed = e.A > 0 ? (somaFluxo * fu.FU * e.FM) / e.A : 0;
  return { K, FU: fu.FU, somaFluxo, Emed, avisos: fu.avisos, descricaoFU: fu.descricao };
}

/** Quantidade de fontes de um tipo para atingir o alvo, descontando o fluxo dos outros tipos. */
export function quantidadeParaAlvo(
  Ealvo: number,
  A: number,
  fluxo: number,
  FU: number,
  FM: number,
  fluxoOutros = 0,
): number {
  if (!(fluxo > 0) || !(FU > 0) || !(FM > 0)) return 0;
  const n = (Ealvo * A) / (FU * FM) - fluxoOutros;
  return Math.max(0, Math.ceil(n / fluxo - 1e-9));
}

export type StatusAlvo = "abaixo" | "na_faixa" | "acima" | "sem_alvo";

export function statusAlvo(E: number, alvo: number | null | undefined): { status: StatusAlvo; dif: number } {
  if (!alvo || !(alvo > 0)) return { status: "sem_alvo", dif: 0 };
  const dif = (E - alvo) / alvo;
  if (dif <= -0.1) return { status: "abaixo", dif };
  if (dif > 0.2) return { status: "acima", dif };
  return { status: "na_faixa", dif };
}

export const NOME_STATUS: Record<StatusAlvo, string> = {
  abaixo: "Abaixo do alvo",
  na_faixa: "Na faixa",
  acima: "Acima do alvo",
  sem_alvo: "Sem alvo",
};

export function fmt(n: number, casas = 0): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
