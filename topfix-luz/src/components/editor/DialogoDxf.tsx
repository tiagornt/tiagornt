"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/calculo/lumens";
import { palpiteUnidade, UNIDADES, type DxfLido } from "@/lib/importacao/dxf";
import { mudarVista, useEditor } from "@/lib/store";
import { Dialogo } from "../ui";

/** Fluxo "Validar escala do DXF": prévia, unidade, medida real conhecida e escolha de camadas. */
export function DialogoDxf(props: { lido: DxfLido; nomeArquivo: string; aoFechar: () => void }) {
  const { lido } = props;
  const largArq = lido.bbox.maxX - lido.bbox.minX;
  const altArq = lido.bbox.maxY - lido.bbox.minY;
  const [unidade, setUnidade] = useState<string>(lido.unidadeArquivo ?? palpiteUnidade(largArq));
  const [larguraReal, setLarguraReal] = useState("");
  const [medicao, setMedicao] = useState<{ x: number; y: number }[]>([]);
  const [medidaTrecho, setMedidaTrecho] = useState("");
  const [camadas, setCamadas] = useState(() => Object.fromEntries(lido.camadas.map((c) => [c.nome, c.sugerida])));
  const ref = useRef<HTMLCanvasElement>(null);

  const num = (t: string) => parseFloat(t.replace(",", "."));
  const trechoArq = medicao.length === 2 ? Math.hypot(medicao[1].x - medicao[0].x, medicao[1].y - medicao[0].y) : 0;

  // fator arquivo → metro
  const fator = useMemo(() => {
    if (medicao.length === 2 && num(medidaTrecho) > 0 && trechoArq > 0) return num(medidaTrecho) / trechoArq;
    if (num(larguraReal) > 0 && largArq > 0) return num(larguraReal) / largArq;
    const u = UNIDADES.find((x) => x.id === unidade);
    return u && Number.isFinite(u.fator) ? u.fator : NaN;
  }, [unidade, larguraReal, largArq, medicao, medidaTrecho, trechoArq]);

  const personalizada = (medicao.length === 2 && num(medidaTrecho) > 0) || num(larguraReal) > 0;

  // prévia
  const vista = useMemo(() => {
    const W = 520;
    const H = 320;
    const s = Math.min((W - 30) / Math.max(1e-9, largArq), (H - 30) / Math.max(1e-9, altArq));
    return { W, H, s, ox: (W - largArq * s) / 2 - lido.bbox.minX * s, oy: (H + altArq * s) / 2 + lido.bbox.minY * s };
  }, [largArq, altArq, lido.bbox.minX, lido.bbox.minY]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = vista.W * dpr;
    cv.height = vista.H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b111d";
    ctx.fillRect(0, 0, vista.W, vista.H);
    ctx.setTransform(vista.s * dpr, 0, 0, -vista.s * dpr, vista.ox * dpr, vista.oy * dpr);
    ctx.lineWidth = 1 / vista.s;
    for (const p of lido.polilinhas) {
      ctx.strokeStyle = camadas[p.camada] ? "rgba(220,230,245,0.85)" : "rgba(120,130,150,0.25)";
      ctx.beginPath();
      ctx.moveTo(p.pts[0], p.pts[1]);
      for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]);
      if (p.fechado) ctx.closePath();
      ctx.stroke();
    }
    if (medicao.length) {
      ctx.strokeStyle = "#f0c060";
      ctx.fillStyle = "#f0c060";
      ctx.lineWidth = 2 / vista.s;
      ctx.beginPath();
      medicao.forEach((m, i) => (i ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y)));
      ctx.stroke();
      for (const m of medicao) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4 / vista.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [lido, vista, camadas, medicao]);

  function cliquePrevia(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * vista.W;
    const sy = ((e.clientY - r.top) / r.height) * vista.H;
    let p = { x: (sx - vista.ox) / vista.s, y: -(sy - vista.oy) / vista.s };
    // encaixa na ponta mais próxima
    const tol = 8 / vista.s;
    let dm = tol;
    for (const pl of lido.polilinhas)
      for (let i = 0; i < pl.pts.length; i += 2) {
        const d = Math.hypot(pl.pts[i] - p.x, pl.pts[i + 1] - p.y);
        if (d < dm) {
          dm = d;
          p = { x: pl.pts[i], y: pl.pts[i + 1] };
        }
      }
    setMedicao((m) => (m.length >= 2 ? [p] : [...m, p]));
  }

  function aplicar() {
    if (!Number.isFinite(fator) || fator <= 0) return;
    const { minX, minY } = lido.bbox;
    const entidades = lido.polilinhas.map((p) => ({
      camada: p.camada,
      fechado: p.fechado,
      pts: p.pts.map((v, i) => (i % 2 === 0 ? (v - minX) * fator : (v - minY) * fator)),
    }));
    mudarVista((v) => {
      v.fundo = {
        tipo: "dxf",
        nomeArquivo: props.nomeArquivo,
        opacidade: 1,
        travado: true,
        visivel: true,
        validadoEm: new Date().toISOString(),
        camadas: lido.camadas.map((c) => ({ nome: c.nome, entidades: c.entidades, visivel: !!camadas[c.nome] })),
        entidades,
        unidadeOrigem: personalizada ? `personalizada (fator ${fator})` : unidade,
        calibracao: null,
      };
    });
    const est = useEditor.getState();
    est.set({ pedidoEnquadrar: est.pedidoEnquadrar + 1, ferramenta: "selecionar" });
    est.avisar('Escala aplicada. Use "Promover a parede" (no painel Base) ou desenhe as paredes por cima do DXF.');
    props.aoFechar();
  }

  const ok = Number.isFinite(fator) && fator > 0;
  const largM = largArq * fator;
  const altM = altArq * fator;
  const suspeito = ok && (largM > 200 || largM < 1);

  return (
    <Dialogo titulo="Validar escala do DXF" aoFechar={props.aoFechar} largo>
      <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--fraco)]">
        CONFIRA SE AS DIMENSÕES ABAIXO CORRESPONDEM AO PROJETO REAL ANTES DE IMPORTAR.
      </p>
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div>
          <canvas
            ref={ref}
            onClick={cliquePrevia}
            className="w-full cursor-crosshair rounded-lg border border-[var(--borda)]"
            style={{ aspectRatio: `${vista.W} / ${vista.H}` }}
          />
          <p className="mt-2 text-xs text-[var(--fraco)]">
            {lido.polilinhas.length.toLocaleString("pt-BR")} linhas lidas
            {lido.ignoradas ? `, ${lido.ignoradas.toLocaleString("pt-BR")} entidades ignoradas (textos, cotas, hachuras)` : ""}
            {lido.foraDaMargem ? `, ${lido.foraDaMargem} fora da área principal descartadas` : ""}. Clique em duas pontas da prévia para medir um
            trecho conhecido.
          </p>
        </div>
        <div className="grid content-start gap-3">
          <label className="campo">
            <span>Unidade do desenho</span>
            <select className="entrada" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              {UNIDADES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Largura total real (m), opcional</span>
            <input inputMode="decimal" value={larguraReal} onChange={(e) => setLarguraReal(e.target.value)} placeholder="informe para calibrar" />
          </label>
          {medicao.length === 2 && (
            <label className="campo">
              <span>Trecho medido: {fmt(trechoArq, 2)} no arquivo. Medida real (m)</span>
              <input autoFocus inputMode="decimal" value={medidaTrecho} onChange={(e) => setMedidaTrecho(e.target.value)} placeholder="ex.: 3,60" />
            </label>
          )}
          <div className="rounded-lg border border-[var(--borda)] bg-black/20 p-3 text-sm">
            <div className="text-xs font-semibold tracking-wide text-[var(--fraco)]">DIMENSÕES RESULTANTES</div>
            {ok ? (
              <>
                <div className="mt-1 text-lg font-semibold">
                  {fmt(largM, 2)} × {fmt(altM, 2)} m
                </div>
                <div className="text-xs text-[var(--fraco)]">
                  {fmt(largArq, 2)} no arquivo vira {fmt(largM, 2)} m
                </div>
                {suspeito && <div className="mt-1 text-xs text-amber-300">Medida fora do comum para um ambiente. Confira a unidade.</div>}
              </>
            ) : (
              <div className="mt-1 text-[var(--fraco)]">Informe a largura real ou meça um trecho.</div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-[var(--fraco)]">CAMADAS QUE ENTRAM NA BASE</div>
            <div className="max-h-44 overflow-auto rounded-lg border border-[var(--borda)] p-2 text-sm">
              {lido.camadas.map((c) => (
                <label key={c.nome} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={!!camadas[c.nome]} onChange={(e) => setCamadas({ ...camadas, [c.nome]: e.target.checked })} />
                  <span className="flex-1 truncate">{c.nome}</span>
                  <span className="text-xs text-[var(--fraco)]">{c.entidades}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="botao" onClick={props.aoFechar}>
          Cancelar
        </button>
        <button className="botao botao-marca" disabled={!ok} onClick={aplicar}>
          Aplicar escala
        </button>
      </div>
    </Dialogo>
  );
}
