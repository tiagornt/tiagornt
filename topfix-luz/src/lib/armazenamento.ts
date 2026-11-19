// Gravação dos projetos no navegador (IndexedDB).
// Camada única de acesso: quando o Supabase entrar (E1), só este arquivo muda.

import { createStore, del, get, set } from "idb-keyval";
import type { Projeto, ResumoProjeto } from "./tipos";

const loja = typeof indexedDB !== "undefined" ? createStore("topfix-luz", "dados") : undefined;
const CHAVE_INDICE = "indice";
const chaveProjeto = (id: string) => `projeto:${id}`;

export function resumoDe(p: Projeto): ResumoProjeto {
  return {
    id: p.id,
    nome: p.nome,
    cliente: p.cliente,
    cidade: p.cidade,
    status: p.status,
    atualizadoEm: p.atualizadoEm,
    excluidoEm: p.excluidoEm,
    ambientes: p.ambientes.length,
  };
}

export async function listarProjetos(): Promise<ResumoProjeto[]> {
  const lista = ((await get(CHAVE_INDICE, loja)) as ResumoProjeto[] | undefined) ?? [];
  // lixeira: some depois de 30 dias
  const limite = Date.now() - 30 * 24 * 3600 * 1000;
  const vencidos = lista.filter((r) => r.excluidoEm && Date.parse(r.excluidoEm) < limite);
  for (const v of vencidos) await apagarDefinitivo(v.id);
  return lista
    .filter((r) => !vencidos.includes(r))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export async function carregarProjeto(id: string): Promise<Projeto | null> {
  return ((await get(chaveProjeto(id), loja)) as Projeto | undefined) ?? null;
}

export async function salvarProjeto(p: Projeto): Promise<void> {
  await set(chaveProjeto(p.id), p, loja);
  const lista = ((await get(CHAVE_INDICE, loja)) as ResumoProjeto[] | undefined) ?? [];
  const r = resumoDe(p);
  const i = lista.findIndex((x) => x.id === p.id);
  if (i >= 0) lista[i] = r;
  else lista.push(r);
  await set(CHAVE_INDICE, lista, loja);
}

export async function apagarDefinitivo(id: string): Promise<void> {
  await del(chaveProjeto(id), loja);
  const lista = ((await get(CHAVE_INDICE, loja)) as ResumoProjeto[] | undefined) ?? [];
  await set(
    CHAVE_INDICE,
    lista.filter((x) => x.id !== id),
    loja,
  );
}
