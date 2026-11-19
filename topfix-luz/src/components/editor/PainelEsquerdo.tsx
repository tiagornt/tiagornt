"use client";

import { useState } from "react";
import { Download, FileImage, FileUp, Image as ImageIcon, Lock, Ruler, Trash2, Unlock, Wand2 } from "lucide-react";
import { criarRetangulo, trazerFontesParaCorte } from "@/lib/acoes";
import { cssDoCCT } from "@/lib/cor";
import { fmt } from "@/lib/calculo/lumens";
import { calculosAtualizados, exportarPdf, exportarPngLuzes, exportarPngPlanta } from "@/lib/exportar";
import { lerDxf, LIMITE_BYTES, type DxfLido } from "@/lib/importacao/dxf";
import { imagemComoFundo, LIMITE_FUNDO, paginaPdfComoImagem, quantasPaginasPdf, tipoReal } from "@/lib/importacao/fundo";
import { PADRAO_NATUREZA, PRESETS } from "@/lib/presets";
import { ambienteAtual, mudarAmbiente, mudarVista, useAmbiente, useEditor, useVista, type Camadas } from "@/lib/store";
import { NATUREZAS, NOME_NATUREZA, type Natureza } from "@/lib/tipos";
import { areaAmbiente, escalaPendente } from "@/lib/ambiente";
import { Dialogo, Secao } from "../ui";
import { DialogoDxf } from "./DialogoDxf";
import { IconeNatureza } from "./Icones";

export function PainelEsquerdo() {
  const amb = useAmbiente();
  const vista = useVista();
  const nomeVista = useEditor((s) => s.vista);
  const set = useEditor((s) => s.set);
  if (!amb || !vista) return null;
  return (
    <div className="flex flex-col">
      <Secao titulo="Croqui">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
          {(["planta", "corte"] as const).map((v) => (
            <button key={v} className={`aba-vista ${nomeVista === v ? "aba-vista-ativa" : ""}`} onClick={() => set({ vista: v, selecao: [] })}>
              {v === "planta" ? "PLANTA" : "CORTE"}
            </button>
          ))}
        </div>
        <label className="campo mt-2">
          <span>Nome do ambiente</span>
          <input key={amb.id + amb.nome} defaultValue={amb.nome} onBlur={(e) => e.target.value.trim() && mudarAmbiente((a) => (a.nome = e.target.value.trim()))} />
        </label>
        {nomeVista === "planta" && (
          <p className="mt-2 text-xs text-[var(--fraco)]">
            Área: <b className="text-white">{fmt(areaAmbiente(amb), 2)} m²</b> · pé-direito {fmt(amb.peDireito, 2)} m
          </p>
        )}
        {nomeVista === "corte" && <OpcoesCorte />}
      </Secao>
      <Base />
      <Fontes />
      <SecaoCamadas />
      <Exportar />
    </div>
  );
}

function OpcoesCorte() {
  const amb = useAmbiente()!;
  return (
    <div className="mt-2 grid gap-2">
      <button
        className="botao"
        disabled={!amb.corte.linhaCorte}
        onClick={() => {
          const n = trazerFontesParaCorte();
          useEditor.getState().avisar(n ? `${n} fontes trazidas da planta (até 1,5 m da linha de corte).` : "Nenhuma fonte da planta perto da linha de corte.");
        }}
      >
        Trazer fontes da planta
      </button>
      <button className="botao" onClick={() => useEditor.getState().set({ vista: "planta", ferramenta: "linha_corte" })}>
        Refazer linha de corte na planta
      </button>
    </div>
  );
}

