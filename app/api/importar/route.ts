import { NextRequest, NextResponse } from "next/server";
import { del, get } from "@vercel/blob";
import { db } from "@/lib/db";
import { parseEtiquetasPdf, type PecaExtraida } from "@/lib/parseEtiquetas";

export async function POST(request: NextRequest) {
  const { blobUrl, fileName } = (await request.json()) as {
    blobUrl?: string;
    fileName?: string;
  };

  if (!blobUrl || !fileName) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Envie o arquivo Etiquetas.pdf exportado do Promob (formato PDF)." },
      { status: 400 }
    );
  }

  let buffer: Buffer;
  try {
    const blobResult = await get(blobUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!blobResult?.stream) throw new Error("blob não encontrado");
    buffer = Buffer.from(await new Response(blobResult.stream).arrayBuffer());
  } catch (err) {
    console.error("Falha ao ler blob enviado:", err);
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo enviado. Tente novamente." },
      { status: 502 }
    );
  }
  await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});

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

  const clienteNome = parsed.clienteNome || "Não identificado";

  // Reaproveita o Projeto do mesmo cliente se ja existir, em vez de sempre criar um novo — assim
  // reimportar um Etiquetas.pdf corrigido/complementar (ex: a primeira importacao ficou
  // incompleta) atualiza os lotes/pecas existentes em vez de duplicar tudo, o que perderia o
  // historico de bipagem ja registrado nas pecas antigas (elas ficariam presas num Projeto/Lote
  // orfao enquanto o Painel passaria a mostrar um lote novo, zerado, pro mesmo cliente/ambiente).
  let projeto = await db.projeto.findFirst({
    where: { clienteNome },
    orderBy: { dataImportacao: "desc" },
  });
  if (projeto) {
    await db.projeto.update({ where: { id: projeto.id }, data: { nomeArquivoOrigem: fileName } });
  } else {
    projeto = await db.projeto.create({ data: { clienteNome, nomeArquivoOrigem: fileName } });
  }

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
    novas: number;
    atualizadas: number;
    ignoradas: number;
    pilhas: number;
  }[] = [];

  for (const [ambiente, pecasDoLote] of porAmbiente) {
    // Mesmo raciocinio do Projeto acima: reaproveita o lote existente (mesmo cliente + ambiente)
    // em vez de criar um novo, preservando o id do lote e, por tabela, o historico de bipagem das
    // pecas que ja existiam nele.
    const lote = await db.lote.upsert({
      where: { projetoId_ambiente: { projetoId: projeto.id, ambiente } },
      update: {},
      create: { projetoId: projeto.id, ambiente },
    });

    // Snapshot de quais codigos ja existiam neste lote ANTES desta importacao, so pra reportar
    // ao usuario quantas pecas eram novas vs. ja existentes (ver resumoLotes abaixo) — nao afeta
    // a logica de gravacao em si (o upsert de peca cuida disso sozinho).
    const codigosExistentes = new Set(
      (await db.peca.findMany({ where: { loteId: lote.id }, select: { codigo: true } })).map(
        (p) => p.codigo
      )
    );

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
    let novas = 0;
    let atualizadas = 0;
    for (const peca of pecasDoLote) {
      const dados = {
        chapaNum: peca.chapaNum,
        posicaoNoNesting: peca.posicaoNoNesting,
        moduloCodigo: peca.moduloCodigo,
        pilha: pilhaPorChave.get(chavePilha(peca))!,
        descricaoPeca: peca.descricaoPeca,
        comprimento: peca.comprimento,
        profundidade: peca.profundidade,
        espessura: peca.espessura,
        chapaMaterial: peca.chapaMaterial,
      };
      try {
        // upsert em vez de create: se a peca ja existia neste lote (mesmo codigo, de uma
        // importacao anterior), atualiza os dados dela em vez de duplicar — o id (e o historico
        // de bipagem que referencia esse id) e preservado.
        await db.peca.upsert({
          where: { loteId_codigo: { loteId: lote.id, codigo: peca.codigo } },
          update: dados,
          create: { loteId: lote.id, codigo: peca.codigo, ...dados },
        });
        if (codigosExistentes.has(peca.codigo)) atualizadas++;
        else novas++;
      } catch {
        ignoradas++;
      }
    }

    resumoLotes.push({
      loteId: lote.id,
      ambiente,
      total: pecasDoLote.length - ignoradas,
      novas,
      atualizadas,
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
