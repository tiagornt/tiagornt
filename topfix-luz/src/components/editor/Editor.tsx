"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Copy, Loader2, MessageCircle, Moon, PanelLeft, PanelRight, Plus, Sun, Trash2 } from "lucide-react";
import { carregarProjeto, salvarProjeto } from "@/lib/armazenamento";
import { comIdsNovos, novoAmbiente } from "@/lib/fabrica";
import { MARCA } from "@/lib/marca";
import { ambienteAtual, useEditor, type Aba } from "@/lib/store";
import { BarraFerramentas } from "./BarraFerramentas";
import { LegendaQuadro } from "./Legenda";
import { Aviso, EscalaCores, PainelLumens, PainelNBR, PainelP2PH, PainelP2PV } from "./PainelCalculos";
import { PainelEsquerdo } from "./PainelEsquerdo";
import { PainelPropriedades } from "./PainelPropriedades";
import { Quadro } from "./Quadro";
import { Dialogo } from "../ui";
import { TIPOLOGIAS } from "@/lib/calculo/tabelas";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "croqui", nome: "Croqui" },
  { id: "lumens", nome: "M. Lúmens" },
  { id: "p2ph", nome: "P2P horiz." },
  { id: "p2pv", nome: "P2P vert." },
  { id: "nbr", nome: "NBR" },
];

