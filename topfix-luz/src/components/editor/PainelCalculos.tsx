"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  alvoDoAmbiente,
  areaAmbiente,
  calcularLumens,
  calcularP2PH,
  calcularP2PV,
  dimensoesParaK,
  escalaPendente,
  sugerirQuantidade,
  tiposDoAmbiente,
} from "@/lib/ambiente";
import { aplicarQuantidade } from "@/lib/acoes";
import { corFalsa, ESCALA_LUX } from "@/lib/cor";
import { dist } from "@/lib/geometria";
import { fmt, NOME_STATUS, statusAlvo, type StatusAlvo } from "@/lib/calculo/lumens";
import {
  AVISO_PADRAO,
  FM_PRESETS,
  NOME_FM,
  NOME_GRUPO,
  REFLETANCIAS,
  TEXTO_NBR,
  TIPOLOGIAS,
  tipologia,
} from "@/lib/calculo/tabelas";
import { mudarAmbiente, useAmbiente, useEditor } from "@/lib/store";
import type { Ambiente, CondicaoFM, GrupoCores, ResultadoP2P } from "@/lib/tipos";
import { CampoNumero, Dialogo } from "../ui";

export function Aviso({ compacto }: { compacto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
      <b>Estimativa, não é laudo.</b>{" "}
      {compacto && !aberto ? (
        <>
          Pré-dimensionamento para estudo de intenção; não substitui projeto luminotécnico profissional.{" "}
          <button className="underline" onClick={() => setAberto(true)}>
            Ler o aviso completo
          </button>
        </>
      ) : (
        AVISO_PADRAO
      )}
    </div>
  );
}

const COR_STATUS: Record<StatusAlvo, string> = {
  abaixo: "bg-sky-500/20 text-sky-200 border-sky-400/40",
  na_faixa: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  acima: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  sem_alvo: "bg-white/10 text-white/70 border-white/20",
};

