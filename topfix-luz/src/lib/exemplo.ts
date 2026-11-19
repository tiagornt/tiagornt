// Projeto de exemplo: sala de estar com sofá, mesa e quadro, para o arquiteto ver o app funcionando.

import { novoAmbiente, novoProjeto, paredesRetangulo } from "./fabrica";
import { fonteDoPreset, presetPorId } from "./presets";
import { uid } from "./geometria";
import type { Projeto } from "./tipos";

export function projetoExemplo(): Projeto {
  const p = novoProjeto("Exemplo · Apartamento modelo", "Cliente exemplo", "Brusque/SC");
  const sala = novoAmbiente("Sala de estar", "estar", 2.7);
  const paredes = paredesRetangulo(0, 0, 6, 4.5);
  sala.planta.paredes = paredes;
  // porta e janela
  sala.planta.aberturas = [
    { id: uid("abe_"), paredeId: paredes[0].id, tipo: "porta", t: 0.15, largura: 0.9, peitoril: 0, altura: 2.1 },
    { id: uid("abe_"), paredeId: paredes[2].id, tipo: "janela", t: 0.5, largura: 2.4, peitoril: 0.4, altura: 1.8 },
  ];
  // móveis de referência e uma divisória baixa que gera sombra
  sala.planta.linhas = [
    { id: uid("lin_"), a: { x: 3.3, y: 0.4 }, b: { x: 5.6, y: 0.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 5.6, y: 0.4 }, b: { x: 5.6, y: 1.3 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 5.6, y: 1.3 }, b: { x: 3.3, y: 1.3 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 3.3, y: 1.3 }, b: { x: 3.3, y: 0.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 0.6, y: 2.4 }, b: { x: 2.2, y: 2.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 2.2, y: 2.4 }, b: { x: 2.2, y: 3.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 2.2, y: 3.4 }, b: { x: 0.6, y: 3.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 0.6, y: 3.4 }, b: { x: 0.6, y: 2.4 }, tipo: "referencia" },
    { id: uid("lin_"), a: { x: 2.8, y: 1.9 }, b: { x: 2.8, y: 4.5 }, tipo: "limite" },
  ];
  sala.planta.textos = [
    { id: uid("txt_"), p: { x: 3.7, y: 0.75 }, texto: "Sofá", tamanho: 0.2 },
    { id: uid("txt_"), p: { x: 0.95, y: 2.8 }, texto: "Mesa", tamanho: 0.2 },
  ];
  sala.planta.cotas = [
    { id: uid("cot_"), a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, offset: -0.6 },
    { id: uid("cot_"), a: { x: 6, y: 0 }, b: { x: 6, y: 4.5 }, offset: -0.6 },
  ];
  const f = (preset: string, x: number, y: number, codigo: string, extra: Partial<ReturnType<typeof fonteDoPreset>> = {}) => ({
    ...fonteDoPreset(presetPorId(preset)!, { x, y }, 2.7, codigo, uid("fnt_"), "planta"),
    ...extra,
  });
  sala.planta.fontes = [
    // embutidos sobre o estar
    f("spot60", 3.9, 2.2, "L01"),
    f("spot60", 5.1, 2.2, "L01"),
    f("spot60", 3.9, 3.5, "L01"),
    f("spot60", 5.1, 3.5, "L01"),
    // pendente sobre a mesa
    f("pendente", 1.4, 2.9, "L02"),
    // destaque num quadro na parede do sofá (a 1 m da parede, mira a 1,5 m de altura)
    f("destaque15", 4.45, 1.0, "L03", { rotacao: -90, tilt: 40 }),
    // sanca com fita na parede da janela
    f("fita", 4.4, 4.3, "L04", { rotacao: -90, comprimento: 3, fluxo: 2400 }),
    // rasante na parede da mesa
    f("rasante", 0.3, 2.9, "L05", { rotacao: 180, comprimento: 1.6, fluxo: 1440 }),
  ];
  sala.p2p.planoVertical = { a: paredes[0].a, b: paredes[0].b };
  p.ambientes = [sala];
  p.status = "em_andamento";
  return p;
}
