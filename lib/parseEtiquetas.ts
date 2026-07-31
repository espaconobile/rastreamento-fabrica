import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

// Sob o Turbopack (Next.js), a resolucao automatica do worker do pdfjs-dist falha
// (tenta importar um caminho dentro de .next/ que nao existe). Apontamos explicitamente
// para o arquivo do worker dentro de node_modules para evitar isso.
PDFParse.setWorker(
  pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs")
  ).href
);

export interface PecaExtraida {
  codigo: string;
  chapaNum: number | null;
  posicaoNoNesting: number | null;
  ambiente: string;
  moduloCodigo: string;
  descricaoPeca: string;
  comprimento: number | null;
  profundidade: number | null;
  espessura: number | null;
  chapaMaterial: string | null;
}

export interface PaginaComErro {
  pagina: number;
  motivo: string;
}

export interface ParseEtiquetasResult {
  clienteNome: string;
  pecas: PecaExtraida[];
  paginasIgnoradas: number;
  paginasComErro: PaginaComErro[];
}

// A ordem dos campos dentro do PDF nao segue a ordem visual da etiqueta (o extrator le pela
// ordem dos objetos de texto no PDF, nao pela posicao na pagina), entao o parser identifica
// cada campo pelo seu rotulo, independente da ordem em que aparece.
const CLIENTE_RE = /^Cliente:\s*(.+)$/i;
const PROJETO_RE = /^Projeto:\s*(.+)$/i;
// "Módulo" e "Peça" tem acentos que podem variar por encoding, por isso usamos "." no lugar da vogal acentuada.
const MODULO_RE = /^M.dulo:\s*(.+)$/i;
const PECA_RE = /^Pe.a:\s*(.+)$/i;
const DIMEN_RE = /^Dimen:\s*(.+)$/i;
const CHAPA_RE = /^Chapa:\s*(.+)$/i;
const CHAPA_NUM_RE = /^Ch:\s*(\d+)$/i;
const POSICAO_RE = /^P\S{1,2}:\s*(\d+)$/i;
const SOBRA_RE = /^Sobra de Material/i;

function parseDimensoes(dimenLine: string): [number | null, number | null, number | null] {
  const partes = dimenLine
    .split(/x/i)
    .map((v) => parseFloat(v.trim().replace(",", ".")))
    .map((v) => (Number.isFinite(v) ? v : null));
  return [partes[0] ?? null, partes[1] ?? null, partes[2] ?? null];
}

export async function parseEtiquetasPdf(buffer: Buffer): Promise<ParseEtiquetasResult> {
  const parser = new PDFParse({ data: buffer });
  let result;
  try {
    result = await parser.getText();
  } finally {
    await parser.destroy();
  }

  const pecas: PecaExtraida[] = [];
  const paginasComErro: PaginaComErro[] = [];
  let paginasIgnoradas = 0;
  let clienteNome = "";

  for (const page of result.pages) {
    // O texto extraido segue a ordem dos objetos no PDF (nao a ordem visual), e alguns campos
    // (Ch/Pç) ficam separados por tab na mesma "linha" visual, entao dividimos por \r, \n e \t.
    const fragmentos = page.text
      .split(/[\r\n\t]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (fragmentos.length === 0) continue;

    if (SOBRA_RE.test(fragmentos[0])) {
      paginasIgnoradas++;
      continue;
    }

    let cliente = "";
    let ambiente = "";
    let moduloCodigo = "";
    let descricaoPeca = "";
    let dimenLine = "";
    let chapaMaterial: string | null = null;
    let chapaNumStr = "";
    let posicaoStr = "";
    const candidatosCodigo: string[] = [];

    for (const fragmento of fragmentos) {
      let m: RegExpMatchArray | null;

      if ((m = fragmento.match(CLIENTE_RE))) {
        cliente = m[1].trim();
      } else if ((m = fragmento.match(PROJETO_RE))) {
        ambiente = m[1].trim();
      } else if ((m = fragmento.match(MODULO_RE))) {
        moduloCodigo = m[1].trim();
      } else if ((m = fragmento.match(PECA_RE))) {
        descricaoPeca = m[1].trim();
      } else if ((m = fragmento.match(DIMEN_RE))) {
        dimenLine = m[1].trim();
      } else if ((m = fragmento.match(CHAPA_RE))) {
        chapaMaterial = m[1].trim();
      } else if ((m = fragmento.match(CHAPA_NUM_RE))) {
        chapaNumStr = m[1];
      } else if ((m = fragmento.match(POSICAO_RE))) {
        posicaoStr = m[1];
      } else if (/^\d+$/.test(fragmento)) {
        // Unico fragmento sem rotulo: e o valor legivel do codigo de barras.
        candidatosCodigo.push(fragmento);
      }
    }

    if (!clienteNome && cliente) clienteNome = cliente;

    const codigo = candidatosCodigo[0] ?? "";

    if (!codigo || !moduloCodigo || !ambiente) {
      paginasComErro.push({
        pagina: page.num,
        motivo: `Campos obrigatórios ausentes (código=${codigo || "?"}, módulo=${moduloCodigo || "?"}, ambiente=${ambiente || "?"})`,
      });
      continue;
    }

    const [comprimento, profundidade, espessura] = parseDimensoes(dimenLine);

    pecas.push({
      codigo,
      chapaNum: chapaNumStr ? parseInt(chapaNumStr, 10) : null,
      posicaoNoNesting: posicaoStr ? parseInt(posicaoStr, 10) : null,
      ambiente,
      moduloCodigo,
      descricaoPeca,
      comprimento,
      profundidade,
      espessura,
      chapaMaterial,
    });
  }

  return { clienteNome, pecas, paginasIgnoradas, paginasComErro };
}
