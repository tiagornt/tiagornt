"use client";

import { useRef } from "react";
import { AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Copy, Paintbrush, Trash2 } from "lucide-react";
import { alinhar, apagarSelecao, copiarPropriedades, distribuir, duplicarSelecao } from "@/lib/acoes";
import { cssDoCCT } from "@/lib/cor";
import { dist } from "@/lib/geometria";
import { fmt } from "@/lib/calculo/lumens";
import { CCT_PRESETS, PRESETS } from "@/lib/presets";
import { mudarVista, useEditor, useVista, useAmbiente } from "@/lib/store";
import { NOME_NATUREZA, NATUREZAS, type Fonte, type Natureza, type Vista } from "@/lib/tipos";
import { CampoNumero, Deslizante } from "../ui";
import { LegendaPainel } from "./Legenda";
import { ResultadoLuminaria } from "./ResultadoLuminaria";

const GRADIENTE_CCT = `linear-gradient(90deg, ${[1800, 2700, 3000, 4000, 5000, 6500].map((k) => cssDoCCT(k)).join(", ")})`;

export function PainelPropriedades() {
  const selecao = useEditor((s) => s.selecao);
  const vista = useVista();
  const amb = useAmbiente();
  if (!vista || !amb) return null;
  const fontes = vista.fontes.filter((f) => selecao.some((s) => s.id === f.id));
  const outros = selecao.filter((s) => s.tipo !== "fonte");

  if (!selecao.length)
    return (
      <div className="grid gap-4 p-4">
        <div>
          <div className="rotulo-secao">Nada selecionado</div>
          <p className="mt-1 text-sm text-[var(--fraco)]">
            Clique numa fonte, parede, vão ou linha para ajustar. Arraste no vazio para selecionar várias. Shift + clique soma à seleção.
          </p>
        </div>
        <LegendaPainel />
        <Atalhos />
      </div>
    );

  return (
    <div className="grid gap-4 p-4">
      {fontes.length === 1 && outros.length === 0 && <PropFonte f={fontes[0]} vista={vista} />}
      {fontes.length > 1 && <PropVariasFontes fontes={fontes} />}
      {outros.length === 1 && fontes.length === 0 && <PropOutro tipo={outros[0].tipo} id={outros[0].id} vista={vista} />}
      {outros.length + fontes.length > 1 && fontes.length !== selecao.length && (
        <p className="text-sm text-[var(--fraco)]">{selecao.length} itens selecionados.</p>
      )}
      <div className="flex gap-2">
        <button className="botao flex-1" onClick={() => duplicarSelecao()} title="Duplicar (Ctrl+D)">
          <Copy size={15} /> Duplicar
        </button>
        <button className="botao flex-1" onClick={apagarSelecao} title="Apagar (Delete)">
          <Trash2 size={15} /> Apagar
        </button>
      </div>
      {amb && <span className="sr-only">{amb.nome}</span>}
    </div>
  );
}

