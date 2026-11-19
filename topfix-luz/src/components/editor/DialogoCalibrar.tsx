"use client";

import { useState } from "react";
import { aplicarCalibracao } from "@/lib/acoes";
import { fmt } from "@/lib/calculo/lumens";
import { useEditor } from "@/lib/store";
import type { Pt } from "@/lib/tipos";
import { Dialogo } from "../ui";

export function DialogoCalibrar(props: { medidaDesenho: number; temDesenho: boolean; p1: Pt; p2: Pt; aoFechar: () => void }) {
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState<"m" | "cm">("m");
  const [redimensionar, setRedimensionar] = useState(false);
  const real = parseFloat(valor.replace(",", ".")) / (unidade === "cm" ? 100 : 1);
  const ok = real > 0;
  return (
    <Dialogo titulo="Calibrar escala" aoFechar={props.aoFechar}>
      <p className="text-sm text-[var(--fraco)]">
        Você marcou um trecho que hoje mede <b className="text-white">{fmt(props.medidaDesenho, 3)} m</b> no quadro. Informe a medida real
        desse trecho (por exemplo, a face de uma parede cotada na planta).
      </p>
      <div className="mt-4 flex items-end gap-2">
        <label className="campo flex-1">
          <span>Medida real</span>
          <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex.: 7,30" />
        </label>
        <select className="entrada w-20" value={unidade} onChange={(e) => setUnidade(e.target.value as "m" | "cm")}>
          <option value="m">m</option>
          <option value="cm">cm</option>
        </select>
      </div>
      {ok && (
        <p className="mt-3 text-sm">
          Fator de escala: <b>{fmt(real / props.medidaDesenho, 4)}</b>. O trecho passa a medir <b>{fmt(real, 2)} m</b>.
        </p>
      )}
      {props.temDesenho && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={redimensionar} onChange={(e) => setRedimensionar(e.target.checked)} />
          Redimensionar também as paredes e fontes já desenhadas
        </label>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="botao" onClick={props.aoFechar}>
          Cancelar
        </button>
        <button
          className="botao botao-marca"
          disabled={!ok}
          onClick={() => {
            aplicarCalibracao(props.p1, props.p2, real, redimensionar);
            useEditor.getState().avisar("Escala aplicada e validada.");
            useEditor.getState().set({ ferramenta: "selecionar" });
            props.aoFechar();
          }}
        >
          Aplicar escala
        </button>
      </div>
    </Dialogo>
  );
}