export function ChipStatus({ E, alvo }: { E: number; alvo: number | null }) {
  const st = statusAlvo(E, alvo);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${COR_STATUS[st.status]}`}>
      {NOME_STATUS[st.status]}
      {st.status !== "sem_alvo" && <span className="font-normal opacity-80">({st.dif >= 0 ? "+" : ""}{fmt(st.dif * 100)}%)</span>}
    </span>
  );
}

function Linha({ r, v, dica }: { r: string; v: React.ReactNode; dica?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-1 text-sm" title={dica}>
      <span className="text-[var(--fraco)]">{r}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

/** Configuração do ambiente usada nos cálculos (tipologia, alturas, FM, cores). */
export function ConfigAmbiente({ amb }: { amb: Ambiente }) {
  const m = (fn: (a: Ambiente) => void) => mudarAmbiente(fn);
  return (
    <div className="grid gap-2">
      <label className="campo">
        <span>Tipologia (alvo de referência)</span>
        <select className="entrada" value={amb.tipologiaId} onChange={(e) => m((a) => (a.tipologiaId = e.target.value))}>
          {TIPOLOGIAS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} · {t.eAlvo} lx
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <CampoNumero rotulo="Pé-direito" unidade="m" valor={amb.peDireito} min={1.5} max={30} aoMudar={(v) => m((a) => (a.peDireito = v ?? a.peDireito))} />
        <CampoNumero rotulo="Plano de trabalho" unidade="m" valor={amb.alturaPlano} min={0} max={3} aoMudar={(v) => m((a) => (a.alturaPlano = v ?? 0.75))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="campo">
          <span>Manutenção (FM)</span>
          <select
            className="entrada"
            value={amb.condicaoFM}
            onChange={(e) =>
              m((a) => {
                const c = e.target.value as CondicaoFM;
                a.condicaoFM = c;
                if (c !== "personalizado") a.fm = FM_PRESETS[c];
              })
            }
          >
            {(Object.keys(NOME_FM) as CondicaoFM[]).map((k) => (
              <option key={k} value={k}>
                {NOME_FM[k]}
              </option>
            ))}
          </select>
        </label>
        {amb.condicaoFM === "personalizado" ? (
          <CampoNumero rotulo="FM" valor={amb.fm} min={0.3} max={1} aoMudar={(v) => m((a) => (a.fm = v ?? 0.8))} />
        ) : (
          <label className="campo">
            <span>Cores do ambiente</span>
            <SelectCores amb={amb} />
          </label>
        )}
      </div>
      {amb.condicaoFM === "personalizado" && (
        <label className="campo">
          <span>Cores do ambiente</span>
          <SelectCores amb={amb} />
        </label>
      )}
      {amb.grupoCores === "personalizado" && (
        <div className="grid grid-cols-3 gap-2">
          <CampoNumero rotulo="ρ teto" valor={amb.rho.teto} min={0} max={0.95} aoMudar={(v) => m((a) => (a.rho.teto = v ?? 0.7))} />
          <CampoNumero rotulo="ρ paredes" valor={amb.rho.paredes} min={0} max={0.95} aoMudar={(v) => m((a) => (a.rho.paredes = v ?? 0.5))} />
          <CampoNumero rotulo="ρ piso" valor={amb.rho.piso} min={0} max={0.95} aoMudar={(v) => m((a) => (a.rho.piso = v ?? 0.2))} />
        </div>
      )}
      <CampoNumero
        rotulo="Alvo do projeto (opcional)"
        unidade="lx"
        casas={0}
        vazio
        valor={amb.alvoLx}
        dica={`Vazio = alvo da tabela (${tipologia(amb.tipologiaId).eAlvo} lx)`}
        aoMudar={(v) => m((a) => (a.alvoLx = v))}
      />
    </div>
  );
}

function SelectCores({ amb }: { amb: Ambiente }) {
  return (
    <select
      className="entrada"
      value={amb.grupoCores}
      onChange={(e) =>
        mudarAmbiente((a) => {
          const g = e.target.value as GrupoCores;
          a.grupoCores = g;
          if (g !== "personalizado") a.rho = { ...REFLETANCIAS[g] };
        })
      }
    >
      {(Object.keys(NOME_GRUPO) as GrupoCores[]).map((g) => (
        <option key={g} value={g}>
          {NOME_GRUPO[g]}
        </option>
      ))}
    </select>
  );
}

// ---------- Método dos lúmens ----------

export function PainelLumens() {
  const amb = useAmbiente();
  const [sugestao, setSugestao] = useState<{ codigo: string; N: number; atual: number } | null>(null);
  const r = useMemo(() => (amb ? calcularLumens(amb) : null), [amb]);
  // grava o resultado (snapshot) no ambiente para o PDF
  const chave = r && !("erro" in r) ? `${r.Emed}|${r.K}|${r.FU}|${r.FM}|${r.A}` : "";
  useEffect(() => {
    if (!r || "erro" in r) return;
    const atual = useEditor.getState();
    const a = atual.projeto?.ambientes.find((x) => x.id === atual.ambienteId);
    if (a?.calculos.lumens && `${a.calculos.lumens.Emed}|${a.calculos.lumens.K}|${a.calculos.lumens.FU}|${a.calculos.lumens.FM}|${a.calculos.lumens.A}` === chave) return;
    mudarAmbiente((x) => (x.calculos.lumens = r), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  if (!amb || !r) return null;
  const { tipos } = tiposDoAmbiente(amb);
  const dim = dimensoesParaK(amb);
  const alvo = alvoDoAmbiente(amb);
  return (
    <div className="grid gap-4 p-4">
      <div>
        <div className="rotulo-secao">Método dos lúmens</div>
        <p className="mt-1 text-xs text-[var(--fraco)]">Iluminância média mantida no plano de trabalho. FU tabelado, sem inter-reflexão detalhada.</p>
      </div>
      <Aviso compacto />
      {"erro" in r ? (
        <div className="rounded-lg border border-white/10 p-3 text-sm text-amber-200">{r.erro}</div>
      ) : (
        <div className="rounded-xl border border-[var(--borda)] bg-black/20 p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-[var(--fraco)]">E_med estimada</div>
              <div className="text-3xl font-semibold">
                {fmt(r.Emed)} <span className="text-base font-normal text-[var(--fraco)]">lx</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--fraco)]">Alvo {amb.alvoLx != null ? "do projeto" : "de referência"}</div>
              <div className="text-lg font-semibold">{fmt(alvo)} lx</div>
            </div>
          </div>
          <div className="mt-2">
            <ChipStatus E={r.Emed} alvo={alvo} />
          </div>
          <div className="mt-3">
            <Linha r="Área (A)" v={`${fmt(r.A, 2)} m²`} />
            <Linha r="C × L" v={`${fmt(r.C, 2)} × ${fmt(r.L, 2)} m`} dica={dim?.descricao} />
            <Linha r="h_m (montagem - plano)" v={`${fmt(r.hm, 2)} m`} />
            <Linha r="Índice do local (K)" v={fmt(r.K, 2)} />
            <Linha r="Fator de utilização (FU)" v={fmt(r.FU, 2)} />
            <Linha r="Fator de manutenção (FM)" v={fmt(r.FM, 2)} />
            <Linha r="Σ N × Φ" v={`${fmt(r.somaFluxo)} lm`} />
          </div>
          {r.avisos.map((a) => (
            <p key={a} className="mt-2 text-xs text-amber-200">
              {a}
            </p>
          ))}
        </div>
      )}
      {dim && !dim.retangulo && (
        <label className="campo">
          <span>Polígono irregular: C e L para o índice K</span>
          <select className="entrada" value={amb.metodoRetangulo} onChange={(e) => mudarAmbiente((a) => (a.metodoRetangulo = e.target.value as "lmax"))}>
            <option value="lmax">L = maior lado, C = A / L</option>
            <option value="bbox">Menor retângulo alinhado</option>
          </select>
        </label>
      )}
      <div>
        <div className="rotulo-secao mb-1">Fontes no cálculo</div>
        {!tipos.length ? (
          <p className="text-sm text-[var(--fraco)]">Coloque fontes com fluxo (lm) na planta.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--fraco)]">
              <tr>
                <th className="text-left font-medium">Tipo</th>
                <th className="px-2 text-right font-medium">N</th>
                <th className="text-right font-medium">Φ (lm)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={`${t.codigo}${t.fluxo}`} className="border-t border-white/5">
                  <td className="py-1">
                    {t.codigo} <span className="text-xs text-[var(--fraco)]">{t.natureza}</span>
                    {t.fluxoTipico && <span className="ml-1 text-[10px] text-amber-300">típico</span>}
                  </td>
                  <td className="px-2 text-right">{t.N}</td>
                  <td className="text-right tabular-nums">{fmt(t.fluxo)}</td>
                  <td className="pl-2 text-right">
                    <button
                      className="chip"
                      title="Sugerir quantidade deste tipo para atingir o alvo"
                      onClick={() => {
                        const s = sugerirQuantidade(amb, t.codigo);
                        if (s) setSugestao({ codigo: t.codigo, N: s.N, atual: s.atual });
                      }}
                    >
                      Sugerir N
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <div className="rotulo-secao mb-2">Dados do ambiente</div>
        <ConfigAmbiente amb={amb} />
        <div className="mt-2">
          <CampoNumero
            rotulo="Altura de montagem no cálculo"
            unidade="m"
            vazio
            valor={amb.alturaMontagemCalculo}
            dica="Vazio = média das alturas das fontes, ponderada pelo fluxo"
            aoMudar={(v) => mudarAmbiente((a) => (a.alturaMontagemCalculo = v))}
          />
        </div>
      </div>
      {sugestao && (
        <Dialogo titulo="Sugerir quantidade" aoFechar={() => setSugestao(null)}>
          <p className="text-sm">
            Para chegar a <b>{fmt(alvo)} lx</b> com o FU e o FM atuais, a estimativa pede <b>{sugestao.N}</b> peças {sugestao.codigo} (hoje há{" "}
            {sugestao.atual}).
          </p>
          <p className="mt-2 text-xs text-[var(--fraco)]">
            N = (E_alvo × A) / (Φ × FU × FM), arredondado para cima, descontando o fluxo dos outros tipos. Ao aplicar, as peças {sugestao.codigo} são
            redistribuídas numa grade regular dentro do ambiente; você pode ajustar depois.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="botao" onClick={() => setSugestao(null)}>
              Cancelar
            </button>
            <button
              className="botao botao-marca"
              disabled={sugestao.N < 1}
              onClick={() => {
                aplicarQuantidade(sugestao.codigo, sugestao.N);
                setSugestao(null);
              }}
            >
              Aplicar {sugestao.N} peças
            </button>
          </div>
        </Dialogo>
      )}
    </div>
  );
}

// ---------- Ponto a ponto ----------

function useP2P(tipo: "h" | "v") {
  const amb = useAmbiente();
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chave = amb
    ? JSON.stringify([
        tipo,
        amb.planta.fontes,
        amb.planta.paredes,
        amb.planta.aberturas,
        amb.planta.linhas.filter((l) => l.tipo === "limite"),
        amb.p2p,
        amb.alturaPlano,
        amb.peDireito,
        !!amb.planta.fundo?.validadoEm,
        !!amb.planta.fundo,
      ])
    : "";
  useEffect(() => {
    if (!amb) return;
    setCalculando(true);
    const t = setTimeout(() => {
      const atual = useEditor.getState();
      const a = atual.projeto?.ambientes.find((x) => x.id === atual.ambienteId);
      if (!a) return;
      const r = tipo === "h" ? calcularP2PH(a) : calcularP2PV(a);
      setCalculando(false);
      if ("erro" in r) {
        setErro(r.erro);
        mudarAmbiente((x) => {
          if (tipo === "h") x.calculos.p2pH = null;
          else x.calculos.p2pV = null;
        }, false);
        return;
      }
      setErro(null);
      mudarAmbiente((x) => {
        if (tipo === "h") x.calculos.p2pH = r;
        else x.calculos.p2pV = r;
      }, false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return { amb, calculando, erro };
}

export function EscalaCores({ vertical }: { vertical?: boolean }) {
  return (
    <div className={vertical ? "" : "w-full"}>
      <div className="flex overflow-hidden rounded">
        {ESCALA_LUX.map((v) => {
          const [r, g, b] = corFalsa(v + 0.01);
          return <div key={v} className="h-3 flex-1" style={{ background: `rgb(${r},${g},${b})` }} />;
        })}
      </div>
      <div className="mt-0.5 flex text-[10px] text-[var(--fraco)]">
        {ESCALA_LUX.map((v) => (
          <div key={v} className="flex-1 text-center">
            {v}
          </div>
        ))}
      </div>
      <div className="text-right text-[10px] text-[var(--fraco)]">lx</div>
    </div>
  );
}

function Resumo({ r, alvo }: { r: ResultadoP2P; alvo: number | null }) {
  return (
    <div className="rounded-xl border border-[var(--borda)] bg-black/20 p-3">
      <div className="grid grid-cols-2 gap-x-4">
        <Linha r="E_med" v={`${fmt(r.Emed)} lx`} />
        <Linha r="U0 (E_mín/E_med)" v={fmt(r.U0, 2)} />
        <Linha r="E_mín" v={`${fmt(r.Emin)} lx`} />
        <Linha r="E_máx" v={`${fmt(r.Emax)} lx`} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--fraco)]">
        <span>{r.pontos} pontos, grade de {fmt(r.grade.passo, 2)} m</span>
        {alvo != null && <ChipStatus E={r.Emed} alvo={alvo} />}
      </div>
      {r.avisos.map((a) => (
        <p key={a} className="mt-2 text-xs text-amber-200">
          {a}
        </p>
      ))}
    </div>
  );
}

function ConfigGrade({ amb }: { amb: Ambiente }) {
  return (
    <div className="grid grid-cols-2 items-end gap-2">
      <CampoNumero
        rotulo="Espaçamento da grade"
        unidade="m"
        valor={amb.p2p.espacamento}
        min={0.25}
        max={1}
        aoMudar={(v) => mudarAmbiente((a) => (a.p2p.espacamento = v ?? 0.5))}
      />
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={amb.p2p.margem} onChange={(e) => mudarAmbiente((a) => (a.p2p.margem = e.target.checked))} />
        Margem de 0,20 m
      </label>
    </div>
  );
}

export function PainelP2PH() {
  const { amb, calculando, erro } = useP2P("h");
  if (!amb) return null;
  const r = amb.calculos.p2pH;
  return (
    <div className="grid gap-4 p-4">
      <div>
        <div className="rotulo-secao">Ponto a ponto horizontal {calculando && <span className="ml-1 text-[var(--fraco)]">calculando...</span>}</div>
        <p className="mt-1 text-xs text-[var(--fraco)]">
          Só componente direta, no plano de trabalho ({fmt(amb.alturaPlano, 2)} m). Lei do inverso do quadrado e do cosseno. O mapa aparece na planta.
        </p>
      </div>
      <Aviso compacto />
      {erro ? <div className="rounded-lg border border-white/10 p-3 text-sm text-amber-200">{erro}</div> : r && <Resumo r={r} alvo={alvoDoAmbiente(amb)} />}
      <EscalaCores />
      <ConfigGrade amb={amb} />
      <p className="text-xs text-[var(--fraco)]">
        Sem inter-reflexão: o ponto a ponto costuma dar menos que o método dos lúmens, que já inclui a luz refletida pelo FU. Use os dois juntos para ler o
        ambiente.
      </p>
    </div>
  );
}

export function PainelP2PV() {
  const { amb, calculando, erro } = useP2P("v");
  const set = useEditor((s) => s.set);
  if (!amb) return null;
  const r = amb.calculos.p2pV;
  return (
    <div className="grid gap-4 p-4">
      <div>
        <div className="rotulo-secao">Ponto a ponto vertical {calculando && <span className="ml-1 text-[var(--fraco)]">calculando...</span>}</div>
        <p className="mt-1 text-xs text-[var(--fraco)]">Iluminância numa parede (útil para rasante, quadro e destaque), do piso ao teto.</p>
      </div>
      <Aviso compacto />
      <div className="grid gap-2">
        <label className="campo">
          <span>Parede do plano</span>
          <select
            className="entrada"
            value={amb.planta.paredes.findIndex((p) => amb.p2p.planoVertical && dist(p.a, amb.p2p.planoVertical.a) < 1e-6 && dist(p.b, amb.p2p.planoVertical.b) < 1e-6)}
            onChange={(e) => {
              const p = amb.planta.paredes[+e.target.value];
              if (p) mudarAmbiente((a) => (a.p2p.planoVertical = { a: p.a, b: p.b }));
            }}
          >
            <option value={-1}>{amb.p2p.planoVertical ? "Segmento desenhado" : "Escolha..."}</option>
            {amb.planta.paredes.map((p, i) => (
              <option key={p.id} value={i}>
                Parede {i + 1} ({fmt(dist(p.a, p.b), 2)} m)
              </option>
            ))}
          </select>
        </label>
        <button className="botao" onClick={() => set({ ferramenta: "plano_vertical", vista: "planta" })}>
          Escolher parede ou desenhar segmento no quadro
        </button>
      </div>
      {erro ? (
        <div className="rounded-lg border border-white/10 p-3 text-sm text-amber-200">{erro}</div>
      ) : (
        r && (
          <>
            <MapaVertical r={r} />
            <Resumo r={r} alvo={null} />
          </>
        )
      )}
      <EscalaCores />
      <ConfigGrade amb={amb} />
    </div>
  );
}

/** Elevação da parede com o mapa de cores falsas. */
export function MapaVertical({ r, largura = 320 }: { r: ResultadoP2P; largura?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const L = r.plano ? dist(r.plano.a, r.plano.b) : 1;
  const H = r.plano?.altura ?? 1;
  const alt = Math.round((largura * H) / L);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    desenharMapaVertical(cv, r, largura, Math.min(400, alt));
  }, [r, largura, alt]);
  return <canvas ref={ref} className="w-full rounded-lg border border-[var(--borda)]" style={{ aspectRatio: `${largura} / ${Math.min(400, alt)}` }} />;
}

export function desenharMapaVertical(cv: HTMLCanvasElement, r: ResultadoP2P, W: number, Hpx: number, dpr = 2) {
  cv.width = W * dpr;
  cv.height = Hpx * dpr;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0b111d";
  ctx.fillRect(0, 0, W, Hpx);
  const g = r.grade;
  const L = r.plano ? dist(r.plano.a, r.plano.b) : 1;
  const H = r.plano?.altura ?? 1;
  const sx = W / L;
  const sy = Hpx / H;
  const img = document.createElement("canvas");
  img.width = g.nx;
  img.height = g.ny;
  const ictx = img.getContext("2d")!;
  const d = ictx.createImageData(g.nx, g.ny);
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++) {
      const v = g.valores[j * g.nx + i];
      const k = ((g.ny - 1 - j) * g.nx + i) * 4;
      if (!Number.isFinite(v)) continue;
      const [rr, gg, bb] = corFalsa(v);
      d.data[k] = rr;
      d.data[k + 1] = gg;
      d.data[k + 2] = bb;
      d.data[k + 3] = 255;
    }
  ictx.putImageData(d, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const x0 = (g.x0 - g.passo / 2) * sx;
  const y0 = Hpx - (g.y0 + (g.ny - 0.5) * g.passo) * sy;
  ctx.drawImage(img, x0, y0, g.nx * g.passo * sx, g.ny * g.passo * sy);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.strokeRect(0.5, 0.5, W - 1, Hpx - 1);
  if (g.passo * sx >= 26) {
    ctx.font = '700 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(10,14,24,0.9)";
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        const v = g.valores[j * g.nx + i];
        if (!Number.isFinite(v)) continue;
        ctx.fillText(fmt(v), (g.x0 + i * g.passo) * sx, Hpx - (g.y0 + j * g.passo) * sy);
      }
  }
}

// ---------- NBR ----------

export function PainelNBR() {
  const amb = useAmbiente();
  if (!amb) return null;
  const tip = tipologia(amb.tipologiaId);
  const alvo = alvoDoAmbiente(amb);
  const l = amb.calculos.lumens;
  const ph = amb.calculos.p2pH;
  return (
    <div className="grid gap-4 p-4">
      <div>
        <div className="rotulo-secao">Comparação com o alvo de referência</div>
        <p className="mt-1 text-xs text-[var(--fraco)]">{TEXTO_NBR}</p>
      </div>
      <ConfigAmbiente amb={amb} />
      <div className="rounded-xl border border-[var(--borda)] bg-black/20 p-3">
        <Linha r="Tipologia" v={tip.nome} />
        <Linha r="Uso" v={tip.uso} />
        <Linha r={amb.alvoLx != null ? "Alvo do projeto" : "E_alvo (tabela)"} v={`${fmt(alvo)} lx`} />
        <Linha r="UGRL máx. (referência)" v={tip.ugrlMax != null ? tip.ugrlMax : "não aplicável"} dica="Informativo: o app não calcula UGR" />
        <Linha r="R_a mín. (referência)" v={tip.raMin} dica="Informativo: o app não calcula IRC" />
        <div className="mt-2 grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>Método dos lúmens: {l ? `${fmt(l.Emed)} lx` : "abra a aba M. Lúmens"}</span>
            {l && <ChipStatus E={l.Emed} alvo={alvo} />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Ponto a ponto (horizontal): {ph ? `${fmt(ph.Emed)} lx` : "abra a aba P2P horiz."}</span>
            {ph && <ChipStatus E={ph.Emed} alvo={alvo} />}
          </div>
        </div>
      </div>
      {escalaPendente(amb) && <div className="text-sm text-amber-200">Escala do fundo pendente: os cálculos ficam bloqueados até validar.</div>}
      <p className="text-xs text-[var(--fraco)]">
        Faixas: abaixo do alvo a partir de 10% a menos; na faixa entre -10% e +20%; acima do alvo além de +20% (alerta de possível excesso, não é erro). Área
        do ambiente: {fmt(areaAmbiente(amb), 2)} m².
      </p>
      <Aviso />
    </div>
  );
}
