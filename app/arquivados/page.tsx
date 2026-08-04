import Link from "next/link";
import { db } from "@/lib/db";
import ArquivarLoteButton from "@/app/components/ArquivarLoteButton";
import ExcluirLoteButton from "@/app/components/ExcluirLoteButton";

// Mesmo motivo do app/page.tsx: pagina de path fixo com consulta via Prisma, sem fetch() pra
// sinalizar dinamismo pro Next.js sozinho.
export const dynamic = "force-dynamic";

export default async function ArquivadosPage() {
  const lotes = await db.lote.findMany({
    where: { arquivadoEm: { not: null } },
    include: { projeto: true, pecas: { select: { id: true } } },
    orderBy: { arquivadoEm: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-none lg:px-10 lg:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 lg:text-5xl">Lotes arquivados</h1>
        <Link href="/" className="text-sm text-blue-600 underline lg:text-xl">
          Voltar ao painel
        </Link>
      </div>

      {lotes.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500 lg:text-xl">Nenhum lote arquivado.</p>
      )}

      <div className="mt-6 flex flex-col gap-3 lg:mt-10 lg:gap-4">
        {lotes.map((lote) => (
          <div
            key={lote.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 lg:rounded-2xl lg:border-2 lg:p-6"
          >
            <div>
              <Link href={`/lotes/${lote.id}`} className="font-medium text-zinc-900 hover:underline lg:text-xl">
                {lote.projeto.clienteNome} · {lote.ambiente}
              </Link>
              <p className="text-xs text-zinc-500 lg:text-base">
                {lote.pecas.length} peças · arquivado em{" "}
                {lote.arquivadoEm?.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ArquivarLoteButton loteId={lote.id} arquivado={true} />
              <ExcluirLoteButton
                loteId={lote.id}
                nomeLote={`${lote.projeto.clienteNome} · ${lote.ambiente}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
