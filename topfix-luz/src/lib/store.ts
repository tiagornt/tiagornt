"use client";

import { create } from "zustand";
import { produce } from "immer";
import type { Ambiente, Projeto, Vista, VistaCorte } from "./tipos";

export type Aba = "croqui" | "lumens" | "p2ph" | "p2pv" | "nbr";
export type NomeVista = "planta" | "corte";
export type TipoSel = "parede" | "abertura" | "linha" | "cota" | "texto" | "fonte";
export type ItemSel = { tipo: TipoSel; id: string };

export type Ferramenta =
  | "selecionar"
  | "mao"
  | "parede"
  | "retangulo"
  | "porta"
  | "janela"
  | "limite"
  | "referencia"
  | "cota"
  | "texto"
  | "medir"
  | "calibrar"
  | "promover"
  | "plano_vertical"
  | "linha_corte"
  | "facho"
  | "linear_dirigido"
  | "linha_difusa"
  | "difusa";

export interface Camadas {
  fundo: boolean;
  base: boolean;
  vaos: boolean;
  cotas: boolean;
  croqui: boolean;
  calculos: boolean;
}

export type StatusSalvo = "salvo" | "alterado" | "salvando" | "erro";

interface Estado {
  projeto: Projeto | null;
  ambienteId: string | null;
  vista: NomeVista;
  aba: Aba;
  ferramenta: Ferramenta;
  selecao: ItemSel[];
  passado: Projeto[];
  futuro: Projeto[];
  status: StatusSalvo;
  camadas: Camadas;
  snapAtivo: boolean;
  passoSnap: number;
  presetPorNatureza: Record<string, string>;
  /** Pedido para o canvas enquadrar o desenho (incrementa a cada pedido). */
  pedidoEnquadrar: number;
  mensagem: { texto: string; tipo: "info" | "erro" } | null;

  carregar: (p: Projeto) => void;
  mudar: (fn: (d: Projeto) => void, historico?: boolean) => void;
  marcarHistorico: () => void;
  desfazer: () => void;
  refazer: () => void;
  set: (parcial: Partial<Estado>) => void;
  avisar: (texto: string, tipo?: "info" | "erro") => void;
}

const LIMITE_HISTORICO = 100;

export const useEditor = create<Estado>((setState, get) => ({
  projeto: null,
  ambienteId: null,
  vista: "planta",
  aba: "croqui",
  ferramenta: "selecionar",
  selecao: [],
  passado: [],
  futuro: [],
  status: "salvo",
  camadas: { fundo: true, base: true, vaos: true, cotas: true, croqui: true, calculos: true },
  snapAtivo: true,
  passoSnap: 0.05,
  presetPorNatureza: {},
  pedidoEnquadrar: 0,
  mensagem: null,

  carregar: (p) =>
    setState({
      projeto: p,
      ambienteId: p.ambientes[0]?.id ?? null,
      passado: [],
      futuro: [],
      selecao: [],
      status: "salvo",
      pedidoEnquadrar: get().pedidoEnquadrar + 1,
    }),

  mudar: (fn, historico = true) => {
    const atual = get().projeto;
    if (!atual) return;
    const novo = produce(atual, (d) => {
      fn(d);
      d.atualizadoEm = new Date().toISOString();
    });
    if (novo === atual) return;
    setState({
      projeto: novo,
      passado: historico ? [...get().passado.slice(-LIMITE_HISTORICO + 1), atual] : get().passado,
      futuro: historico ? [] : get().futuro,
      status: "alterado",
    });
  },

  /** Grava o estado atual no histórico (início de um arrasto, que depois muda sem histórico). */
  marcarHistorico: () => {
    const atual = get().projeto;
    if (!atual) return;
    setState({ passado: [...get().passado.slice(-LIMITE_HISTORICO + 1), atual], futuro: [] });
  },

  desfazer: () => {
    const { passado, projeto, futuro } = get();
    if (!passado.length || !projeto) return;
    const anterior = passado[passado.length - 1];
    setState({
      projeto: anterior,
      passado: passado.slice(0, -1),
      futuro: [projeto, ...futuro],
      status: "alterado",
      selecao: [],
      ambienteId: anterior.ambientes.some((a) => a.id === get().ambienteId) ? get().ambienteId : anterior.ambientes[0]?.id,
    });
  },

  refazer: () => {
    const { passado, projeto, futuro } = get();
    if (!futuro.length || !projeto) return;
    const prox = futuro[0];
    setState({
      projeto: prox,
      passado: [...passado, projeto],
      futuro: futuro.slice(1),
      status: "alterado",
      selecao: [],
      ambienteId: prox.ambientes.some((a) => a.id === get().ambienteId) ? get().ambienteId : prox.ambientes[0]?.id,
    });
  },

  set: (parcial) => setState(parcial as Estado),

  avisar: (texto, tipo = "info") => {
    setState({ mensagem: { texto, tipo } });
    setTimeout(() => {
      if (get().mensagem?.texto === texto) setState({ mensagem: null });
    }, 4500);
  },
}));

// ---------- Acesso ao ambiente e à vista atuais ----------

export function ambienteAtual(s: Pick<Estado, "projeto" | "ambienteId">): Ambiente | null {
  return s.projeto?.ambientes.find((a) => a.id === s.ambienteId) ?? s.projeto?.ambientes[0] ?? null;
}

export function vistaDe(a: Ambiente, v: NomeVista): Vista {
  return v === "planta" ? a.planta : a.corte;
}

export const useAmbiente = () => useEditor((s) => ambienteAtual(s));
export const useVista = () =>
  useEditor((s) => {
    const a = ambienteAtual(s);
    return a ? vistaDe(a, s.vista) : null;
  });

/** Muda o ambiente atual (dentro de um draft). */
export function mudarAmbiente(fn: (a: Ambiente) => void, historico = true) {
  const { ambienteId } = useEditor.getState();
  useEditor.getState().mudar((d) => {
    const a = d.ambientes.find((x) => x.id === ambienteId) ?? d.ambientes[0];
    if (a) fn(a);
  }, historico);
}

/** Muda a vista atual (planta ou corte) do ambiente atual. */
export function mudarVista(fn: (v: Vista, a: Ambiente) => void, historico = true) {
  const { vista } = useEditor.getState();
  mudarAmbiente((a) => fn(vista === "planta" ? a.planta : (a.corte as VistaCorte), a), historico);
}
