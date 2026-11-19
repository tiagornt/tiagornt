// PDF ou imagem como fundo calibrado (para decalcar). Sem reconhecimento automático de paredes.

export const LIMITE_FUNDO = 15 * 1024 * 1024;

const lerComoDataUrl = (f: Blob) =>
  new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => erro(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(f);
  });

const tamanhoImagem = (url: string) =>
  new Promise<{ w: number; h: number }>((ok, erro) => {
    const img = new Image();
    img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => erro(new Error("Imagem inválida."));
    img.src = url;
  });

/** Confere o tipo real pelo começo do arquivo (não só pela extensão). */
export async function tipoReal(f: File): Promise<"pdf" | "png" | "jpg" | "webp" | "dxf" | "dwg" | null> {
  const cab = new Uint8Array(await f.slice(0, 16).arrayBuffer());
  const txt = String.fromCharCode(...cab);
  if (txt.startsWith("%PDF")) return "pdf";
  if (cab[0] === 0x89 && txt.slice(1, 4) === "PNG") return "png";
  if (cab[0] === 0xff && cab[1] === 0xd8) return "jpg";
  if (txt.startsWith("RIFF") && txt.slice(8, 12) === "WEBP") return "webp";
  if (txt.startsWith("AC10")) return "dwg";
  if (/\.dxf$/i.test(f.name)) return "dxf";
  return null;
}

export async function quantasPaginasPdf(f: File): Promise<number> {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  return doc.numPages;
}

async function carregarPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/** Rasteriza uma página do PDF (lado maior perto de 3000 px) e devolve como PNG. */
export async function paginaPdfComoImagem(f: File, pagina = 1): Promise<{ dataUrl: string; w: number; h: number }> {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  const pg = await doc.getPage(Math.min(Math.max(1, pagina), doc.numPages));
  const base = pg.getViewport({ scale: 1 });
  const escala = Math.min(4, 3000 / Math.max(base.width, base.height));
  const vp = pg.getViewport({ scale: escala });
  const cv = document.createElement("canvas");
  cv.width = Math.round(vp.width);
  cv.height = Math.round(vp.height);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  return { dataUrl: cv.toDataURL("image/png"), w: cv.width, h: cv.height };
}

export async function imagemComoFundo(f: File): Promise<{ dataUrl: string; w: number; h: number }> {
  const url = await lerComoDataUrl(f);
  const t = await tamanhoImagem(url);
  return { dataUrl: url, w: t.w, h: t.h };
}