function Base() {
  const amb = useAmbiente()!;
  const vista = useVista()!;
  const nomeVista = useEditor((s) => s.vista);
  const set = useEditor((s) => s.set);
  const [w, setW] = useState("4");
  const [h, setH] = useState("5");
  const [dxf, setDxf] = useState<{ lido: DxfLido; nome: string } | null>(null);
  const [pdf, setPdf] = useState<{ arquivo: File; paginas: number; pagina: number } | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const avisar = useEditor((s) => s.avisar);

  async function arquivoCad(f: File | undefined) {
    if (!f) return;
    if (f.size > LIMITE_BYTES) return avisar("Arquivo acima de 15 MB. Limpe o desenho no CAD e tente de novo.", "erro");
    const tipo = await tipoReal(f);
    if (tipo === "dwg" || /\.dwg$/i.test(f.name)) {
      avisar("DWG ainda não é convertido aqui. No AutoCAD, use Salvar como > DXF e importe o DXF.", "erro");
      return;
    }
    try {
      setCarregando("Lendo DXF...");
      const texto = await f.text();
      const lido = lerDxf(texto);
      setDxf({ lido, nome: f.name });
    } catch (e) {
      avisar((e as Error).message || "Não foi possível ler o DXF.", "erro");
    } finally {
      setCarregando(null);
    }
  }

  async function arquivoFundo(f: File | undefined, pagina = 1) {
    if (!f) return;
    if (f.size > LIMITE_FUNDO) return avisar("Arquivo acima de 15 MB.", "erro");
    const tipo = await tipoReal(f);
    if (!tipo || tipo === "dxf" || tipo === "dwg") return avisar("Use PDF, PNG, JPG ou WEBP.", "erro");
    try {
      setCarregando(tipo === "pdf" ? "Rasterizando o PDF..." : "Carregando imagem...");
      if (tipo === "pdf" && !pdf) {
        const n = await quantasPaginasPdf(f);
        if (n > 1) {
          setPdf({ arquivo: f, paginas: n, pagina: 1 });
          setCarregando(null);
          return;
        }
      }
      const img = tipo === "pdf" ? await paginaPdfComoImagem(f, pagina) : await imagemComoFundo(f);
      // escala inicial provisória: lado maior = 15 m; a calibração ajusta
      const escala = 15 / Math.max(img.w, img.h);
      mudarVista((v) => {
        v.fundo = {
          tipo: tipo === "pdf" ? "pdf" : "imagem",
          nomeArquivo: f.name,
          opacidade: 0.6,
          travado: true,
          visivel: true,
          validadoEm: null,
          imagem: { dataUrl: img.dataUrl, larguraPx: img.w, alturaPx: img.h, escala, x: 0, y: img.h * escala, rotacao: 0, paginaPdf: tipo === "pdf" ? pagina : undefined },
          calibracao: null,
        };
      });
      set({ ferramenta: "calibrar", pedidoEnquadrar: useEditor.getState().pedidoEnquadrar + 1 });
      avisar("Calibre a escala: clique nas duas pontas de uma medida conhecida.");
    } catch (e) {
      avisar((e as Error).message || "Não foi possível abrir o arquivo.", "erro");
    } finally {
      setCarregando(null);
      setPdf(null);
    }
  }

  const fundo = vista.fundo;
  return (
    <Secao titulo="Base">
      <input id="entrada-cad" type="file" accept=".dxf,.dwg" className="hidden" onChange={(e) => (arquivoCad(e.target.files?.[0]), (e.target.value = ""))} />
      <input
        id="entrada-fundo"
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => (arquivoFundo(e.target.files?.[0]), (e.target.value = ""))}
      />
      {nomeVista === "planta" && (
        <div className="grid gap-2">
          <div className="flex items-end gap-1">
            <label className="campo flex-1">
              <span>Largura (m)</span>
              <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
            </label>
            <span className="pb-2 text-[var(--fraco)]">×</span>
            <label className="campo flex-1">
              <span>Comprimento (m)</span>
              <input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
            </label>
          </div>
          <button className="botao" onClick={() => criarRetangulo(parseFloat(w.replace(",", ".")), parseFloat(h.replace(",", ".")))}>
            Criar ambiente retangular
          </button>
          <button className="botao botao-tracejado" onClick={() => document.getElementById("entrada-cad")?.click()}>
            <FileUp size={15} /> Importar planta CAD (DXF)
          </button>
          <button className="botao botao-tracejado" onClick={() => document.getElementById("entrada-fundo")?.click()}>
            <FileImage size={15} /> PDF ou imagem como fundo
          </button>
        </div>
      )}
      {carregando && <p className="mt-2 text-xs text-[var(--marca)]">{carregando}</p>}
      {fundo && (
        <div className="mt-3 grid gap-2 rounded-lg border border-[var(--borda)] p-2">
          <div className="flex items-center gap-2 text-xs">
            <ImageIcon size={14} />
            <span className="flex-1 truncate" title={fundo.nomeArquivo}>
              {fundo.nomeArquivo}
            </span>
            <button className="icone" title={fundo.travado ? "Destravar" : "Travar"} onClick={() => mudarVista((v) => v.fundo && (v.fundo.travado = !v.fundo.travado))}>
              {fundo.travado ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            <button
              className="icone"
              title="Remover fundo"
              onClick={() => confirm("Remover o fundo deste ambiente? As paredes desenhadas ficam.") && mudarVista((v) => (v.fundo = null))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {escalaPendente(amb) && nomeVista === "planta" ? (
            <div className="rounded bg-amber-500/15 p-2 text-xs text-amber-200">Escala pendente: os cálculos ficam bloqueados até calibrar.</div>
          ) : (
            <div className="text-xs text-emerald-300">Escala validada{fundo.unidadeOrigem ? ` (${fundo.unidadeOrigem})` : ""}.</div>
          )}
          <label className="campo">
            <span>Opacidade {Math.round(fundo.opacidade * 100)}%</span>
            <input
              type="range"
              className="deslizante"
              min={0.1}
              max={1}
              step={0.05}
              value={fundo.opacidade}
              onChange={(e) => mudarVista((v) => v.fundo && (v.fundo.opacidade = +e.target.value), false)}
            />
          </label>
          {!fundo.travado && (
            <div className="rounded bg-sky-500/10 p-2 text-xs text-sky-200">
              Fundo destravado: com a seta, arraste num espaço vazio do quadro para posicionar. Trave de novo antes de decalcar.
            </div>
          )}
          {fundo.imagem && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-[var(--fraco)]">Girar</span>
              {[-90, -1, 1, 90].map((g) => (
                <button key={g} className="chip px-1.5 text-[11px]" onClick={() => mudarVista((v) => v.fundo?.imagem && (v.fundo.imagem.rotacao = (v.fundo.imagem.rotacao + g) % 360))}>
                  {g > 0 ? "+" : ""}
                  {g}°
                </button>
              ))}
              <span className="ml-auto text-[var(--fraco)]">{fundo.imagem.rotacao}°</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <button className="botao" onClick={() => set({ ferramenta: "calibrar" })} title="Clique em duas pontas e informe a medida real">
              <Ruler size={14} /> Calibrar
            </button>
            {fundo.tipo === "dxf" ? (
              <button className="botao" onClick={() => set({ ferramenta: "promover" })} title="Clique numa linha do DXF para virar parede. Shift + clique: a polilinha inteira.">
                <Wand2 size={14} /> Promover a parede
              </button>
            ) : (
              <button className="botao" onClick={() => set({ ferramenta: "parede" })} title="Decalque as paredes por cima do fundo">
                Decalcar paredes
              </button>
            )}
          </div>
          {fundo.tipo === "dxf" && fundo.camadas && (
            <details>
              <summary className="cursor-pointer text-xs text-[var(--fraco)]">Camadas do DXF ({fundo.camadas.length})</summary>
              <div className="mt-1 max-h-40 overflow-auto text-xs">
                {fundo.camadas.map((c, i) => (
                  <label key={c.nome} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={c.visivel} onChange={(e) => mudarVista((v) => v.fundo?.camadas && (v.fundo.camadas[i].visivel = e.target.checked))} />
                    <span className="flex-1 truncate">{c.nome}</span>
                    <span className="text-[var(--fraco)]">{c.entidades}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {dxf && <DialogoDxf lido={dxf.lido} nomeArquivo={dxf.nome} aoFechar={() => setDxf(null)} />}
      {pdf && (
        <Dialogo titulo="Escolha a página do PDF" aoFechar={() => setPdf(null)}>
          <p className="text-sm text-[var(--fraco)]">O PDF tem {pdf.paginas} páginas. Qual delas tem a planta?</p>
          <input
            type="number"
            className="entrada mt-3 w-full"
            min={1}
            max={pdf.paginas}
            value={pdf.pagina}
            onChange={(e) => setPdf({ ...pdf, pagina: Math.max(1, Math.min(pdf.paginas, +e.target.value || 1)) })}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className="botao" onClick={() => setPdf(null)}>
              Cancelar
            </button>
            <button className="botao botao-marca" onClick={() => arquivoFundo(pdf.arquivo, pdf.pagina)}>
              Usar página {pdf.pagina}
            </button>
          </div>
        </Dialogo>
      )}
    </Secao>
  );
}

function Fontes() {
  const ferramenta = useEditor((s) => s.ferramenta);
  const presetPorNatureza = useEditor((s) => s.presetPorNatureza);
  const set = useEditor((s) => s.set);
  const vista = useVista()!;
  return (
    <Secao titulo="Fontes de luz">
      <p className="mb-2 text-xs text-[var(--fraco)]">Escolha a natureza e clique no quadro. Cada clique coloca uma peça.</p>
      <div className="grid gap-1.5">
        {NATUREZAS.map((n: Natureza) => {
          const presets = PRESETS.filter((p) => p.natureza === n);
          const atual = presetPorNatureza[n] ?? PADRAO_NATUREZA[n];
          return (
            <div key={n} className={`rounded-lg border p-1.5 ${ferramenta === n ? "border-[var(--marca)] bg-[var(--marca)]/10" : "border-[var(--borda)]"}`}>
              <button className="flex w-full items-center gap-2 text-left text-sm" onClick={() => set({ ferramenta: n })}>
                <IconeNatureza n={n} />
                <span className="font-medium">{NOME_NATUREZA[n]}</span>
              </button>
              <select
                className="entrada mt-1 w-full text-xs"
                value={atual}
                onChange={(e) => set({ presetPorNatureza: { ...presetPorNatureza, [n]: e.target.value }, ferramenta: n })}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {vista.fontes.length > 0 && (
        <div className="mt-3">
          <div className="rotulo-secao mb-1">No desenho ({vista.fontes.length})</div>
          <ul className="max-h-48 overflow-auto text-sm">
            {vista.fontes.map((f) => (
              <li key={f.id}>
                <button
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/5"
                  onClick={() => set({ selecao: [{ tipo: "fonte", id: f.id }], ferramenta: "selecionar" })}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: cssDoCCT(f.cct) }} />
                  <span className="font-medium">{f.codigo}</span>
                  <span className="flex-1 truncate text-xs text-[var(--fraco)]">
                    {NOME_NATUREZA[f.natureza]} · {Math.round(f.cct)} K · {Math.round(f.intensidadePct)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Secao>
  );
}

const NOMES_CAMADAS: Record<keyof Camadas, string> = {
  fundo: "Fundo (DXF, PDF, imagem)",
  base: "Base (paredes e linhas)",
  vaos: "Vãos",
  cotas: "Cotas",
  croqui: "Croqui (luzes)",
  calculos: "Cálculos (mapa)",
};

function SecaoCamadas() {
  const camadas = useEditor((s) => s.camadas);
  const set = useEditor((s) => s.set);
  const vista = useVista()!;
  const snapAtivo = useEditor((s) => s.snapAtivo);
  return (
    <Secao titulo="Camadas e encaixe" aberta={false}>
      <div className="grid gap-1 text-sm">
        {(Object.keys(NOMES_CAMADAS) as (keyof Camadas)[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={camadas[k]} onChange={(e) => set({ camadas: { ...camadas, [k]: e.target.checked } })} />
            {NOMES_CAMADAS[k]}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={vista.legendaVisivel} onChange={(e) => mudarVista((v) => (v.legendaVisivel = e.target.checked))} />
          Legenda no quadro
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="checkbox" checked={snapAtivo} onChange={(e) => set({ snapAtivo: e.target.checked })} />
          Encaixe na grade de 5 cm e em 45°
        </label>
      </div>
    </Secao>
  );
}

function Exportar() {
  const projeto = useEditor((s) => s.projeto)!;
  const nomeVista = useEditor((s) => s.vista);
  const amb = useAmbiente()!;
  const [ocupado, setOcupado] = useState(false);
  const [legendaLuzes, setLegendaLuzes] = useState(false);
  const avisar = useEditor((s) => s.avisar);

  /** Atualiza os cálculos gravados antes de exportar. */
  function atualizar() {
    const est = useEditor.getState();
    for (const a of est.projeto!.ambientes) {
      const calc = calculosAtualizados(a);
      est.mudar((d) => {
        const x = d.ambientes.find((y) => y.id === a.id);
        if (x) x.calculos = calc;
      }, false);
    }
    const s = useEditor.getState();
    return { p: s.projeto!, a: ambienteAtual(s)! };
  }

  return (
    <Secao titulo="Exportar">
      <div className="grid gap-1.5">
        <button
          className="botao justify-start"
          onClick={() => {
            const { p, a } = atualizar();
            exportarPngPlanta(p, a, nomeVista, useEditor.getState().aba === "p2ph");
          }}
        >
          <Download size={14} />
          <span className="flex-1 text-left">
            <b>PNG</b> <span className="text-xs text-[var(--fraco)]">imagem completa do croqui</span>
          </span>
        </button>
        <button
          className="botao justify-start"
          onClick={() => {
            const { p, a } = atualizar();
            exportarPngLuzes(p, a, nomeVista, legendaLuzes);
          }}
        >
          <Download size={14} />
          <span className="flex-1 text-left">
            <b>LUZES</b> <span className="text-xs text-[var(--fraco)]">só as manchas, fundo transparente</span>
          </span>
        </button>
        <label className="ml-6 flex items-center gap-2 text-xs text-[var(--fraco)]">
          <input type="checkbox" checked={legendaLuzes} onChange={(e) => setLegendaLuzes(e.target.checked)} /> com legenda
        </label>
        <button
          className="botao justify-start"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              const { p, a } = atualizar();
              await exportarPdf(p, [a]);
            } catch (e) {
              avisar("Falha ao gerar o PDF: " + (e as Error).message, "erro");
            } finally {
              setOcupado(false);
            }
          }}
        >
          <Download size={14} />
          <span className="flex-1 text-left">
            <b>PDF</b> <span className="text-xs text-[var(--fraco)]">{ocupado ? "gerando..." : "A4 paisagem, com legenda e memorial"}</span>
          </span>
        </button>
        {projeto.ambientes.length > 1 && (
          <button
            className="botao justify-start"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              try {
                const { p } = atualizar();
                await exportarPdf(p, p.ambientes);
              } finally {
                setOcupado(false);
              }
            }}
          >
            <Download size={14} /> PDF de todos os ambientes
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--fraco)]">Os arquivos saem com a marca Topfix e o aviso de estimativa. {amb.nome}.</p>
    </Secao>
  );
}