function Atalhos() {
  const linhas: [string, string][] = [
    ["V", "Selecionar"],
    ["Espaço + arrastar", "Mover o quadro"],
    ["Roda do mouse", "Zoom"],
    ["R", "Retângulo (digite 4x5 e Enter)"],
    ["W", "Parede (digite a medida e Enter)"],
    ["P / J", "Porta / janela"],
    ["L", "Limite de croqui (gera sombra)"],
    ["C / T / M", "Cota / texto / medir"],
    ["1 a 4", "Facho, linear dir., linha difusa, difusa"],
    ["Ctrl+Z / Ctrl+Y", "Desfazer / refazer"],
    ["Ctrl+D / Delete", "Duplicar / apagar"],
    ["Setas", "Mover 5 cm (Shift: 50 cm)"],
    ["Alt", "Desliga o encaixe ao arrastar"],
    ["F", "Enquadrar o desenho"],
  ];
  return (
    <div>
      <div className="rotulo-secao">Atalhos</div>
      <table className="mt-1 w-full text-xs">
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k}>
              <td className="py-0.5 pr-2 font-mono text-[var(--marca)]">{k}</td>
              <td className="py-0.5 text-[var(--fraco)]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Muda uma fonte (e, se pedido, todas do mesmo código). */
function mudarFonte(id: string, fn: (f: Fonte) => void, todasDoCodigo: boolean, historico = true) {
  mudarVista((v) => {
    const alvo = v.fontes.find((f) => f.id === id);
    if (!alvo) return;
    const lista = todasDoCodigo ? v.fontes.filter((f) => f.codigo === alvo.codigo) : [alvo];
    for (const f of lista) fn(f);
  }, historico);
}

function PropFonte({ f, vista }: { f: Fonte; vista: Vista }) {
  const nomeVista = useEditor((s) => s.vista);
  const amb = useAmbiente();
  const mesmas = vista.fontes.filter((x) => x.codigo === f.codigo).length;
  const todas = useEditor((s) => s.presetPorNatureza["__todas"] !== "nao");
  const juntas = todas && mesmas > 1;
  const m = (fn: (x: Fonte) => void, hist = true) => mudarFonte(f.id, fn, juntas, hist);
  const mSo = (fn: (x: Fonte) => void, hist = true) => mudarFonte(f.id, fn, false, hist);
  const linear = f.natureza === "linear_dirigido" || f.natureza === "linha_difusa";
  const marcadorHist = useRef(false);

  // arrasto do controle deslizante: uma entrada só no histórico por gesto
  const deslizar = (fn: (x: Fonte) => void, final: boolean, soEsta = false) => {
    if (!marcadorHist.current) {
      useEditor.getState().marcarHistorico();
      marcadorHist.current = true;
    }
    (soEsta ? mSo : m)(fn, false);
    if (final) marcadorHist.current = false;
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: cssDoCCT(f.cct) }} />
        <span className="font-semibold">{f.codigo}</span>
        <span className="text-sm text-[var(--fraco)]">· {NOME_NATUREZA[f.natureza]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="pilula">{f.codigo}</span>
        <span className="pilula">{Math.round(f.cct)} K</span>
        <span className="pilula">{Math.round(f.intensidadePct)} %</span>
        <span className="pilula">{fmt(nomeVista === "corte" ? f.y : f.altura, 2)} m</span>
      </div>
      {amb && <ResultadoLuminaria f={f} amb={amb} vista={vista} />}
      {mesmas > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={todas}
            onChange={(e) =>
              useEditor.getState().set({ presetPorNatureza: { ...useEditor.getState().presetPorNatureza, __todas: e.target.checked ? "sim" : "nao" } })
            }
          />
          Editar as {mesmas} peças {f.codigo} juntas
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="campo">
          <span>Código</span>
          <input
            key={f.codigo}
            defaultValue={f.codigo}
            onBlur={(e) => {
              const c = e.target.value.trim().toUpperCase();
              if (c && c !== f.codigo) m((x) => (x.codigo = c));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </label>
        <label className="campo">
          <span>Natureza</span>
          <select className="entrada" value={f.natureza} onChange={(e) => m((x) => (x.natureza = e.target.value as Natureza))}>
            {NATUREZAS.map((n) => (
              <option key={n} value={n}>
                {NOME_NATUREZA[n]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Deslizante
        rotulo="Temperatura de cor"
        valor={Math.round(f.cct)}
        min={1800}
        max={6500}
        passo={50}
        unidade="K"
        fundo={GRADIENTE_CCT}
        aoMudar={(v, fim) => deslizar((x) => (x.cct = v), fim)}
      />
      <div className="flex flex-wrap gap-1">
        {CCT_PRESETS.map((k) => (
          <button key={k} className={`chip ${Math.round(f.cct) === k ? "chip-ativo" : ""}`} onClick={() => m((x) => (x.cct = k))}>
            {k} K
          </button>
        ))}
      </div>
      <Deslizante rotulo="Intensidade (croqui)" valor={Math.round(f.intensidadePct)} min={0} max={100} unidade="%" aoMudar={(v, fim) => deslizar((x) => (x.intensidadePct = v), fim)} />
      <div className="grid grid-cols-2 gap-2">
        {nomeVista === "planta" ? (
          <CampoNumero rotulo="Altura de montagem" unidade="m" valor={f.altura} min={0} max={30} aoMudar={(v) => m((x) => (x.altura = v ?? x.altura))} />
        ) : (
          <CampoNumero rotulo="Altura (no corte)" unidade="m" valor={f.y} min={0} max={30} aoMudar={(v) => mSo((x) => ((x.y = v ?? x.y), (x.altura = v ?? x.altura)))} />
        )}
        {f.natureza !== "difusa" && <CampoNumero rotulo="Rotação" unidade="°" valor={f.rotacao} casas={0} aoMudar={(v) => mSo((x) => (x.rotacao = v ?? 0))} />}
        {(f.natureza === "facho" || f.natureza === "linear_dirigido") && (
          <CampoNumero rotulo="Abertura do facho" unidade="°" valor={f.abertura} casas={0} min={2} max={178} aoMudar={(v) => m((x) => (x.abertura = v ?? x.abertura))} />
        )}
        {(f.natureza === "facho" || f.natureza === "linear_dirigido") && nomeVista === "planta" && (
          <CampoNumero
            rotulo="Inclinação (tilt)"
            unidade="°"
            valor={f.tilt}
            casas={0}
            min={0}
            max={85}
            dica="0° = apontado para baixo. Aumente para mirar parede, quadro ou objeto."
            aoMudar={(v) => m((x) => (x.tilt = v ?? 0))}
          />
        )}
        {linear && <CampoNumero rotulo="Comprimento" unidade="m" valor={f.comprimento} min={0.1} max={50} aoMudar={(v) => m((x) => (x.comprimento = v ?? x.comprimento))} />}
      </div>
      <div className="rounded-lg border border-[var(--borda)] p-3">
        <div className="rotulo-secao mb-2">Dados para o cálculo</div>
        <div className="grid grid-cols-2 gap-2">
          <CampoNumero
            rotulo={linear ? "Fluxo total" : "Fluxo luminoso"}
            unidade="lm"
            casas={0}
            vazio
            valor={f.fluxo}
            aoMudar={(v) => m((x) => ((x.fluxo = v), (x.valorTipico = false)))}
          />
          {linear && (
            <CampoNumero
              rotulo="Fluxo por metro"
              unidade="lm/m"
              casas={0}
              vazio
              valor={f.fluxo != null ? Math.round(f.fluxo / Math.max(0.01, f.comprimento)) : null}
              aoMudar={(v) => m((x) => ((x.fluxo = v == null ? null : Math.round(v * x.comprimento)), (x.valorTipico = false)))}
            />
          )}
          <CampoNumero
            rotulo="Intensidade de pico"
            unidade="cd"
            casas={0}
            vazio
            valor={f.intensidadeCd}
            dica="Opcional. Se vazio, o ponto a ponto estima pelo fluxo e pela abertura."
            aoMudar={(v) => m((x) => (x.intensidadeCd = v))}
          />
          <CampoNumero rotulo="Potência" unidade="W" casas={1} vazio valor={f.potencia} aoMudar={(v) => m((x) => (x.potencia = v))} />
        </div>
        {f.valorTipico && f.fluxo != null && (
          <p className="mt-2 text-xs text-amber-300">
            Valor típico da biblioteca, confirme com a ficha da luminária.{" "}
            <button className="underline" onClick={() => m((x) => (x.valorTipico = false))}>
              Confirmar
            </button>
          </p>
        )}
        {f.fluxo == null && f.intensidadeCd == null && <p className="mt-2 text-xs text-amber-300">Sem fluxo nem intensidade: esta fonte fica fora do cálculo.</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.visivel} onChange={(e) => mSo((x) => (x.visivel = e.target.checked))} />
        Visível no croqui e no cálculo
      </label>
      <label className="campo">
        <span>Trocar pelo preset</span>
        <select
          className="entrada"
          value=""
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value);
            if (!p) return;
            m((x) => {
              Object.assign(x, {
                natureza: p.natureza,
                cct: p.cct,
                fluxo: p.fluxo,
                potencia: p.potencia,
                abertura: p.abertura,
                comprimento: p.comprimento || x.comprimento,
                tilt: p.tilt,
                intensidadePct: p.intensidadePct,
                presetId: p.id,
                valorTipico: true,
                intensidadeCd: null,
              });
            });
          }}
        >
          <option value="">Escolha um preset...</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PropVariasFontes({ fontes }: { fontes: Fonte[] }) {
  return (
    <div className="grid gap-3">
      <div className="font-semibold">{fontes.length} fontes selecionadas</div>
      <div className="grid grid-cols-2 gap-2">
        <button className="botao" onClick={() => alinhar("y")} title="Alinha na mesma linha horizontal">
          <AlignVerticalJustifyCenter size={15} /> Alinhar linha
        </button>
        <button className="botao" onClick={() => alinhar("x")} title="Alinha na mesma coluna">
          <AlignHorizontalJustifyCenter size={15} /> Alinhar coluna
        </button>
        <button className="botao" onClick={() => distribuir("x")} disabled={fontes.length < 3}>
          Distribuir ↔
        </button>
        <button className="botao" onClick={() => distribuir("y")} disabled={fontes.length < 3}>
          Distribuir ↕
        </button>
      </div>
      <button className="botao" onClick={copiarPropriedades} title="Copia CCT e intensidade da primeira selecionada">
        <Paintbrush size={15} /> Copiar CCT e intensidade da {fontes[0].codigo}
      </button>
      <Deslizante
        rotulo="Temperatura de cor (todas)"
        valor={Math.round(fontes[0].cct)}
        min={1800}
        max={6500}
        passo={50}
        unidade="K"
        fundo={GRADIENTE_CCT}
        aoMudar={(v, fim) => {
          const ids = new Set(fontes.map((f) => f.id));
          mudarVista((vv) => vv.fontes.forEach((f) => ids.has(f.id) && (f.cct = v)), fim);
        }}
      />
      <Deslizante
        rotulo="Intensidade (todas)"
        valor={Math.round(fontes[0].intensidadePct)}
        min={0}
        max={100}
        unidade="%"
        aoMudar={(v, fim) => {
          const ids = new Set(fontes.map((f) => f.id));
          mudarVista((vv) => vv.fontes.forEach((f) => ids.has(f.id) && (f.intensidadePct = v)), fim);
        }}
      />
    </div>
  );
}

function PropOutro({ tipo, id, vista }: { tipo: string; id: string; vista: Vista }) {
  if (tipo === "parede") {
    const p = vista.paredes.find((x) => x.id === id);
    if (!p) return null;
    const L = dist(p.a, p.b);
    return (
      <div className="grid gap-3">
        <div className="font-semibold">Parede</div>
        <div className="grid grid-cols-2 gap-2">
          <CampoNumero
            rotulo="Comprimento"
            unidade="m"
            valor={L}
            min={0.05}
            aoMudar={(v) => {
              if (!v) return;
              mudarVista((vv) => {
                const w = vv.paredes.find((x) => x.id === id)!;
                const k = v / L;
                const nb = { x: w.a.x + (w.b.x - w.a.x) * k, y: w.a.y + (w.b.y - w.a.y) * k };
                // leva junto as pontas ligadas
                for (const o of vv.paredes) {
                  if (o.id === id) continue;
                  if (dist(o.a, w.b) < 0.02) o.a = nb;
                  if (dist(o.b, w.b) < 0.02) o.b = nb;
                }
                w.b = nb;
              });
            }}
          />
          <CampoNumero rotulo="Espessura" unidade="m" valor={p.espessura} min={0.02} max={1} aoMudar={(v) => mudarVista((vv) => (vv.paredes.find((x) => x.id === id)!.espessura = v ?? 0.15))} />
        </div>
        <label className="campo">
          <span>Espessura cresce para</span>
          <select className="entrada" value={p.lado} onChange={(e) => mudarVista((vv) => (vv.paredes.find((x) => x.id === id)!.lado = e.target.value as "centro"))}>
            <option value="centro">Os dois lados (eixo)</option>
            <option value="direita">Direita</option>
            <option value="esquerda">Esquerda</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.bloqueia} onChange={(e) => mudarVista((vv) => (vv.paredes.find((x) => x.id === id)!.bloqueia = e.target.checked))} />
          Bloqueia a luz (gera sombra)
        </label>
        <p className="text-xs text-[var(--fraco)]">Arraste as pontas para mudar o desenho. As paredes ligadas acompanham.</p>
      </div>
    );
  }
  if (tipo === "abertura") {
    const ab = vista.aberturas.find((x) => x.id === id);
    if (!ab) return null;
    type Ab = NonNullable<typeof ab>;
    const muda = (fn: (a: Ab) => void) =>
      mudarVista((vv) => {
        const x = vv.aberturas.find((y) => y.id === id);
        if (x) fn(x);
      });
    return (
      <div className="grid gap-3">
        <div className="font-semibold">{ab.tipo === "porta" ? "Porta" : "Janela"}</div>
        <div className="grid grid-cols-2 gap-2">
          <CampoNumero rotulo="Largura" unidade="m" valor={ab.largura} min={0.2} max={10} aoMudar={(v) => muda((a) => (a.largura = v ?? a.largura))} />
          <CampoNumero rotulo="Altura do vão" unidade="m" valor={ab.altura} min={0.2} max={6} aoMudar={(v) => muda((a) => (a.altura = v ?? a.altura))} />
          {ab.tipo === "janela" && <CampoNumero rotulo="Peitoril" unidade="m" valor={ab.peitoril} min={0} max={4} aoMudar={(v) => muda((a) => (a.peitoril = v ?? a.peitoril))} />}
        </div>
        {ab.tipo === "porta" && (
          <div className="flex gap-2">
            <button className="botao flex-1" onClick={() => muda((a) => (a.inverter = !a.inverter))}>
              Inverter dobradiça
            </button>
            <button className="botao flex-1" onClick={() => muda((a) => (a.abreParaDentro = a.abreParaDentro === false))}>
              Inverter abertura
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--fraco)]">Vãos não bloqueiam a luz no croqui. Arraste para deslizar ao longo da parede.</p>
      </div>
    );
  }
  if (tipo === "linha") {
    const l = vista.linhas.find((x) => x.id === id);
    if (!l) return null;
    return (
      <div className="grid gap-3">
        <div className="font-semibold">{l.tipo === "limite" ? "Limite de croqui" : "Linha de referência"}</div>
        <div className="text-sm text-[var(--fraco)]">Comprimento: {fmt(dist(l.a, l.b), 2)} m</div>
        <label className="campo">
          <span>Tipo</span>
          <select className="entrada" value={l.tipo} onChange={(e) => mudarVista((vv) => (vv.linhas.find((x) => x.id === id)!.tipo = e.target.value as "limite"))}>
            <option value="limite">Limite (bloqueia a luz, gera sombra)</option>
            <option value="referencia">Referência (móvel, bancada, sanca: só desenho)</option>
          </select>
        </label>
      </div>
    );
  }
  if (tipo === "cota") {
    const k = vista.cotas.find((x) => x.id === id);
    if (!k) return null;
    return (
      <div className="grid gap-3">
        <div className="font-semibold">Cota</div>
        <div className="text-sm">{fmt(dist(k.a, k.b), 2)} m</div>
        <CampoNumero rotulo="Afastamento" unidade="m" valor={k.offset} min={-5} max={5} aoMudar={(v) => mudarVista((vv) => (vv.cotas.find((x) => x.id === id)!.offset = v ?? 0.35))} />
      </div>
    );
  }
  if (tipo === "texto") {
    const t = vista.textos.find((x) => x.id === id);
    if (!t) return null;
    return (
      <div className="grid gap-3">
        <div className="font-semibold">Texto</div>
        <label className="campo">
          <span>Conteúdo</span>
          <input key={t.texto} defaultValue={t.texto} onBlur={(e) => mudarVista((vv) => (vv.textos.find((x) => x.id === id)!.texto = e.target.value))} />
        </label>
        <CampoNumero rotulo="Tamanho" unidade="m" valor={t.tamanho} min={0.05} max={3} aoMudar={(v) => mudarVista((vv) => (vv.textos.find((x) => x.id === id)!.tamanho = v ?? 0.22))} />
      </div>
    );
  }
  return null;
}
