import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const clienteNome = request.nextUrl.searchParams.get("cliente")?.trim();
  if (!clienteNome) {
    return NextResponse.json({ error: "Cliente é obrigatório." }, { status: 400 });
  }

  // Uma peca "danificada" e qualquer uma com bipagem registrada numa etapa de excecao (hoje, so
  // "Peça Danificada") que ainda nao foi resolvida — resolver apaga essa bipagem (ver
  // app/api/danificadas/[pecaId]/route.ts), entao a mera presenca dela aqui já significa pendente.
  const pecas = await db.peca.findMany({
    where: {
      lote: { projeto: { clienteNome } },
      bipagens: { some: { etapa: { ehExcecao: true } } },
    },
    include: { lote: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    danificadas: pecas.map((p) => ({
      pecaId: p.id,
      codigo: p.codigo,
      moduloCodigo: p.moduloCodigo,
      descricaoPeca: p.descricaoPeca,
      ambiente: p.lote.ambiente,
    })),
  });
}