/** Grava o projeto 1,5 s depois da última mudança, e também ao sair da aba. */
function useAutoSalvar() {
  const projeto = useEditor((s) => s.projeto);
  const status = useEditor((s) => s.status);
  const set = useEditor((s) => s.set);
  const ultimo = useRef(projeto);
  useEffect(() => {
    if (!projeto || status !== "alterado") return;
    const t = setTimeout(async () => {
      const atual = useEditor.getState().projeto;
      if (!atual) return;
      set({ status: "salvando" });
      try {
        await salvarProjeto(atual);
        ultimo.current = atual;
        // se mudou de novo durante a gravação, continua "alterado"
        set({ status: useEditor.getState().projeto === atual ? "salvo" : "alterado" });
      } catch {
        set({ status: "erro" });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [projeto, status, set]);
  useEffect(() => {
    const f = () => {
      const s = useEditor.getState();
      if (document.visibilityState === "hidden" && s.projeto && s.status !== "salvo") salvarProjeto(s.projeto).then(() => set({ status: "salvo" }));
    };
    const antes = (e: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (s.status === "alterado" || s.status === "salvando") {
        if (s.projeto) salvarProjeto(s.projeto);
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("beforeunload", antes);
    return () => {
      document.removeEventListener("visibilitychange", f);
      window.removeEventListener("beforeunload", antes);
    };
  }, [set]);
}

function IndicadorSalvo() {
  const status = useEditor((s) => s.status);
  const m = {
    salvo: { i: <Check size={14} />, t: "Salvo", c: "text-emerald-300" },
    alterado: { i: <Loader2 size={14} />, t: "Alterado", c: "text-[var(--fraco)]" },
    salvando: { i: <Loader2 size={14} className="animate-spin" />, t: "Salvando", c: "text-[var(--fraco)]" },
    erro: { i: <CircleAlert size={14} />, t: "Erro ao salvar", c: "text-red-300" },
  }[status];
  return (
    <span className={`flex items-center gap-1 text-xs ${m.c}`} aria-live="polite">
      {m.i}
      {m.t}
    </span>
  );
}

export function Editor({ id }: { id: string }) {
  const projeto = useEditor((s) => s.projeto);
  const aba = useEditor((s) => s.aba);
  const set = useEditor((s) => s.set);
  const mensagem = useEditor((s) => s.mensagem);
  const vista = useEditor((s) => s.vista);
  const [naoAchou, setNaoAchou] = useState(false);
  const [esq, setEsq] = useState(true);
  const [dir, setDir] = useState(true);
  const [contato, setContato] = useState(false);
  useAutoSalvar();

  useEffect(() => {
    carregarProjeto(id).then((p) => {
      if (!p) setNaoAchou(true);
      else useEditor.getState().carregar(p);
    });
  }, [id]);

  useEffect(() => {
    // no celular, painéis começam fechados
    if (window.innerWidth < 900) {
      setEsq(false);
      setDir(false);
    }
  }, []);

  if (naoAchou)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p>Projeto não encontrado neste navegador.</p>
        <Link href="/" className="botao">
          Voltar aos projetos
        </Link>
      </div>
    );
  if (!projeto || projeto.id !== id)
    return (
      <div className="flex h-screen items-center justify-center text-[var(--fraco)]">
        <Loader2 className="mr-2 animate-spin" size={18} /> Abrindo projeto...
      </div>
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--borda)] bg-[var(--painel)] px-3 py-2">
        <Link href="/" className="icone" title="Voltar aos projetos" aria-label="Voltar aos projetos">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-[0.14em] text-[var(--marca)]">{MARCA.nome}</span>
          <span className="hidden text-xs tracking-[0.2em] text-[var(--fraco)] sm:inline">ESTUDO DE LUZ</span>
        </div>
        <span className="hidden max-w-56 truncate text-sm font-medium md:inline" title={projeto.nome}>
          {projeto.nome}
        </span>
        <nav className="flex flex-1 justify-center" aria-label="Módulos">
          <div className="flex gap-0.5 rounded-xl bg-black/30 p-1">
            {ABAS.map((a) => (
              <button
                key={a.id}
                className={`aba ${aba === a.id ? "aba-ativa" : ""}`}
                onClick={() => {
                  set({ aba: a.id, ...(a.id === "p2ph" || a.id === "p2pv" ? { vista: "planta" as const } : {}) });
                  if (a.id !== "croqui") setDir(true);
                }}
              >
                {a.nome}
              </button>
            ))}
          </div>
        </nav>
        <IndicadorSalvo />
        <button
          className="icone"
          title={projeto.temaQuadro === "escuro" ? "Quadro claro" : "Quadro escuro"}
          onClick={() => useEditor.getState().mudar((d) => (d.temaQuadro = d.temaQuadro === "escuro" ? "claro" : "escuro"))}
        >
          {projeto.temaQuadro === "escuro" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="botao botao-marca" onClick={() => setContato(true)}>
          <MessageCircle size={15} /> <span className="hidden sm:inline">Falar com a Topfix</span>
        </button>
      </header>
      <Ambientes />
      <div className="flex min-h-0 flex-1">
        {esq && (
          <aside className="painel-lateral w-[272px] shrink-0 overflow-y-auto border-r border-[var(--borda)] max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:mt-[104px]">
            <PainelEsquerdo />
          </aside>
        )}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center">
            <button className="icone mx-1" title="Painel esquerdo" onClick={() => setEsq(!esq)}>
              <PanelLeft size={17} />
            </button>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <BarraFerramentas />
            </div>
            <button className="icone mx-1" title="Painel direito" onClick={() => setDir(!dir)}>
              <PanelRight size={17} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Quadro />
            <LegendaQuadro />
            {aba === "p2ph" && vista === "planta" && (
              <div className="pointer-events-none absolute bottom-3 right-3 w-80 rounded-lg border border-white/10 bg-[#0d1320]/90 p-2 text-[#e7ecf6]">
                <EscalaCores />
                <div className="mt-1 text-[10px] leading-snug text-amber-100/90">Estimativa da componente direta. Não é laudo.</div>
              </div>
            )}
            <BarraStatus />
          </div>
        </main>
        {dir && (
          <aside className="painel-lateral w-[330px] shrink-0 overflow-y-auto border-l border-[var(--borda)] max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:mt-[104px]">
            {aba === "croqui" && <PainelPropriedades />}
            {aba === "lumens" && <PainelLumens />}
            {aba === "p2ph" && <PainelP2PH />}
            {aba === "p2pv" && <PainelP2PV />}
            {aba === "nbr" && <PainelNBR />}
          </aside>
        )}
      </div>
      {mensagem && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl ${
            mensagem.tipo === "erro" ? "border-red-400/40 bg-red-950/95 text-red-100" : "border-[var(--borda)] bg-[var(--painel)] text-white"
          }`}
        >
          {mensagem.texto}
        </div>
      )}
      {contato && <DialogoContato aoFechar={() => setContato(false)} />}
    </div>
  );
}

function BarraStatus() {
  const ferramenta = useEditor((s) => s.ferramenta);
  const dicas: Partial<Record<string, string>> = {
    parede: "Clique ponto a ponto. Digite a medida e Enter para fixar o comprimento. Clique no primeiro ponto para fechar. Esc ou duplo clique termina.",
    retangulo: "Arraste no quadro ou digite largura x comprimento (ex.: 4x5) e Enter.",
    porta: "Clique sobre uma parede.",
    janela: "Clique sobre uma parede.",
    limite: "Clique em duas pontas. O limite bloqueia a luz e gera sombra.",
    referencia: "Clique em duas pontas. A referência é só desenho (não bloqueia a luz).",
    cota: "Clique em duas pontas.",
    medir: "Clique em duas pontas para medir.",
    calibrar: "Clique nas duas pontas de uma medida conhecida do fundo.",
    promover: "Clique numa linha do DXF para transformá-la em parede.",
    plano_vertical: "Clique numa parede, ou em duas pontas para desenhar o plano.",
    linha_corte: "Clique em duas pontas. O corte olha para a esquerda da linha (de A para A).",
    facho: "Clique para colocar. Selecione e arraste a alça azul para girar.",
    linear_dirigido: "Clique para colocar. A luz sai para o lado da alça.",
    linha_difusa: "Clique para colocar.",
    difusa: "Clique para colocar.",
  };
  const d = dicas[ferramenta];
  if (!d) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 max-w-xl rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white/85 backdrop-blur">{d}</div>
  );
}

function Ambientes() {
  const projeto = useEditor((s) => s.projeto)!;
  const ambienteId = useEditor((s) => s.ambienteId);
  const set = useEditor((s) => s.set);
  const mudar = useEditor((s) => s.mudar);
  const [novo, setNovo] = useState(false);
  const atual = ambienteAtual({ projeto, ambienteId });
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--borda)] bg-[var(--painel)]/60 px-3 py-1">
      <span className="mr-1 text-[10px] font-bold tracking-[0.16em] text-[var(--fraco)]">AMBIENTES</span>
      {projeto.ambientes.map((a) => (
        <button
          key={a.id}
          className={`chip whitespace-nowrap ${a.id === atual?.id ? "chip-ativo" : ""}`}
          onClick={() => set({ ambienteId: a.id, selecao: [] })}
        >
          {a.nome}
        </button>
      ))}
      <button className="icone" title="Novo ambiente" onClick={() => setNovo(true)}>
        <Plus size={16} />
      </button>
      {atual && (
        <>
          <button
            className="icone"
            title="Duplicar ambiente"
            onClick={() => {
              const copia = comIdsNovos(atual);
              copia.nome = `${atual.nome} (cópia)`;
              mudar((d) => {
                d.ambientes.push(copia);
              });
              set({ ambienteId: copia.id });
            }}
          >
            <Copy size={15} />
          </button>
          {projeto.ambientes.length > 1 && (
            <button
              className="icone"
              title="Excluir ambiente"
              onClick={() => {
                if (!confirm(`Excluir o ambiente "${atual.nome}"? Dá para desfazer com Ctrl+Z.`)) return;
                mudar((d) => {
                  d.ambientes = d.ambientes.filter((x) => x.id !== atual.id);
                });
                set({ ambienteId: useEditor.getState().projeto!.ambientes[0].id });
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </>
      )}
      {novo && <DialogoNovoAmbiente aoFechar={() => setNovo(false)} />}
    </div>
  );
}

function DialogoNovoAmbiente({ aoFechar }: { aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [tip, setTip] = useState("estar");
  const [pd, setPd] = useState("2,70");
  return (
    <Dialogo titulo="Novo ambiente" aoFechar={aoFechar}>
      <div className="grid gap-3">
        <label className="campo">
          <span>Nome</span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Cozinha" />
        </label>
        <label className="campo">
          <span>Tipologia</span>
          <select className="entrada" value={tip} onChange={(e) => setTip(e.target.value)}>
            {TIPOLOGIAS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} · {t.eAlvo} lx
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Pé-direito (m)</span>
          <input inputMode="decimal" value={pd} onChange={(e) => setPd(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="botao" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          className="botao botao-marca"
          onClick={() => {
            const a = novoAmbiente(nome.trim() || "Ambiente", tip, parseFloat(pd.replace(",", ".")) || 2.7);
            useEditor.getState().mudar((d) => {
              d.ambientes.push(a);
            });
            useEditor.getState().set({ ambienteId: a.id, selecao: [], vista: "planta" });
            aoFechar();
          }}
        >
          Criar
        </button>
      </div>
    </Dialogo>
  );
}

function DialogoContato({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Dialogo titulo="Falar com a Topfix" aoFechar={aoFechar}>
      <p className="text-sm">
        Cortinas, persianas e papel de parede com instalação. Para pedir orçamento deste projeto, fale com a equipe Topfix em{" "}
        <a className="text-[var(--marca)] underline" href={`https://${MARCA.site}`} target="_blank" rel="noreferrer">
          {MARCA.site}
        </a>
        .
      </p>
      <p className="mt-3 text-xs text-[var(--fraco)]">
        O pedido de orçamento direto pelo app (com o projeto anexado e a fila de atendimento da equipe) entra junto com o cadastro de arquitetos e parceiros.
      </p>
      <div className="mt-4">
        <Aviso compacto />
      </div>
    </Dialogo>
  );
}
