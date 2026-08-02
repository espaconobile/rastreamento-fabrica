import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

// pdfjs-dist (usado internamente pelo pdf-parse) referencia APIs de canvas do navegador
// (DOMMatrix/Path2D/ImageData) mesmo so extraindo texto, e elas nao existem em Node/serverless —
// causa "ReferenceError: DOMMatrix is not defined" ao carregar o modulo (visto em producao na
// Vercel; nao reproduzia num build local por causa de alguma diferenca de resolucao ESM/CJS do
// pacote pdf-parse). @napi-rs/canvas ja e dependencia transitiva do pdf-parse, entao so
// precisamos expor essas globais antes dele ser carregado — ver import no topo de
// lib/parseEtiquetas.ts, que precisa vir antes do import de "pdf-parse" pra rodar a tempo.
if (typeof globalThis.DOMMatrix === "undefined") {
  Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
}
