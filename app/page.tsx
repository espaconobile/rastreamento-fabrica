import Link from "next/link";
import { db } from "@/lib/db";
import { calcularProgressoLote } from "@/lib/loteProgress";

export default async function HomePage() {
  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });
  const lotes = await db.lote.findMany({
    include: {
      projeto: true,
      pecas: { include: { bipagens: { select: { etapaId: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Lotes em produção</h1>
        <div className="flex gap-3">
          <Link
            href="/importar"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
          >
            Importar projeto
          </Link>
          <Link
            href="/bipar"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Bipar peças
          </Link>
        </div>
      </div>

      {lotes.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          Nenhum lote importado ainda.{" "}
          <Link href="/importar" className="underline">
            Importe um projeto
          </Link>{" "}
          para começar.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {lotes.map((lote) => {
          const total = lote.pecas.length;
          const progresso = calcularProgressoLote(lote.pecas, etapas);

          return (
            <Link
              key={lote.id}
              href={`/lotes/${lote.id}`}
              className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-400"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">
                  {lote.projeto.clienteNome} · {lote.ambiente}
                </p>
                <p className="text-xs text-zinc-500">{total} peças</p>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {progresso.map((et) => (
                  <div key={et.etapaId} className="flex items-center gap-2 text-xs">
                    <span className="w-44 shrink-0 text-zinc-600">{et.nome}</span>
                    <div className="h-2 flex-1 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-zinc-900"
                        style={{ width: `${total ? (et.concluidas / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-zinc-500">
                      {et.concluidas}/{total}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
