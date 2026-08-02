import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lote = await db.lote.findUnique({ where: { id } });
  if (!lote) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  // Cascade (schema.prisma: Peca -> Lote e Bipagem -> Peca) apaga junto todas as pecas e o
  // historico de bipagem deste lote.
  await db.lote.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
