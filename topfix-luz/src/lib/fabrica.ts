import { uid } from "./geometria";
import type { Ambiente, Fonte, Parede, Projeto, Vista, VistaCorte } from "./tipos";
import { FM_PRESETS, REFLETANCIAS } from "./calculo/tabelas";

export const vistaVazia = (): Vista => ({
  paredes: [],
  aberturas: [],
  linhas: [],
  cotas: [],
  textos: [],
  fontes: [],
  fundo: null,
  legenda: null,
  legendaVisivel: true,
});

export const corteVazio = (): VistaCorte => ({ ...vistaVazia(), linhaCorte: null });

export function novoAmbiente(nome = "Sala de estar", tipologiaId = "estar", peDireito = 2.7): Ambiente {
  return {
    id: uid("amb_"),
    nome,
    tipologiaId,
    peDireito,
    alturaPlano: 0.75,
    condicaoFM: "limpo",
    fm: FM_PRESETS.limpo,
    grupoCores: "claras",
    rho: { ...REFLETANCIAS.claras },
    alvoLx: null,
    notas: "",
    metodoRetangulo: "lmax",
    alturaMontagemCalculo: null,
    p2p: { espacamento: 0.5, margem: true, planoVertical: null },
    planta: vistaVazia(),
    corte: corteVazio(),
    calculos: { lumens: null, p2pH: null, p2pV: null },
  };
}

export function novoProjeto(nome: string, cliente = "", cidade = "", responsavel = ""): Projeto {
  const agora = new Date().toISOString();
  return {
    id: uid("prj_"),
    nome,
    cliente,
    cidade,
    responsavel,
    status: "rascunho",
    notas: "",
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    ambientes: [novoAmbiente()],
    temaQuadro: "escuro",
  };
}

/** Paredes de um retângulo (medidas internas), com a espessura crescendo para fora. */
export function paredesRetangulo(x: number, y: number, w: number, h: number, espessura = 0.15): Parede[] {
  const pts = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  // contorno anti-horário: o lado de fora fica à direita de cada parede
  return pts.map((a, i) => ({
    id: uid("par_"),
    a,
    b: pts[(i + 1) % 4],
    espessura,
    lado: "direita" as const,
    bloqueia: true,
  }));
}

/** Próximo código livre (L01, L02...). */
export function proximoCodigo(fontes: Fonte[]): string {
  let n = 1;
  const usados = new Set(fontes.map((f) => f.codigo));
  while (usados.has(`L${String(n).padStart(2, "0")}`)) n++;
  return `L${String(n).padStart(2, "0")}`;
}

/** Copia profunda com ids novos (para duplicar ambiente/projeto). */
export function comIdsNovos<T>(obj: T): T {
  const mapa = new Map<string, string>();
  const json = JSON.stringify(obj, (k, v) => {
    if ((k === "id" || k === "paredeId") && typeof v === "string") {
      if (!mapa.has(v)) mapa.set(v, uid(v.split("_")[0] + "_"));
      return mapa.get(v);
    }
    return v;
  });
  return JSON.parse(json) as T;
}
