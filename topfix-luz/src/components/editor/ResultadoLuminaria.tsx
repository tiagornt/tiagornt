"use client";

import { useMemo } from "react";
import { bloqueadoresDaVista } from "@/lib/geometria";
import { fmt } from "@/lib/calculo/lumens";
import { resultadoDaFonte, type RespostaFonte } from "@/lib/calculo/fonte";
import { cssDoCCT } from "@/lib/cor";
import { useEditor } from "@/lib/store";
import type { Ambiente, Fonte, Vista } from "@/lib/tipos";

/** No corte, a fonte é convertida para um facho equivalente (inclinação a partir da rotação). */
export function fonteParaCalculo(f: Fonte, vista: "planta" | "corte"): Fonte {
  if (vista === "planta") return f;
  const desvio = f.rotacao + 90; // 0 = para baixo
  return { ...f, x: 0, y: 0, altura: f.y, tilt: Math.min(85, Math.abs(desvio)), rotacao: desvio >= 0 ? 0 : 180 };
}

export function useResultadoFonte(f: Fonte | null, amb: Ambiente | null, vistaNome: "planta" | "corte", vista: Vista | null): RespostaFonte | null {
  return useMemo(() => {
    if (!f || !amb || !vista) return null;
    const bloq = vistaNome === "planta" ? bloqueadoresDaVista(vista) : [];
    return resultadoDaFonte(fonteParaCalculo(f, vistaNome), amb.alturaPlano, bloq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, amb?.alturaPlano, vistaNome, vista?.paredes, vista?.aberturas, vista?.linhas]);
}

/** Desenho em corte do que a luminária projeta no plano de trabalho, com os números. */
export function ResultadoLuminaria({ f, amb, vista }: { f: Fonte; amb: Ambiente; vista: Vista }) {
  const vistaNome = useEditor((s) => s.vista);
  const r = useResultadoFonte(f, amb, vistaNome, vista);
  if (!r) return null;
  if (!r.ok)
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
        <b>Resultado desta luminária:</b> {r.motivo}
      </div>
    );
  const W = 300;
  const H = 190;
  const topo = 22;
  const base = 128; // linha do plano de trabalho
  const f10 = r.faixa10 ?? [-1, 1];
  const f50 = r.faixa50 ?? [-0.5, 0.5];
  const uMin = Math.min(f10[0], -0.4) - 0.3;
  const uMax = Math.max(f10[1], 0.4) + 0.3;
  const X = (u: number) => 10 + (u - uMin) * ((W - 20) / (uMax - uMin));
  const Z = (z: number) => base - z * ((base - topo) / r.h);
  const cor = cssDoCCT(f.cct);
  // curva do perfil (abaixo do plano)
  const alturaGrafico = 44;
  const pts = r.perfil
    .filter((p) => p.u >= uMin && p.u <= uMax)
    .map((p) => `${X(p.u).toFixed(1)},${(base + 6 + alturaGrafico - (p.E / Math.max(1e-9, r.Emax)) * alturaGrafico).toFixed(1)}`)
    .join(" ");
  const id = `g${f.id}`;
  return (
    <div className="rounded-xl border border-[var(--borda)] bg-black/25 p-3">
      <div className="rotulo-secao">Resultado desta luminária</div>
      <p className="mt-0.5 text-[11px] text-[var(--fraco)]">Só ela, no plano de trabalho ({fmt(amb.alturaPlano, 2)} m). Na planta, a mancha útil aparece tracejada.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Corte do facho da luminária">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cor} stopOpacity="0.85" />
            <stop offset="1" stopColor={cor} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* alcance (10%) e mancha útil (50%) */}
        <polygon points={`${X(0)},${Z(r.h)} ${X(f10[0])},${base} ${X(f10[1])},${base}`} fill={cor} opacity="0.12" />
        <polygon points={`${X(0)},${Z(r.h)} ${X(f50[0])},${base} ${X(f50[1])},${base}`} fill={`url(#${id})`} />
        {/* plano de trabalho */}
        <line x1="0" x2={W} y1={base} y2={base} stroke="rgba(200,210,230,0.6)" strokeWidth="1" />
        <text x={W - 4} y={base - 4} textAnchor="end" fontSize="9" fill="rgba(200,210,230,0.7)">
          plano {fmt(amb.alturaPlano, 2)} m
        </text>
        {/* altura */}
        <line x1={X(uMin) + 4} x2={X(uMin) + 4} y1={Z(r.h)} y2={base} stroke="rgba(200,210,230,0.5)" strokeDasharray="3 3" />
        <text x={X(uMin) + 8} y={(Z(r.h) + base) / 2} fontSize="10" fill="#e7ecf6">
          h {fmt(r.h, 2)} m
        </text>
        {/* luminária */}
        <circle cx={X(0)} cy={Z(r.h)} r="4.5" fill={cor} stroke="#fff" strokeWidth="1" />
        <text x={X(0)} y={Z(r.h) - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#e7ecf6">
          {f.codigo}
        </text>
        {/* largura da mancha útil */}
        <line x1={X(f50[0])} x2={X(f50[1])} y1={base + 3} y2={base + 3} stroke="#56c7f5" strokeWidth="2" />
        {/* perfil de lux */}
        <polyline points={pts} fill="none" stroke="#56c7f5" strokeWidth="1.4" />
        <text x={W - 4} y={base + 16} textAnchor="end" fontSize="9" fill="rgba(200,210,230,0.7)">
          lux ao longo do facho
        </text>
      </svg>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <span className="text-[var(--fraco)]">No centro</span>
        <b className="text-right">{fmt(r.Ecentro)} lx</b>
        <span className="text-[var(--fraco)]">Mancha útil (50%)</span>
        <b className="text-right">Ø {fmt(r.diametro50, 2)} m</b>
        <span className="text-[var(--fraco)]">Média na mancha</span>
        <b className="text-right">{fmt(r.Emedia50)} lx</b>
        <span className="text-[var(--fraco)]">Alcance (10%)</span>
        <b className="text-right">Ø {fmt(r.diametro10, 2)} m</b>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--fraco)]">
        Estimativa da componente direta, sem reflexões. O total do ambiente (todas as luzes juntas) está nas abas P2P horiz. e M. Lúmens.
      </p>
    </div>
  );
}
