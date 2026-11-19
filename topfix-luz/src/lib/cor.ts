// Cor da mancha a partir da temperatura de cor (CCT), de forma contínua.
// Tabela ajustada para leitura sobre fundo escuro: 2700 K âmbar, 3000 K branco quente,
// 4000 K neutro, 6500 K branco frio (levemente azulado).

const TABELA: [number, [number, number, number]][] = [
  [1800, [255, 120, 30]],
  [2200, [255, 146, 52]],
  [2700, [255, 172, 84]],
  [3000, [255, 196, 128]],
  [3500, [255, 216, 168]],
  [4000, [255, 232, 204]],
  [5000, [246, 244, 250]],
  [5700, [228, 236, 255]],
  [6500, [208, 224, 255]],
];

export function rgbDoCCT(k: number): [number, number, number] {
  const t = Math.max(TABELA[0][0], Math.min(TABELA[TABELA.length - 1][0], k));
  for (let i = 0; i < TABELA.length - 1; i++) {
    const [k0, c0] = TABELA[i];
    const [k1, c1] = TABELA[i + 1];
    if (t >= k0 && t <= k1) {
      const f = (t - k0) / (k1 - k0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [number, number, number];
    }
  }
  return TABELA[TABELA.length - 1][1];
}

export function cssDoCCT(k: number, alpha = 1): string {
  const [r, g, b] = rgbDoCCT(k);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- Escala de cores falsas do ponto a ponto ----------

export const ESCALA_LUX = [0, 50, 100, 200, 300, 500, 750, 1000];

const CORES_ESCALA: [number, number, number][] = [
  [18, 22, 70], // 0
  [40, 60, 170], // 50
  [30, 140, 210], // 100
  [40, 190, 140], // 200
  [150, 210, 60], // 300
  [250, 210, 40], // 500
  [245, 130, 40], // 750
  [230, 50, 50], // 1000
];

/** Cor falsa para um valor em lux (interpolada entre os degraus da escala). */
export function corFalsa(lx: number): [number, number, number] {
  if (!(lx > 0)) return CORES_ESCALA[0];
  for (let i = 0; i < ESCALA_LUX.length - 1; i++) {
    if (lx <= ESCALA_LUX[i + 1]) {
      const f = (lx - ESCALA_LUX[i]) / (ESCALA_LUX[i + 1] - ESCALA_LUX[i]);
      const c0 = CORES_ESCALA[i];
      const c1 = CORES_ESCALA[i + 1];
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [number, number, number];
    }
  }
  // acima de 1000 lx: clareia até branco em 2000 lx
  const f = Math.min(1, (lx - 1000) / 1000);
  const c = CORES_ESCALA[CORES_ESCALA.length - 1];
  return [0, 1, 2].map((j) => Math.round(c[j] + (255 - c[j]) * f * 0.6)) as [number, number, number];
}
