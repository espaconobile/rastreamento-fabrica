import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseEtiquetasPdf, type PecaExtraida } from "@/lib/parseEtiquetas";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Envie o arquivo Etiquetas.pdf exportado do Promob (formato PDF)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseEtiquetasPdf(buffer);
  } catch (err) {
    console.error("Falha ao processar PDF de etiquetas:", err);
    return NextResponse.json(
      {
        error: "Não foi possível ler este PDF. Verifique se é o arquivo de etiquetas correto.",
        detalhe: err instanceof Error ? err.message : String(err),
      },
      { status: 422 }
    );
  }

  if (parsed.pecas.length === 0) {
    return NextResponse.json(
      {
        error: "Não foi possível reconhecer nenhuma etiqueta neste PDF.",
        paginasComErro: parsed.paginasComErro,
      },
      { status: 422 }
    );
  }

  const projeto = await db.projeto.create({
    data: {
      clienteNome: parsed.clienteNome || "Não identificado",
      nomeArquivoOrigem: file.name,
    },
  });

  const porAmbiente = new Map<string, PecaExtraida[]>();
  for (const peca of parsed.pecas) {
    const lista = porAmbiente.get(peca.ambiente) ?? [];
    lista.push(peca);
    porAmbiente.set(peca.ambiente, lista);
  }

  const resumoLotes: {
    loteId: string;
    ambiente: string;
    total: number;
    ignoradas: number;
    pilhas: number;
  }[] = [];

  for (const [ambiente, pecasDoLote] of porAmbiente) {
    const lote = await db.lote.create({
      data: { projetoId: projeto.id, ambiente },
    });

    // Um modulo so tem sentido de agrupamento fisico quando tem mais de uma peca; quando o
    // modulo tem uma unica peca no lote, ela nao esta de fato vinculada a nenhuma outra peca
    // (peca "solta"), entao todas as pecas soltas do lote (de modulos diferentes) vao para uma
    // unica pilha comum de avulsas, em vez de gerar uma pilha por peca no chao de fabrica.
    const contagemPorModulo = new Map<string, number>();
    for (const peca of pecasDoLote) {
      contagemPorModulo.set(peca.moduloCodigo, (contagemPorModulo.get(peca.moduloCodigo) ?? 0) + 1);
    }
    const CHAVE_AVULSAS = "__AVULSAS__";
    const chavePilha = (peca: PecaExtraida) =>
      contagemPorModulo.get(peca.moduloCodigo) === 1 ? CHAVE_AVULSAS : peca.moduloCodigo;

    // Cada modulo distinto (e o grupo de avulsas) vira uma pilha de separacao, numerada na ordem
    // em que aparecem no PDF (mesma ordem em que as pecas saem cortadas/impressas).
    const pilhaPorChave = new Map<string, number>();
    for (const peca of pecasDoLote) {
      const chave = chavePilha(peca);
      if (!pilhaPorChave.has(chave)) {
        pilhaPorChave.set(chave, pilhaPorChave.size + 1);
      }
    }

    let ignoradas = 0;
    for (const peca of pecasDoLote) {
      try {
        await db.peca.create({
          data: {
            loteId: lote.id,
            codigo: peca.codigo,
            chapaNum: peca.chapaNum,
            posicaoNoNesting: peca.posicaoNoNesting,
            moduloCodigo: peca.moduloCodigo,
            pilha: pilhaPorChave.get(chavePilha(peca))!,
            descricaoPeca: peca.descricaoPeca,
            comprimento: peca.comprimento,
            profundidade: peca.profundidade,
            espessura: peca.espessura,
            chapaMaterial: peca.chapaMaterial,
          },
        });
      } catch {
        ignoradas++;
      }
    }

    resumoLotes.push({
      loteId: lote.id,
      ambiente,
      total: pecasDoLote.length - ignoradas,
      ignoradas,
      pilhas: pilhaPorChave.size,
    });
  }

  return NextResponse.json({
    projetoId: projeto.id,
    clienteNome: projeto.clienteNome,
    totalPecas: parsed.pecas.length,
    paginasIgnoradas: parsed.paginasIgnoradas,
    paginasComErro: parsed.paginasComErro,
    lotes: resumoLotes,
  });
}
