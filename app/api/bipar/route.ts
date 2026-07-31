import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface BiparBody {
  codigo?: string;
  etapaId?: string;
  estacaoNome?: string;
  loteId?: string; // usado para desambiguar quando o codigo existe em mais de um lote
}

export async function POST(request: NextRequest) {
  const body: BiparBody = await request.json();
  const codigo = body.codigo?.trim();
  const etapaId = body.etapaId?.trim();
  const estacaoNome = body.estacaoNome?.trim();

  if (!codigo || !etapaId || !estacaoNome) {
    return NextResponse.json(
      { status: "ERRO", mensagem: "Código, etapa e estação são obrigatórios." },
      { status: 400 }
    );
  }

  const etapa = await db.etapa.findUnique({ where: { id: etapaId } });
  if (!etapa) {
    return NextResponse.json({ status: "ERRO", mensagem: "Etapa inválida." }, { status: 400 });
  }

  // O mesmo codigo pode, raramente, existir em mais de um lote (identificadores do Promob nao
  // sao 100% globalmente unicos). Se houver ambiguidade e nenhum loteId foi informado para
  // desambiguar, devolvemos os candidatos para o operador escolher manualmente.
  const candidatos = await db.peca.findMany({
    where: { codigo, ...(body.loteId ? { loteId: body.loteId } : {}) },
    include: { lote: { include: { projeto: true } } },
  });

  if (candidatos.length === 0) {
    return NextResponse.json({
      status: "NAO_ENCONTRADA",
      mensagem: "Nenhuma peça encontrada com esse código. Verifique se o projeto foi importado.",
    });
  }

  if (candidatos.length > 1) {
    return NextResponse.json({
      status: "AMBIGUA",
      mensagem: "Este código corresponde a mais de uma peça em produção. Selecione o lote correto.",
      candidatos: candidatos.map((p) => ({
        pecaId: p.id,
        loteId: p.loteId,
        ambiente: p.lote.ambiente,
        clienteNome: p.lote.projeto.clienteNome,
        moduloCodigo: p.moduloCodigo,
        pilha: p.pilha,
        descricaoPeca: p.descricaoPeca,
      })),
    });
  }

  const peca = candidatos[0];

  const bipagensAnteriores = await db.bipagem.findMany({
    where: { pecaId: peca.id },
    include: { etapa: true },
  });

  const jaBipadaNestaEtapa = bipagensAnteriores.some((b) => b.etapaId === etapaId);
  const etapaAnteriorObrigatoria =
    etapa.ordem > 1
      ? await db.etapa.findUnique({ where: { ordem: etapa.ordem - 1 } })
      : null;
  const passouPelaEtapaAnterior = etapaAnteriorObrigatoria
    ? bipagensAnteriores.some((b) => b.etapaId === etapaAnteriorObrigatoria.id)
    : true;

  let status: "OK" | "ALERTA_DUPLICADO" | "ALERTA_FORA_DE_ORDEM";
  let mensagem: string;

  if (jaBipadaNestaEtapa) {
    status = "ALERTA_DUPLICADO";
    mensagem = `Esta peça já havia sido bipada em "${etapa.nome}".`;
  } else if (!passouPelaEtapaAnterior) {
    status = "ALERTA_FORA_DE_ORDEM";
    mensagem = `Atenção: esta peça ainda não foi bipada em "${etapaAnteriorObrigatoria?.nome}".`;
  } else {
    status = "OK";
    mensagem = "Bipagem registrada.";
  }

  await db.bipagem.create({
    data: { pecaId: peca.id, etapaId, estacaoNome, status },
  });

  const totalNaEtapa = await db.bipagem.count({
    where: { etapaId, peca: { loteId: peca.loteId }, status: { not: "ALERTA_DUPLICADO" } },
  });
  const totalNoLote = await db.peca.count({ where: { loteId: peca.loteId } });

  // A instrucao de pilha (onde fisicamente deixar a peca) so faz sentido na etapa marcada com
  // usaPilha=true (hoje, "Separação") — nas demais etapas o campo nem e calculado/enviado.
  let progressoPilha: { concluidas: number; total: number } | undefined;
  if (etapa.usaPilha) {
    const totalNaPilha = await db.peca.count({
      where: { loteId: peca.loteId, moduloCodigo: peca.moduloCodigo },
    });
    const bipadasNaPilhaNestaEtapa = await db.bipagem.count({
      where: {
        etapaId,
        status: { not: "ALERTA_DUPLICADO" },
        peca: { loteId: peca.loteId, moduloCodigo: peca.moduloCodigo },
      },
    });
    progressoPilha = { concluidas: bipadasNaPilhaNestaEtapa, total: totalNaPilha };
  }

  return NextResponse.json({
    status,
    mensagem,
    peca: {
      moduloCodigo: peca.moduloCodigo,
      pilha: etapa.usaPilha ? peca.pilha : undefined,
      descricaoPeca: peca.descricaoPeca,
      comprimento: peca.comprimento,
      profundidade: peca.profundidade,
      chapaMaterial: peca.chapaMaterial,
    },
    lote: { id: peca.loteId },
    progresso: { totalNaEtapa, totalNoLote },
    progressoPilha,
  });
}
