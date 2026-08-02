import Link from "next/link";
import { db } from "@/lib/db";
import { calcularProgressoLote } from "@/lib/loteProgress";
import ExcluirLoteButton from "@/app/components/ExcluirLoteButton";
import AutoRefresh from "@/app/components/AutoRefresh";

export default async function HomePage() {
  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });
  // Etapas de excecao (ex: "Peca Danificada") nao entram nas barras de progresso sequenciais —
  // elas nao sao uma etapa que toda peca deve "completar", entao ficam de fora daqui e viram um
  // aviso a parte (ver "danificadas" abaixo).
  const etapasProducao = etapas.filter((e) => !e.ehExcecao);
  const excecaoIds = new Set(etapas.filter((e) => e.ehExcecao).map((e) => e.id));

  const lotes = await db.lote.findMany({
    include: {
      projeto: true,
      pecas: { include: { bipagens: { select: { etapaId: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-6xl lg:px-10 lg:py-14">
      <AutoRefresh />
      <h1 className="text-2xl font-semibold text-zinc-900 lg:text-5xl">Lotes em produção</h1>

      {lotes.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500 lg:text-xl">
          Nenhum lote importado ainda.{" "}
          <Link href="/importar" className="text-blue-600 underline">
            Importe um projeto
          </Link>{" "}
          para começar.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 lg:mt-10 lg:gap-6">
        {lotes.map((lote) => {
          const total = lote.pecas.length;
          const progresso = calcularProgressoLote(lote.pecas, etapasProducao);
          const danificadas = lote.pecas.filter((p) =>
            p.bipagens.some((b) => excecaoIds.has(b.etapaId))
          ).length;

          return (
            <Link
              key={lote.id}
              href={`/lotes/${lote.id}`}
              className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-blue-300 lg:rounded-2xl lg:border-2 lg:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-zinc-900 lg:text-2xl">
                  {lote.projeto.clienteNome} · {lote.ambiente}
                </p>
                <div className="flex items-center gap-3">
                  {danificadas > 0 && (
                    <p className="text-xs font-medium text-rose-600 lg:text-lg">
                      ⚠ {danificadas} danificada{danificadas > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 lg:text-lg">{total} peças</p>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <ExcluirLoteButton
                  loteId={lote.id}
                  nomeLote={`${lote.projeto.clienteNome} · ${lote.ambiente}`}
                />
              </div>
              <div className="mt-3 flex flex-col gap-1.5 lg:mt-5 lg:gap-3">
                {progresso.map((et) => (
                  <div key={et.etapaId} className="flex items-center gap-2 text-xs lg:gap-4 lg:text-lg">
                    <span className="w-44 shrink-0 text-zinc-600 lg:w-64">{et.nome}</span>
                    <div className="h-2 flex-1 rounded-full bg-zinc-100 lg:h-4">
                      <div
                        className="h-2 rounded-full bg-blue-600 lg:h-4"
                        style={{ width: `${total ? (et.concluidas / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-zinc-500 lg:w-24">
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
