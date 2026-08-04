import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lote = await db.lote.findUnique({ where: { id } });
  if (!lote) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  await db.lote.update({ where: { id }, data: { arquivadoEm: new Date() } });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lote = await db.lote.findUnique({ where: { id } });
  if (!lote) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  await db.lote.update({ where: { id }, data: { arquivadoEm: null } });

  return NextResponse.json({ ok: true });
}
