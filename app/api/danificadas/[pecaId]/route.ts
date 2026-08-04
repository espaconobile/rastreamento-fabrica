import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pecaId: string }> }
) {
  const { pecaId } = await params;

  const peca = await db.peca.findUnique({ where: { id: pecaId }, include: { lote: true } });
  if (!peca) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  // "Resolver" uma peca danificada e apagar a(s) bipagem(ns) de excecao dela — ela deixa de
  // aparecer na lista de danificadas, mas nenhuma outra etapa e mexida: o operador ainda precisa
  // biper a peca normalmente (Corte/Coladeira/Separacao) conforme ela realmente for refeita.
  await db.bipagem.deleteMany({ where: { pecaId, etapa: { ehExcecao: true } } });

  // Uma pilha e "de avulsas" quando junta pecas de mais de um modulo distinto (mesmo criterio de
  // app/api/bipar/route.ts) — o cliente usa isso pra decidir se mostra o codigo da peca em
  // destaque no painel de pilha.
  const pecasDaPilha = await db.peca.findMany({
    where: { loteId: peca.loteId, pilha: peca.pilha },
    select: { moduloCodigo: true },
  });
  const pilhaAvulsas = new Set(pecasDaPilha.map((p) => p.moduloCodigo)).size > 1;

  return NextResponse.json({
    ok: true,
    peca: {
      codigo: peca.codigo,
      moduloCodigo: peca.moduloCodigo,
      pilha: peca.pilha,
      descricaoPeca: peca.descricaoPeca,
      comprimento: peca.comprimento,
      profundidade: peca.profundidade,
      chapaMaterial: peca.chapaMaterial,
      ambiente: peca.lote.ambiente,
    },
    pilhaAvulsas,
  });
}
