// Copia o worker do pdf.js para public/, para o navegador carregar o PDF de fundo.
import { copyFileSync, existsSync } from "node:fs";
const origem = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (existsSync(origem)) copyFileSync(origem, "public/pdf.worker.min.mjs");
