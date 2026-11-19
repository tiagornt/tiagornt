// Modelo de dados do app. Tudo em metros, coordenadas do mundo com y para cima.
// Na planta: x, y = posição no piso. No corte: x = posição ao longo do corte, y = altura (z).

export type Pt = { x: number; y: number };

export type Natureza = "facho" | "linear_dirigido" | "linha_difusa" | "difusa";

export const NATUREZAS: Natureza[] = ["facho", "linear_dirigido", "linha_difusa", "difusa"];

export const NOME_NATUREZA: Record<Natureza, string> = {
  facho: "Facho",
  linear_dirigido: "Linear direcionado",
  linha_difusa: "Linha difusa",
  difusa: "Difusa",
};

export interface Parede {
  id: string;
  a: Pt;
  b: Pt;
  espessura: number;
  /** Lado em que a espessura cresce, olhando de a para b. "centro" = metade para cada lado. */
  lado: "centro" | "esquerda" | "direita";
  /** Parede bloqueia a luz no croqui e no P2P (padrão: sim). */
  bloqueia: boolean;
}

export type TipoAbertura = "porta" | "janela";

export interface Abertura {
  id: string;
  paredeId: string;
  tipo: TipoAbertura;
  /** Posição do centro do vão ao longo da parede, de 0 (ponta a) a 1 (ponta b). */
  t: number;
  largura: number;
  /** Peitoril (só janela). */
  peitoril: number;
  /** Altura do vão (porta: altura da porta; janela: altura da janela). */
  altura: number;
  /** Porta: lado para onde abre a folha. */
  abreParaDentro?: boolean;
  inverter?: boolean;
}

/** Linha livre: limite de croqui (bloqueia luz) ou só referência visual (móvel, sanca, bancada). */
export interface Linha {
  id: string;
  a: Pt;
  b: Pt;
  tipo: "limite" | "referencia";
}

export interface Cota {
  id: string;
  a: Pt;
  b: Pt;
  /** Afastamento da linha de cota em relação ao segmento medido (m). */
  offset: number;
}

export interface Texto {
  id: string;
  p: Pt;
  texto: string;
  tamanho: number; // altura do texto em metros
}

export interface Fonte {
  id: string;
  codigo: string;
  natureza: Natureza;
  x: number;
  y: number;
  /** Direção do facho/lóbulo no plano, em graus (0 = para a direita, 90 = para cima). */
  rotacao: number;
  /** Inclinação do facho em relação à vertical, em graus (0 = apontado para baixo). Só na planta. */
  tilt: number;
  cct: number;
  intensidadePct: number;
  /** Altura de montagem (m). No corte, a altura é o próprio y. */
  altura: number;
  /** Fluxo luminoso total (lm). Para lineares, é o total da peça (lm/m x comprimento). */
  fluxo: number | null;
  /** Intensidade de pico (cd). Opcional; se vazia, é estimada pelo fluxo. */
  intensidadeCd: number | null;
  potencia: number | null;
  /** Abertura total do facho (graus). */
  abertura: number;
  /** Comprimento (m), para lineares. */
  comprimento: number;
  visivel: boolean;
  presetId?: string;
  /** Valor veio do preset e ainda não foi confirmado pelo usuário. */
  valorTipico?: boolean;
}

export type TipoFundo = "dxf" | "pdf" | "imagem";

export interface CamadaDxf {
  nome: string;
  visivel: boolean;
  entidades: number;
}

/** Polilinha do DXF já convertida para metros e posicionada no mundo. */
export interface EntidadeDxf {
  camada: string;
  pts: number[]; // x0,y0,x1,y1,...
  fechado: boolean;
}

