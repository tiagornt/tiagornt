// Tabelas de referência da Fase 1. Valores de partida da especificação (seção 4.5 e 4.7).
// A tabela NBR e a de FU precisam ser conferidas com o texto oficial e em bancada antes do lançamento.

import type { CondicaoFM, GrupoCores } from "../tipos";

export const VERSAO_FORMULAS = "F1-2026.11";
export const VERSAO_TABELA_NBR = "NBR-ref-2026.11 (a conferir com o texto oficial)";

export interface TipologiaNBR {
  id: string;
  nome: string;
  uso: "Residencial" | "Comercial" | "Ambos";
  eAlvo: number;
  ugrlMax: number | null;
  raMin: number;
}

export const TIPOLOGIAS: TipologiaNBR[] = [
  { id: "circulacao", nome: "Circulação, corredor, hall", uso: "Ambos", eAlvo: 100, ugrlMax: 28, raMin: 40 },
  { id: "escadas", nome: "Escadas", uso: "Ambos", eAlvo: 150, ugrlMax: 25, raMin: 40 },
  { id: "estar", nome: "Área de estar / sala", uso: "Residencial", eAlvo: 150, ugrlMax: null, raMin: 80 },
  { id: "quarto", nome: "Quarto", uso: "Residencial", eAlvo: 100, ugrlMax: null, raMin: 80 },
  { id: "cozinha", nome: "Cozinha, geral", uso: "Residencial", eAlvo: 200, ugrlMax: null, raMin: 80 },
  { id: "cozinha_bancada", nome: "Cozinha, bancada / pia", uso: "Residencial", eAlvo: 500, ugrlMax: null, raMin: 80 },
  { id: "banheiro", nome: "Banheiro, geral", uso: "Residencial", eAlvo: 200, ugrlMax: null, raMin: 80 },
  { id: "banheiro_espelho", nome: "Banheiro, espelho", uso: "Residencial", eAlvo: 500, ugrlMax: null, raMin: 80 },
  { id: "servico", nome: "Área de serviço / lavanderia", uso: "Residencial", eAlvo: 200, ugrlMax: null, raMin: 80 },
  { id: "home_office", nome: "Home office / leitura e escrita", uso: "Residencial", eAlvo: 500, ugrlMax: 19, raMin: 80 },
  { id: "escritorio", nome: "Escritório: escrever, teclar, ler", uso: "Comercial", eAlvo: 500, ugrlMax: 19, raMin: 80 },
  { id: "reuniao", nome: "Sala de reunião / conferência", uso: "Comercial", eAlvo: 500, ugrlMax: 19, raMin: 80 },
  { id: "recepcao", nome: "Recepção (balcão)", uso: "Comercial", eAlvo: 300, ugrlMax: 22, raMin: 80 },
  { id: "arquivo", nome: "Arquivo / estoque", uso: "Comercial", eAlvo: 200, ugrlMax: 25, raMin: 60 },
  { id: "aula", nome: "Sala de aula", uso: "Comercial", eAlvo: 300, ugrlMax: 19, raMin: 80 },
  { id: "loja", nome: "Loja / área de vendas", uso: "Comercial", eAlvo: 300, ugrlMax: 22, raMin: 80 },
  { id: "checkout", nome: "Checkout / caixa", uso: "Comercial", eAlvo: 500, ugrlMax: 19, raMin: 80 },
  { id: "restaurante", nome: "Restaurante / refeitório", uso: "Comercial", eAlvo: 200, ugrlMax: 22, raMin: 80 },
  { id: "cozinha_prof", nome: "Cozinha profissional", uso: "Comercial", eAlvo: 500, ugrlMax: 22, raMin: 80 },
  { id: "consultorio", nome: "Consultório / exame geral", uso: "Comercial", eAlvo: 500, ugrlMax: 19, raMin: 90 },
];

export const tipologia = (id: string) => TIPOLOGIAS.find((t) => t.id === id) ?? TIPOLOGIAS[2];

export const FM_PRESETS: Record<Exclude<CondicaoFM, "personalizado">, number> = {
  limpo: 0.8,
  normal: 0.7,
  sujo: 0.6,
};

export const NOME_FM: Record<CondicaoFM, string> = {
  limpo: "Limpo (0,80)",
  normal: "Normal (0,70)",
  sujo: "Sujo (0,60)",
  personalizado: "Personalizado",
};

export const REFLETANCIAS: Record<Exclude<GrupoCores, "personalizado">, { teto: number; paredes: number; piso: number }> = {
  claras: { teto: 0.7, paredes: 0.5, piso: 0.3 },
  medias: { teto: 0.7, paredes: 0.5, piso: 0.2 },
  escuras: { teto: 0.5, paredes: 0.3, piso: 0.1 },
};

export const NOME_GRUPO: Record<GrupoCores, string> = {
  claras: "Claras",
  medias: "Médias",
  escuras: "Escuras",
  personalizado: "Personalizado",
};

/** Tabela de FU: K x grupo de refletâncias. */
export const TABELA_FU: { K: number; claras: number; medias: number; escuras: number }[] = [
  { K: 0.6, claras: 0.4, medias: 0.34, escuras: 0.26 },
  { K: 0.8, claras: 0.45, medias: 0.39, escuras: 0.3 },
  { K: 1.0, claras: 0.5, medias: 0.44, escuras: 0.34 },
  { K: 1.25, claras: 0.55, medias: 0.49, escuras: 0.38 },
  { K: 1.5, claras: 0.6, medias: 0.53, escuras: 0.42 },
  { K: 2.0, claras: 0.66, medias: 0.59, escuras: 0.47 },
  { K: 2.5, claras: 0.7, medias: 0.63, escuras: 0.51 },
  { K: 3.0, claras: 0.73, medias: 0.66, escuras: 0.54 },
  { K: 4.0, claras: 0.77, medias: 0.7, escuras: 0.57 },
  { K: 5.0, claras: 0.8, medias: 0.73, escuras: 0.6 },
];

export const AVISO_PADRAO =
  "Os números deste app são estimativas para estudo de intenção e pré-dimensionamento. Usam o método dos lúmens e, quando indicado, um ponto a ponto da componente direta (lei do inverso do quadrado e lei do cosseno). Não consideram inter-reflexão completa, curvas fotométricas reais (IES/LDT), obstruções detalhadas nem luz natural de precisão. Não são laudo e não substituem um projeto luminotécnico profissional (DIALux ou equivalente).";

export const AVISO_CURTO = "Estimativa para estudo de intenção. Não é laudo e não substitui projeto luminotécnico profissional.";

export const TEXTO_NBR =
  "Referência: NBR ISO/CIE 8995-1 (locais de trabalho). Valores residenciais são prática usual, não um laudo.";
