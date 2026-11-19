// Biblioteca genérica de fontes (Fase 1). Sem marca, nome comercial ou SKU de fabricante.
// Os valores de fluxo são típicos de mercado e aparecem como "valor típico, confirme".

import type { Fonte, Natureza } from "./tipos";

export interface Preset {
  id: string;
  nome: string;
  natureza: Natureza;
  cct: number;
  fluxo: number;
  potencia: number;
  abertura: number;
  comprimento: number;
  tilt: number;
  altura: number | null; // null = pé-direito do ambiente
  intensidadePct: number;
}

export const PRESETS: Preset[] = [
  { id: "spot24", nome: "Spot 3000 K 24°", natureza: "facho", cct: 3000, fluxo: 600, potencia: 7, abertura: 24, comprimento: 0, tilt: 0, altura: null, intensidadePct: 80 },
  { id: "spot36", nome: "Spot 2700 K 36°", natureza: "facho", cct: 2700, fluxo: 550, potencia: 7, abertura: 36, comprimento: 0, tilt: 0, altura: null, intensidadePct: 80 },
  { id: "spot60", nome: "Embutido 4000 K 60°", natureza: "facho", cct: 4000, fluxo: 900, potencia: 9, abertura: 60, comprimento: 0, tilt: 0, altura: null, intensidadePct: 80 },
  { id: "destaque15", nome: "Destaque 3000 K 15° (quadro/objeto)", natureza: "facho", cct: 3000, fluxo: 450, potencia: 6, abertura: 15, comprimento: 0, tilt: 30, altura: null, intensidadePct: 85 },
  { id: "arandela", nome: "Arandela facho duplo 2700 K", natureza: "facho", cct: 2700, fluxo: 400, potencia: 6, abertura: 40, comprimento: 0, tilt: 0, altura: 1.8, intensidadePct: 70 },
  { id: "plafon", nome: "Plafon difuso 3000 K", natureza: "difusa", cct: 3000, fluxo: 2000, potencia: 18, abertura: 180, comprimento: 0, tilt: 0, altura: null, intensidadePct: 75 },
  { id: "pendente", nome: "Pendente difuso 2700 K", natureza: "difusa", cct: 2700, fluxo: 800, potencia: 9, abertura: 180, comprimento: 0, tilt: 0, altura: 1.8, intensidadePct: 70 },
  { id: "abajur", nome: "Abajur / luminária de piso 2700 K", natureza: "difusa", cct: 2700, fluxo: 450, potencia: 6, abertura: 180, comprimento: 0, tilt: 0, altura: 1.2, intensidadePct: 60 },
  { id: "linear12", nome: "Linear 4000 K 1,2 m", natureza: "linha_difusa", cct: 4000, fluxo: 2400, potencia: 20, abertura: 120, comprimento: 1.2, tilt: 0, altura: null, intensidadePct: 75 },
  { id: "fita", nome: "Fita LED sanca 3000 K (por metro: 800 lm)", natureza: "linha_difusa", cct: 3000, fluxo: 1600, potencia: 20, abertura: 120, comprimento: 2, tilt: 0, altura: null, intensidadePct: 60 },
  { id: "rasante", nome: "Rasante / wall washer 3000 K 1 m", natureza: "linear_dirigido", cct: 3000, fluxo: 900, potencia: 12, abertura: 50, comprimento: 1, tilt: 35, altura: null, intensidadePct: 80 },
  { id: "perfil_bancada", nome: "Perfil sob armário (bancada) 4000 K 0,9 m", natureza: "linear_dirigido", cct: 4000, fluxo: 540, potencia: 7, abertura: 100, comprimento: 0.9, tilt: 10, altura: 1.5, intensidadePct: 80 },
];

/** Valores padrão por natureza, quando a fonte é colocada sem preset. */
export const PADRAO_NATUREZA: Record<Natureza, string> = {
  facho: "spot36",
  linear_dirigido: "rasante",
  linha_difusa: "linear12",
  difusa: "plafon",
};

export const presetPorId = (id: string | undefined) => PRESETS.find((p) => p.id === id);

/** Cria uma fonte a partir de um preset (copia os valores no momento da inserção). */
export function fonteDoPreset(
  p: Preset,
  pos: { x: number; y: number },
  peDireito: number,
  codigo: string,
  id: string,
  vista: "planta" | "corte",
): Fonte {
  const altura = vista === "corte" ? pos.y : p.altura ?? peDireito;
  return {
    id,
    codigo,
    natureza: p.natureza,
    x: pos.x,
    y: pos.y,
    rotacao: vista === "corte" ? -90 : 0,
    tilt: p.tilt,
    cct: p.cct,
    intensidadePct: p.intensidadePct,
    altura,
    fluxo: p.fluxo,
    intensidadeCd: null,
    potencia: p.potencia,
    abertura: p.abertura,
    comprimento: p.comprimento || 1,
    visivel: true,
    presetId: p.id,
    valorTipico: true,
  };
}

export const CCT_PRESETS = [2700, 3000, 4000, 5000, 6500];