export interface Fundo {
  tipo: TipoFundo;
  nomeArquivo: string;
  opacidade: number;
  travado: boolean;
  visivel: boolean;
  /** Escala validada pelo usuário (DXF: "Aplicar escala"; PDF/imagem: calibração por duas pontas). */
  validadoEm: string | null;
  // DXF
  camadas?: CamadaDxf[];
  entidades?: EntidadeDxf[];
  unidadeOrigem?: string;
  // PDF / imagem
  imagem?: {
    dataUrl: string;
    larguraPx: number;
    alturaPx: number;
    /** Metros por pixel. */
    escala: number;
    /** Canto superior esquerdo da imagem no mundo. */
    x: number;
    y: number;
    rotacao: number;
    paginaPdf?: number;
  };
  /** Última calibração feita (para refazer/conferir). */
  calibracao?: { p1: Pt; p2: Pt; medidaM: number } | null;
}

export interface Vista {
  paredes: Parede[];
  aberturas: Abertura[];
  linhas: Linha[];
  cotas: Cota[];
  textos: Texto[];
  fontes: Fonte[];
  fundo: Fundo | null;
  /** Posição da legenda no mundo (canto superior esquerdo). null = automática. */
  legenda: Pt | null;
  legendaVisivel: boolean;
}

export interface VistaCorte extends Vista {
  /** Linha de corte desenhada na planta, se o corte foi gerado a partir dela. */
  linhaCorte: { a: Pt; b: Pt } | null;
}

export type GrupoCores = "claras" | "medias" | "escuras" | "personalizado";
export type CondicaoFM = "limpo" | "normal" | "sujo" | "personalizado";

export interface ResultadoLumens {
  versao: string;
  calculadoEm: string;
  entradas: Record<string, unknown>;
  A: number;
  C: number;
  L: number;
  hm: number;
  K: number;
  FU: number;
  FM: number;
  somaFluxo: number;
  Emed: number;
  Ealvo: number | null;
  avisos: string[];
}

export interface ResultadoP2P {
  versao: string;
  calculadoEm: string;
  tipo: "h" | "v";
  Emed: number;
  Emin: number;
  Emax: number;
  U0: number;
  pontos: number;
  /** Grade para o mapa: valores linha a linha, NaN fora do ambiente. */
  grade: { nx: number; ny: number; x0: number; y0: number; passo: number; valores: number[] };
  /** Só no vertical: a parede/segmento do plano e a altura. */
  plano?: { a: Pt; b: Pt; altura: number };
  avisos: string[];
}

export interface Ambiente {
  id: string;
  nome: string;
  tipologiaId: string;
  peDireito: number;
  alturaPlano: number;
  condicaoFM: CondicaoFM;
  fm: number;
  grupoCores: GrupoCores;
  rho: { teto: number; paredes: number; piso: number };
  /** Alvo do projeto, sobrescreve o da tabela. */
  alvoLx: number | null;
  notas: string;
  /** Como tratar polígono irregular no índice K. */
  metodoRetangulo: "lmax" | "bbox";
  /** Altura de montagem usada no método dos lúmens (null = média das fontes). */
  alturaMontagemCalculo: number | null;
  p2p: {
    espacamento: number;
    margem: boolean;
    /** Plano vertical: segmento escolhido (parede ou desenhado) e normal para o lado da luz. */
    planoVertical: { a: Pt; b: Pt } | null;
  };
  planta: Vista;
  corte: VistaCorte;
  calculos: {
    lumens: ResultadoLumens | null;
    p2pH: ResultadoP2P | null;
    p2pV: ResultadoP2P | null;
  };
}

export type StatusProjeto = "rascunho" | "em_andamento" | "compartilhado" | "arquivado";

export interface Projeto {
  id: string;
  nome: string;
  cliente: string;
  cidade: string;
  responsavel: string;
  status: StatusProjeto;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
  ambientes: Ambiente[];
  /** Tema do quadro (fundo do croqui e do PNG). */
  temaQuadro: "escuro" | "claro";
}

export interface ResumoProjeto {
  id: string;
  nome: string;
  cliente: string;
  cidade: string;
  status: StatusProjeto;
  atualizadoEm: string;
  excluidoEm: string | null;
  ambientes: number;
}
