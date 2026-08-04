import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import EtiquetaPrintView from "@/app/components/EtiquetaPrintView";

export default async function EtiquetaPage({
  params,
}: {
  params: Promise<{ id: string; pecaId: string }>;
}) {
  const { id, pecaId } = await params;

  const peca = await db.peca.findUnique({
    where: { id: pecaId },
    include: { lote: { include: { projeto: true } } },
  });

  if (!peca || peca.loteId !== id) notFound();

  return (
    <EtiquetaPrintView
      peca={{
        codigo: peca.codigo,
        moduloCodigo: peca.moduloCodigo,
        descricaoPeca: peca.descricaoPeca,
        comprimento: peca.comprimento,
        profundidade: peca.profundidade,
        chapaMaterial: peca.chapaMaterial,
        chapaNum: peca.chapaNum,
        posicaoNoNesting: peca.posicaoNoNesting,
        clienteNome: peca.lote.projeto.clienteNome,
        ambiente: peca.lote.ambiente,
      }}
    />
  );
}
