"use client";

import { useRef } from "react";
import { legendaDe, textoLinhaLegenda } from "@/lib/ambiente";
import { cssDoCCT } from "@/lib/cor";
import { mudarVista, useEditor, useVista } from "@/lib/store";

/** Legenda no painel lateral. */
export function LegendaPainel() {
  const vista = useVista();
  if (!vista) return null;
  const linhas = legendaDe(vista.fontes);
  return (
    <div>
      <div className="rotulo-secao">Legenda</div>
      {!linhas.length ? (
        <p className="mt-1 text-sm text-[var(--fraco)]">A legenda se monta sozinha quando você coloca fontes.</p>
      ) : (
        <ul className="mt-1 grid gap-1 text-sm">
          {linhas.map((l) => (
            <li key={`${l.codigo}${l.cct}${l.natureza}`} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssDoCCT(l.cct) }} />
              <button
                className="text-left hover:underline"
                title="Selecionar as peças deste tipo"
                onClick={() =>
                  useEditor.getState().set({
                    selecao: vista.fontes.filter((f) => f.codigo === l.codigo && Math.round(f.cct) === l.cct).map((f) => ({ tipo: "fonte" as const, id: f.id })),
                  })
                }
              >
                {textoLinhaLegenda(l)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Legenda sobre o quadro: arrastável; a posição (em fração do quadro) vai para o PNG/PDF. */
export function LegendaQuadro() {
  const vista = useVista();
  const ref = useRef<HTMLDivElement>(null);
  const arr = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  if (!vista || !vista.legendaVisivel) return null;
  const linhas = legendaDe(vista.fontes);
  if (!linhas.length) return null;
  const pos = vista.legenda ?? { x: 0.015, y: 0.03 };
  return (
    <div
      ref={ref}
      className="absolute z-10 cursor-move rounded-lg border border-white/15 bg-[#0d1320]/90 px-3 py-2 text-xs text-[#e7ecf6] shadow-xl backdrop-blur max-md:origin-top-left max-md:scale-75"
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
      onPointerDown={(e) => {
        const pai = ref.current!.parentElement!.getBoundingClientRect();
        arr.current = { x: e.clientX, y: e.clientY, px: pos.x * pai.width, py: pos.y * pai.height };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.stopPropagation();
      }}
      onPointerMove={(e) => {
        if (!arr.current) return;
        const pai = ref.current!.parentElement!.getBoundingClientRect();
        const caixa = ref.current!.getBoundingClientRect();
        const nx = Math.max(0, Math.min(pai.width - caixa.width, arr.current.px + e.clientX - arr.current.x));
        const ny = Math.max(0, Math.min(pai.height - caixa.height, arr.current.py + e.clientY - arr.current.y));
        ref.current!.style.left = `${(nx / pai.width) * 100}%`;
        ref.current!.style.top = `${(ny / pai.height) * 100}%`;
      }}
      onPointerUp={() => {
        if (!arr.current) return;
        arr.current = null;
        const pai = ref.current!.parentElement!.getBoundingClientRect();
        const caixa = ref.current!.getBoundingClientRect();
        const x = (caixa.left - pai.left) / pai.width;
        const y = (caixa.top - pai.top) / pai.height;
        mudarVista((v) => {
          v.legenda = { x, y };
        });
      }}
    >
      <div className="mb-1 text-[10px] font-bold tracking-[0.18em] text-[var(--marca)]">LEGENDA</div>
      {linhas.map((l) => (
        <div key={`${l.codigo}${l.cct}${l.natureza}`} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ background: cssDoCCT(l.cct) }} />
          {textoLinhaLegenda(l)}
        </div>
      ))}
    </div>
  );
}
