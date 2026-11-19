import type { Abertura, Linha, Parede, Pt, Vista } from "./tipos";

export const EPS = 1e-9;

export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Perpendicular à esquerda (gira 90° anti-horário). */
export const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x });
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const dirDeg = (d: number): Pt => ({ x: Math.cos(rad(d)), y: Math.sin(rad(d)) });

export function areaPoligono(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2; // positivo = anti-horário
}

export function centroide(p: Pt[]): Pt {
  const A = areaPoligono(p);
  if (Math.abs(A) < EPS) {
    const s = p.reduce((acc, q) => add(acc, q), { x: 0, y: 0 });
    return mul(s, 1 / Math.max(1, p.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

export function pontoNoPoligono(pt: Pt, poli: Pt[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i];
    const b = poli[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

export function bbox(pts: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Distância de um ponto a um segmento, e o parâmetro t do ponto mais próximo. */
export function distSegmento(p: Pt, a: Pt, b: Pt): { d: number; t: number; q: Pt } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < EPS ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const q = lerp(a, b, t);
  return { d: dist(p, q), t, q };
}

/** Interseção de segmentos p1-p2 e p3-p4. Retorna t em p1-p2 e u em p3-p4. */
export function intersecaoSegmentos(p1: Pt, p2: Pt, p3: Pt, p4: Pt): { t: number; u: number } | null {
  const r = sub(p2, p1);
  const s = sub(p4, p3);
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return null;
  const qp = sub(p3, p1);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

/** Segmento S-P cruza algum bloqueador? (teste 2D, ignorando toques nas pontas). */
export function bloqueado(s: Pt, p: Pt, bloqueadores: Seg[]): boolean {
  const minX = Math.min(s.x, p.x);
  const maxX = Math.max(s.x, p.x);
  const minY = Math.min(s.y, p.y);
  const maxY = Math.max(s.y, p.y);
  for (const b of bloqueadores) {
    if (b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY) continue;
    const r = intersecaoSegmentos(s, p, b.a, b.b);
    if (r && r.t > 1e-6 && r.t < 1 - 1e-6) return true;
  }
  return false;
}

export interface Seg {
  a: Pt;
  b: Pt;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function seg(a: Pt, b: Pt): Seg {
  return {
    a,
    b,
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

/** Trechos de uma parede que sobram depois de tirar os vãos (portas e janelas não bloqueiam a luz). */
export function trechosSemVaos(p: Parede, aberturas: Abertura[]): [Pt, Pt][] {
  const L = dist(p.a, p.b);
  if (L < EPS) return [];
  const vaos = aberturas
    .filter((ab) => ab.paredeId === p.id)
    .map((ab) => {
      const meio = (ab.largura / L) / 2;
      return [Math.max(0, ab.t - meio), Math.min(1, ab.t + meio)] as [number, number];
    })
    .sort((x, y) => x[0] - y[0]);
  const out: [Pt, Pt][] = [];
  let t0 = 0;
  for (const [i0, i1] of vaos) {
    if (i0 > t0) out.push([lerp(p.a, p.b, t0), lerp(p.a, p.b, i0)]);
    t0 = Math.max(t0, i1);
  }
  if (t0 < 1) out.push([lerp(p.a, p.b, t0), p.b]);
  return out;
}

/** Segmentos que bloqueiam a luz numa vista: paredes (sem os vãos) e linhas de limite. */
export function bloqueadoresDaVista(v: Pick<Vista, "paredes" | "aberturas" | "linhas">): Seg[] {
  const out: Seg[] = [];
  for (const p of v.paredes) {
    if (!p.bloqueia) continue;
    for (const [a, b] of trechosSemVaos(p, v.aberturas)) out.push(seg(a, b));
  }
  for (const l of v.linhas as Linha[]) if (l.tipo === "limite") out.push(seg(l.a, l.b));
  return out;
}

/**
 * Polígono de visibilidade a partir de uma fonte, limitado a um raio.
 * Raios para as pontas dos segmentos (com pequeno desvio) e um círculo de raios para o contorno.
 */
export function poligonoVisibilidade(o: Pt, raio: number, bloq: Seg[], passosCirculo = 72): Pt[] {
  const perto = bloq.filter(
    (b) => b.maxX >= o.x - raio && b.minX <= o.x + raio && b.maxY >= o.y - raio && b.minY <= o.y + raio,
  );
  const angulos: number[] = [];
  for (let i = 0; i < passosCirculo; i++) angulos.push((i / passosCirculo) * Math.PI * 2);
  for (const b of perto) {
    for (const q of [b.a, b.b]) {
      if (dist(q, o) > raio * 1.5) continue;
      const a = Math.atan2(q.y - o.y, q.x - o.x);
      angulos.push(a - 1e-4, a, a + 1e-4);
    }
  }
  const norm2 = (a: number) => {
    let x = a % (Math.PI * 2);
    if (x < 0) x += Math.PI * 2;
    return x;
  };
  const lista = angulos.map(norm2).sort((x, y) => x - y);
  const out: Pt[] = [];
  for (const a of lista) {
    const d = { x: Math.cos(a), y: Math.sin(a) };
    let tMin = raio;
    for (const b of perto) {
      // raio o + t d contra segmento b.a-b.b
      const s = sub(b.b, b.a);
      const den = cross(d, s);
      if (Math.abs(den) < EPS) continue;
      const qp = sub(b.a, o);
      const t = cross(qp, s) / den;
      const u = cross(qp, d) / den;
      if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && t < tMin) tMin = t;
    }
    out.push({ x: o.x + d.x * tMin, y: o.y + d.y * tMin });
  }
  return out;
}

// ---------- Detecção do contorno do ambiente a partir das paredes ----------

const chave = (p: Pt, tol: number) => `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`;

/**
 * Acha o contorno fechado formado pelas paredes (maior face fechada).
 * Junta pontas a menos de 2 cm, remove pontas soltas e percorre as faces do grafo planar.
 * Retorna o polígono (anti-horário) ou null se as paredes não fecham.
 */
export function contornoDasParedes(paredes: Pick<Parede, "a" | "b">[], tol = 0.02): Pt[] | null {
  if (paredes.length < 3) return null;
  // vértices
  const idx = new Map<string, number>();
  const verts: Pt[] = [];
  const vid = (p: Pt) => {
    const k = chave(p, tol);
    let i = idx.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push({ ...p });
      idx.set(k, i);
    }
    return i;
  };
  // Quebra paredes nos pontos em que outras paredes encostam (T) para o grafo ficar planar.
  const segs: [Pt, Pt][] = [];
  for (const p of paredes) {
    const cortes: number[] = [0, 1];
    for (const q of paredes) {
      if (q === p) continue;
      for (const e of [q.a, q.b]) {
        const r = distSegmento(e, p.a, p.b);
        if (r.d < tol && r.t > 0.001 && r.t < 0.999) cortes.push(r.t);
      }
      const x = intersecaoSegmentos(p.a, p.b, q.a, q.b);
      if (x && x.t > 0.001 && x.t < 0.999) cortes.push(x.t);
    }
    cortes.sort((a, b) => a - b);
    for (let i = 0; i < cortes.length - 1; i++) {
      if (cortes[i + 1] - cortes[i] < 1e-6) continue;
      segs.push([lerp(p.a, p.b, cortes[i]), lerp(p.a, p.b, cortes[i + 1])]);
    }
  }
  const adj = new Map<number, Set<number>>();
  const liga = (i: number, j: number) => {
    if (i === j) return;
    if (!adj.has(i)) adj.set(i, new Set());
    if (!adj.has(j)) adj.set(j, new Set());
    adj.get(i)!.add(j);
    adj.get(j)!.add(i);
  };
  for (const [a, b] of segs) liga(vid(a), vid(b));
  // remove pontas soltas
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [v, viz] of adj) {
      if (viz.size <= 1) {
        for (const w of viz) adj.get(w)?.delete(v);
        adj.delete(v);
        mudou = true;
      }
    }
  }
  if (adj.size < 3) return null;
  // percorre faces: para cada meia-aresta, a próxima é a que vira mais à direita
  const visitada = new Set<string>();
  let melhor: Pt[] | null = null;
  let melhorArea = 0;
  for (const [u, viz] of adj) {
    for (const v of viz) {
      const k0 = `${u}>${v}`;
      if (visitada.has(k0)) continue;
      const face: number[] = [];
      let a = u;
      let b = v;
      let guarda = 0;
      while (guarda++ < 10000) {
        const k = `${a}>${b}`;
        if (visitada.has(k)) break;
        visitada.add(k);
        face.push(a);
        const pa = verts[a];
        const pb = verts[b];
        const ang0 = Math.atan2(pa.y - pb.y, pa.x - pb.x);
        let prox = -1;
        let menor = Infinity;
        for (const w of adj.get(b) ?? []) {
          if (w === a && (adj.get(b)?.size ?? 0) > 1) continue;
          const pw = verts[w];
          let ang = Math.atan2(pw.y - pb.y, pw.x - pb.x) - ang0;
          while (ang <= 1e-9) ang += Math.PI * 2;
          // menor giro anti-horário a partir da aresta de volta = face à esquerda
          if (ang < menor) {
            menor = ang;
            prox = w;
          }
        }
        if (prox < 0) break;
        a = b;
        b = prox;
      }
      if (face.length >= 3) {
        const poli = face.map((i) => verts[i]);
        const A = areaPoligono(poli);
        // Com esta regra de giro, as faces internas saem horárias (área negativa) e o contorno
        // externo de cada conjunto sai anti-horário (área positiva). O ambiente é o maior contorno externo.
        if (A > 0 && A > melhorArea) {
          melhorArea = A;
          melhor = poli;
        }
      }
    }
  }
  return melhor;
}

/** Simplifica pontos colineares do polígono. */
export function simplificar(p: Pt[], tol = 1e-4): Pt[] {
  if (p.length < 4) return p;
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[(i - 1 + p.length) % p.length];
    const b = p[i];
    const c = p[(i + 1) % p.length];
    if (Math.abs(cross(sub(b, a), sub(c, b))) > tol || dot(sub(b, a), sub(c, b)) < 0) out.push(b);
  }
  return out;
}

export function perimetro(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += dist(p[i], p[(i + 1) % p.length]);
  return s;
}

/** Maior lado do polígono (para C = A / L_max no índice K). */
export function maiorLado(p: Pt[]): number {
  let m = 0;
  for (let i = 0; i < p.length; i++) m = Math.max(m, dist(p[i], p[(i + 1) % p.length]));
  return m;
}

/** O polígono é um retângulo (4 lados em ângulo reto)? */
export function ehRetangulo(p: Pt[]): boolean {
  const s = simplificar(p);
  if (s.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = sub(s[(i + 1) % 4], s[i]);
    const b = sub(s[(i + 2) % 4], s[(i + 1) % 4]);
    if (Math.abs(dot(norm(a), norm(b))) > 0.01) return false;
  }
  return true;
}

/** Lados do retângulo (se for retângulo). */
export function ladosRetangulo(p: Pt[]): [number, number] | null {
  const s = simplificar(p);
  if (!ehRetangulo(s)) return null;
  return [dist(s[0], s[1]), dist(s[1], s[2])];
}

/** Desloca um polígono para dentro (aproximação por bissetrizes, boa para ambientes comuns). */
export function recuarPoligono(p: Pt[], d: number): Pt[] {
  const ccw = areaPoligono(p) > 0 ? p : [...p].reverse();
  const n = ccw.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ccw[(i - 1 + n) % n];
    const b = ccw[i];
    const c = ccw[(i + 1) % n];
    const n1 = perp(norm(sub(b, a))); // para dentro (esquerda num polígono anti-horário)
    const n2 = perp(norm(sub(c, b)));
    const bis = norm(add(n1, n2));
    const cosHalf = dot(bis, n1);
    const k = cosHalf > 0.2 ? d / cosHalf : d;
    out.push(add(b, mul(bis, k)));
  }
  return out;
}

export function rotacionar(p: Pt, centro: Pt, graus: number): Pt {
  const r = rad(graus);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - centro.x;
  const dy = p.y - centro.y;
  return { x: centro.x + dx * c - dy * s, y: centro.y + dx * s + dy * c };
}

export function uid(prefixo = ""): string {
  const r = Math.random().toString(36).slice(2, 10);
  return prefixo + Date.now().toString(36) + r;
}
