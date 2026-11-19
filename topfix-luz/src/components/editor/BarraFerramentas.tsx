"use client";

import {
  BoxSelect,
  Copy,
  DoorOpen,
  Hand,
  Maximize,
  MousePointer2,
  Redo2,
  RectangleHorizontal,
  Ruler,
  Slash,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  PenLine,
  AppWindow,
  MoveHorizontal,
  Scissors,
} from "lucide-react";
import type { ReactNode } from "react";
import { apagarSelecao, duplicarSelecao } from "@/lib/acoes";
import { useEditor, type Ferramenta } from "@/lib/store";
import { NATUREZAS, NOME_NATUREZA } from "@/lib/tipos";
import { IconeNatureza } from "./Icones";

function Btn(props: { ativo?: boolean; titulo: string; onClick: () => void; children: ReactNode; desab?: boolean }) {
  return (
    <button
      className={`ferramenta ${props.ativo ? "ferramenta-ativa" : ""}`}
      title={props.titulo}
      aria-label={props.titulo}
      aria-pressed={props.ativo}
      disabled={props.desab}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function Grupo(props: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[10px] font-bold tracking-[0.14em] text-[var(--fraco)] xl:inline">{props.rotulo}</span>
      <div className="flex items-center gap-0.5 rounded-lg bg-black/25 p-0.5">{props.children}</div>
    </div>
  );
}

export function zoomQuadro(k: number) {
  window.dispatchEvent(new CustomEvent("quadro-zoom", { detail: k }));
}

export function BarraFerramentas() {
  const ferramenta = useEditor((s) => s.ferramenta);
  const set = useEditor((s) => s.set);
  const passado = useEditor((s) => s.passado.length);
  const futuro = useEditor((s) => s.futuro.length);
  const selecao = useEditor((s) => s.selecao.length);
  const vista = useEditor((s) => s.vista);
  const f = (x: Ferramenta) => () => set({ ferramenta: x });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--borda)] px-3 py-2">
      <Grupo rotulo="EDIÇÃO">
        <Btn titulo="Selecionar (V)" ativo={ferramenta === "selecionar"} onClick={f("selecionar")}>
          <MousePointer2 size={17} />
        </Btn>
        <Btn titulo="Mover o quadro (H ou espaço)" ativo={ferramenta === "mao"} onClick={f("mao")}>
          <Hand size={17} />
        </Btn>
        <Btn titulo="Duplicar (Ctrl+D)" desab={!selecao} onClick={() => duplicarSelecao()}>
          <Copy size={17} />
        </Btn>
        <Btn titulo="Apagar (Delete)" desab={!selecao} onClick={apagarSelecao}>
          <Trash2 size={17} />
        </Btn>
        <Btn titulo="Desfazer (Ctrl+Z)" desab={!passado} onClick={() => useEditor.getState().desfazer()}>
          <Undo2 size={17} />
        </Btn>
        <Btn titulo="Refazer (Ctrl+Y)" desab={!futuro} onClick={() => useEditor.getState().refazer()}>
          <Redo2 size={17} />
        </Btn>
      </Grupo>
      <Grupo rotulo="AMBIENTE">
        <Btn titulo="Parede (W): clique ponto a ponto, digite a medida e Enter" ativo={ferramenta === "parede"} onClick={f("parede")}>
          <PenLine size={17} />
        </Btn>
        {vista === "planta" && (
          <Btn titulo="Retângulo (R): arraste ou digite 4x5 e Enter" ativo={ferramenta === "retangulo"} onClick={f("retangulo")}>
            <RectangleHorizontal size={17} />
          </Btn>
        )}
        {vista === "planta" && (
          <Btn titulo="Porta (P): clique sobre a parede" ativo={ferramenta === "porta"} onClick={f("porta")}>
            <DoorOpen size={17} />
          </Btn>
        )}
        {vista === "planta" && (
          <Btn titulo="Janela (J): clique sobre a parede" ativo={ferramenta === "janela"} onClick={f("janela")}>
            <AppWindow size={17} />
          </Btn>
        )}
        <Btn titulo="Limite de croqui (L): bloqueia a luz e gera sombra" ativo={ferramenta === "limite"} onClick={f("limite")}>
          <SquareDashed size={17} />
        </Btn>
        <Btn titulo="Linha de referência (móvel, bancada, sanca): só desenho" ativo={ferramenta === "referencia"} onClick={f("referencia")}>
          <Slash size={17} />
        </Btn>
        <Btn titulo="Cota (C)" ativo={ferramenta === "cota"} onClick={f("cota")}>
          <MoveHorizontal size={17} />
        </Btn>
        <Btn titulo="Texto (T)" ativo={ferramenta === "texto"} onClick={f("texto")}>
          <Type size={17} />
        </Btn>
        <Btn titulo="Medir (M)" ativo={ferramenta === "medir"} onClick={f("medir")}>
          <Ruler size={17} />
        </Btn>
        {vista === "planta" && (
          <Btn titulo="Linha de corte: gera o corte esquemático" ativo={ferramenta === "linha_corte"} onClick={f("linha_corte")}>
            <Scissors size={17} />
          </Btn>
        )}
      </Grupo>
      <Grupo rotulo="LUZ">
        {NATUREZAS.map((n, i) => (
          <Btn key={n} titulo={`${NOME_NATUREZA[n]} (${i + 1})`} ativo={ferramenta === n} onClick={f(n)}>
            <IconeNatureza n={n} tam={17} />
          </Btn>
        ))}
      </Grupo>
      <Grupo rotulo="VISTA">
        <Btn titulo="Afastar" onClick={() => zoomQuadro(1 / 1.25)}>
          <ZoomOut size={17} />
        </Btn>
        <Btn titulo="Aproximar" onClick={() => zoomQuadro(1.25)}>
          <ZoomIn size={17} />
        </Btn>
        <Btn titulo="Enquadrar o desenho (F)" onClick={() => set({ pedidoEnquadrar: useEditor.getState().pedidoEnquadrar + 1 })}>
          <Maximize size={17} />
        </Btn>
        <Btn titulo="Selecionar por área: arraste no vazio com a seta" onClick={f("selecionar")}>
          <BoxSelect size={17} />
        </Btn>
      </Grupo>
    </div>
  );
}
