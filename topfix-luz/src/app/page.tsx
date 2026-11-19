"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Download, FolderOpen, Lightbulb, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { apagarDefinitivo, carregarProjeto, listarProjetos, salvarProjeto } from "@/lib/armazenamento";
import { comIdsNovos, novoProjeto } from "@/lib/fabrica";
import { projetoExemplo } from "@/lib/exemplo";
import { MARCA } from "@/lib/marca";
import { AVISO_CURTO } from "@/lib/calculo/tabelas";
import type { Projeto, ResumoProjeto } from "@/lib/tipos";
import { Dialogo } from "@/components/ui";
import { baixar } from "@/lib/baixar";

type Filtro = "ativos" | "arquivados" | "lixeira";

const STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  compartilhado: "Compartilhado",
  arquivado: "Arquivado",
};

export default function Inicio() {
  const router = useRouter();
  const [lista, setLista] = useState<ResumoProjeto[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [novo, setNovo] = useState(false);
  const recarregar = () => listarProjetos().then(setLista);
  useEffect(() => {
    recarregar();
  }, []);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista ?? []).filter((p) => {
      if (filtro === "lixeira" ? !p.excluidoEm : p.excluidoEm) return false;
      if (filtro === "arquivados" && p.status !== "arquivado") return false;
      if (filtro === "ativos" && p.status === "arquivado") return false;
      return !t || `${p.nome} ${p.cliente} ${p.cidade}`.toLowerCase().includes(t);
    });
  }, [lista, busca, filtro]);

  async function alterar(id: string, fn: (p: Projeto) => void) {
    const p = await carregarProjeto(id);
    if (!p) return;
    fn(p);
    p.atualizadoEm = new Date().toISOString();
    await salvarProjeto(p);
    recarregar();
  }

  async function abrirExemplo() {
    const p = projetoExemplo();
    await salvarProjeto(p);
    router.push(`/projeto/${p.id}`);
  }

  async function importarArquivo(f: File | undefined) {
    if (!f) return;
    try {
      const p = JSON.parse(await f.text()) as Projeto;
      if (!p?.ambientes?.length || !p.nome) throw new Error();
      const novoP = comIdsNovos(p);
      novoP.criadoEm = novoP.atualizadoEm = new Date().toISOString();
      novoP.excluidoEm = null;
      await salvarProjeto(novoP);
      recarregar();
    } catch {
      alert("Arquivo de projeto inválido.");
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--borda)] bg-[var(--painel)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold tracking-[0.16em] text-[var(--marca)]">{MARCA.nome}</span>
            <span className="text-xs font-semibold tracking-[0.24em] text-[var(--fraco)]">ESTUDO DE LUZ</span>
          </div>
          <div className="flex-1" />
          <button className="botao botao-marca" onClick={() => setNovo(true)}>
            <Plus size={16} /> Novo projeto
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--painel)] p-6 md:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,184,96,0.55), transparent 65%)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(90,140,255,0.5), transparent 65%)" }}
          />
          <div className="relative max-w-2xl">
            <h1 className="text-2xl font-semibold md:text-3xl">
              Mostre a <span className="text-[var(--marca)]">luz</span> antes do cálculo.
            </h1>
            <p className="mt-2 text-[var(--fraco)]">
              Desenhe o ambiente, posicione fachos, lineares e difusas, veja as manchas com sombra e cor, e confira a estimativa pelo método dos lúmens e
              pelo ponto a ponto, comparada ao alvo de referência.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="botao botao-marca" onClick={() => setNovo(true)}>
                <Plus size={16} /> Começar um projeto
              </button>
              <button className="botao" onClick={abrirExemplo}>
                <Sparkles size={16} /> Abrir um exemplo pronto
              </button>
            </div>
            <p className="mt-4 text-xs text-[var(--fraco)]">{AVISO_CURTO}</p>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fraco)]" />
            <input
              className="entrada pl-9"
              placeholder="Buscar por projeto, cliente ou cidade"
              aria-label="Buscar projetos"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1 rounded-xl bg-black/30 p-1" role="tablist">
            {(["ativos", "arquivados", "lixeira"] as Filtro[]).map((f) => (
              <button key={f} role="tab" aria-selected={filtro === f} className={`aba ${filtro === f ? "aba-ativa" : ""}`} onClick={() => setFiltro(f)}>
                {f === "ativos" ? "Meus projetos" : f === "arquivados" ? "Arquivados" : "Lixeira"}
              </button>
            ))}
          </div>
          <label className="botao cursor-pointer">
            <Upload size={15} /> Abrir arquivo
            <input type="file" accept=".json,.topfix-luz" className="hidden" onChange={(e) => (importarArquivo(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
        </div>

        {lista === null ? (
          <p className="text-[var(--fraco)]">Carregando...</p>
        ) : !visiveis.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--borda)] p-10 text-center text-[var(--fraco)]">
            <Lightbulb className="mx-auto mb-2" />
            {filtro === "lixeira"
              ? "A lixeira está vazia. Projetos excluídos ficam aqui por 30 dias."
              : filtro === "arquivados"
                ? "Nenhum projeto arquivado."
                : busca
                  ? "Nenhum projeto com esse nome."
                  : "Nenhum projeto ainda. Crie o primeiro ou abra o exemplo."}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((p) => (
              <li key={p.id} className="group rounded-2xl border border-[var(--borda)] bg-[var(--painel)] p-4 transition hover:border-[var(--marca)]/60">
                <Link href={filtro === "lixeira" ? "#" : `/projeto/${p.id}`} className="block" onClick={(e) => filtro === "lixeira" && e.preventDefault()}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.nome}</h2>
                    <span className="chip shrink-0 text-[10px]">{STATUS[p.status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--fraco)]">
                    {[p.cliente, p.cidade].filter(Boolean).join(" · ") || "Sem cliente"} · {p.ambientes} {p.ambientes === 1 ? "ambiente" : "ambientes"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--fraco)]">Atualizado em {new Date(p.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </Link>
                <div className="mt-3 flex gap-1 border-t border-[var(--borda)] pt-2">
                  {filtro === "lixeira" ? (
                    <>
                      <button className="botao flex-1" onClick={() => alterar(p.id, (x) => (x.excluidoEm = null))}>
                        <ArchiveRestore size={14} /> Restaurar
                      </button>
                      <button
                        className="icone"
                        title="Excluir para sempre"
                        onClick={async () => {
                          if (!confirm(`Excluir "${p.nome}" para sempre?`)) return;
                          await apagarDefinitivo(p.id);
                          recarregar();
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Link className="botao flex-1" href={`/projeto/${p.id}`}>
                        <FolderOpen size={14} /> Abrir
                      </Link>
                      <button
                        className="icone"
                        title="Duplicar projeto"
                        onClick={async () => {
                          const o = await carregarProjeto(p.id);
                          if (!o) return;
                          const c = comIdsNovos(o);
                          c.nome = `${o.nome} (cópia)`;
                          c.criadoEm = c.atualizadoEm = new Date().toISOString();
                          await salvarProjeto(c);
                          recarregar();
                        }}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="icone"
                        title="Baixar arquivo do projeto (cópia de segurança ou para enviar)"
                        onClick={async () => {
                          const o = await carregarProjeto(p.id);
                          if (!o) return;
                          const url = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: "application/json" }));
                          baixar(url, `${o.nome.replace(/[^\w\- ]+/g, "")}.topfix-luz.json`);
                          setTimeout(() => URL.revokeObjectURL(url), 2000);
                        }}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icone"
                        title={p.status === "arquivado" ? "Desarquivar" : "Arquivar"}
                        onClick={() => alterar(p.id, (x) => (x.status = x.status === "arquivado" ? "em_andamento" : "arquivado"))}
                      >
                        {p.status === "arquivado" ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                      </button>
                      <button
                        className="icone"
                        title="Excluir (vai para a lixeira por 30 dias)"
                        onClick={() => confirm(`Mover "${p.nome}" para a lixeira?`) && alterar(p.id, (x) => (x.excluidoEm = new Date().toISOString()))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-center text-xs text-[var(--fraco)]">
          Os projetos ficam salvos neste navegador. Use &quot;Baixar arquivo&quot; para guardar uma cópia ou enviar para outra pessoa.
        </p>
      </main>
      {novo && (
        <DialogoNovoProjeto
          aoFechar={() => setNovo(false)}
          aoCriar={async (p) => {
            await salvarProjeto(p);
            router.push(`/projeto/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function DialogoNovoProjeto({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (p: Projeto) => void }) {
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [cidade, setCidade] = useState("");
  const [notas, setNotas] = useState("");
  return (
    <Dialogo titulo="Novo projeto" aoFechar={aoFechar}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          const p = novoProjeto(nome.trim(), cliente.trim(), cidade.trim());
          p.notas = notas;
          aoCriar(p);
        }}
      >
        <label className="campo">
          <span>Nome do projeto</span>
          <input autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Apto 302, Ed. Aurora" />
        </label>
        <label className="campo">
          <span>Cliente (opcional)</span>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </label>
        <label className="campo">
          <span>Observações</span>
          <textarea className="entrada min-h-16" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        <p className="text-xs text-[var(--fraco)]">O projeto já nasce com um ambiente em branco (sala de estar, 2,70 m). Dá para trocar depois.</p>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-marca" disabled={!nome.trim()}>
            Criar e abrir
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
