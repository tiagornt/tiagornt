"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function Dialogo(props: { titulo: string; aoFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.aoFechar();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onPointerDown={(e) => e.target === e.currentTarget && props.aoFechar()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.titulo}
        className={`max-h-[92vh] w-full overflow-auto rounded-2xl border border-[var(--borda)] bg-[var(--painel)] p-5 shadow-2xl ${props.largo ? "max-w-4xl" : "max-w-md"}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{props.titulo}</h2>
          <button className="icone" aria-label="Fechar" onClick={props.aoFechar}>
            <X size={18} />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Secao(props: { titulo: string; children: ReactNode; aberta?: boolean; acao?: ReactNode }) {
  return (
    <details className="secao" open={props.aberta ?? true}>
      <summary>
        <span>{props.titulo}</span>
        {props.acao}
      </summary>
      <div className="secao-corpo">{props.children}</div>
    </details>
  );
}

/** Campo numérico com vírgula decimal (pt-BR). Grava ao sair do campo ou com Enter. */
export function CampoNumero(props: {
  rotulo: string;
  valor: number | null;
  aoMudar: (v: number | null) => void;
  unidade?: string;
  casas?: number;
  min?: number;
  max?: number;
  vazio?: boolean;
  dica?: string;
}) {
  const casas = props.casas ?? 2;
  const texto = props.valor == null ? "" : props.valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
  return (
    <label className="campo" title={props.dica}>
      <span>{props.rotulo}</span>
      <div className="flex items-center gap-1">
        <input
          key={texto}
          inputMode="decimal"
          defaultValue={texto}
          placeholder={props.vazio ? "informe" : ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            const bruto = e.target.value.trim();
            // com vírgula, o ponto é milhar; sem vírgula, o ponto é decimal
            const t = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
            if (!t) {
              if (props.vazio) props.aoMudar(null);
              else e.target.value = texto;
              return;
            }
            let v = parseFloat(t);
            if (!Number.isFinite(v)) {
              e.target.value = texto;
              return;
            }
            if (props.min != null) v = Math.max(props.min, v);
            if (props.max != null) v = Math.min(props.max, v);
            if (v !== props.valor) props.aoMudar(v);
            else e.target.value = texto;
          }}
        />
        {props.unidade && <em>{props.unidade}</em>}
      </div>
    </label>
  );
}

export function Deslizante(props: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  unidade?: string;
  aoMudar: (v: number, final: boolean) => void;
  fundo?: string;
}) {
  return (
    <label className="campo">
      <span className="flex justify-between">
        {props.rotulo}
        <b className="font-semibold text-white">
          {props.valor.toLocaleString("pt-BR")}
          {props.unidade ? ` ${props.unidade}` : ""}
        </b>
      </span>
      <input
        type="range"
        className="deslizante"
        style={props.fundo ? { background: props.fundo } : undefined}
        min={props.min}
        max={props.max}
        step={props.passo ?? 1}
        value={props.valor}
        onChange={(e) => props.aoMudar(parseFloat(e.target.value), false)}
        onPointerUp={(e) => props.aoMudar(parseFloat((e.target as HTMLInputElement).value), true)}
        onKeyUp={(e) => props.aoMudar(parseFloat((e.target as HTMLInputElement).value), true)}
      />
    </label>
  );
}
