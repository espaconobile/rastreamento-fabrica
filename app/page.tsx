import Link from "next/link";
import { db } from "@/lib/db";
import { calcularProgressoLote } from "@/lib/loteProgress";
import ExcluirLoteButton from "@/app/components/ExcluirLoteButton";
import ArquivarLoteButton from "@/app/components/ArquivarLoteButton";
import AutoRefresh from "@/app/components/AutoRefresh";

// Sem isso, o Next.js pre-renderiza esta pagina como estatica no build (nao ha nenhuma chamada
// a fetch() com sinalizacao de cache que force o modo dinamico automaticamente so por usar o
// Prisma) e passa a servir sempre a mesma versao congelada de quando foi feito o deploy — lotes
// importados depois nunca apareceriam aqui.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });
  // Etapas de excecao (ex: "Peca Danificada") nao entram nas barras de progresso sequenciais —
  // elas nao sao uma etapa que toda peca deve "completar", entao ficam de fora daqui e viram um
  // aviso a parte (ver "danificadas" abaixo).
  const etapasProducao = etapas.filter((e) => !e.ehExcecao);
  const excecaoIds = new Set(etapas.filter((e) => e.ehExcecao).map((e) => e.id));

  const lotes = await db.lote.findMany({
    where: { arquivadoEm: null },
    include: {
      projeto: true,
      pecas: { include: { bipagens: { select: { etapaId: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalArquivados = await db.lote.count({ where: { arquivadoEm: { not: null } } });

  // Agrupa por cliente pra nao misturar os lotes de clientes diferentes numa lista so (ficava
  // confuso depois de algumas importacoes). Como "lotes" ja vem ordenado por createdAt desc, o
  // Map preserva essa ordem entre os grupos: o cliente com a importacao mais recente aparece
  // primeiro. Dentro de cada cliente, os ambientes ficam em ordem alfabetica (numerica-aware,
  // pra "10_QUARTO" nao vir antes de "2_SALA") em vez da ordem de chegada.
  const gruposPorCliente = new Map<string, typeof lotes>();
  for (const lote of lotes) {
    const lista = gruposPorCliente.get(lote.projeto.clienteNome) ?? [];
    lista.push(lote);
    gruposPorCliente.set(lote.projeto.clienteNome, lista);
  }
  for (const lotesDoCliente of gruposPorCliente.values()) {
    lotesDoCliente.sort((a, b) =>
      a.ambiente.localeCompare(b.ambiente, "pt-BR", { numeric: true, sensitivity: "base" })
    );
  }

  // Aviso compacto no dashboard, sem listar as pecas aqui (isso poluia a tela) — a lista
  // completa, com o botao de resolver, mora em /danificadas. Ver app/bipar pro equivalente
  // ja filtrado pelo cliente configurado naquela sessao.
  const totalDanificadas = await db.peca.count({
    where: { bipagens: { some: { etapa: { ehExcecao: true } } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-none lg:px-10 lg:py-14">
      <AutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 lg:text-5xl">Lotes em produção</h1>
        {totalArquivados > 0 && (
          <Link
            href="/arquivados"
            className="text-sm text-zinc-500 underline lg:text-xl"
          >
            Ver arquivados ({totalArquivados})
          </Link>
        )}
      </div>

      {totalDanificadas > 0 && (
        <Link
          href="/danificadas"
          className="mt-6 flex items-center justify-between gap-3 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 transition-colors hover:border-rose-400 lg:mt-8 lg:rounded-2xl lg:border-4 lg:p-8"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-rose-900 lg:gap-3 lg:text-3xl">
            ⚠ {totalDanificadas} peça{totalDanificadas > 1 ? "s" : ""} danificada
            {totalDanificadas > 1 ? "s" : ""} aguardando refazer
          </span>
          <span className="text-sm text-rose-700 underline lg:text-xl">ver todas →</span>
        </Link>
      )}

      {lotes.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500 lg:text-xl">
          Nenhum lote importado ainda.{" "}
          <Link href="/importar" className="text-blue-600 underline">
            Importe um projeto
          </Link>{" "}
          para começar.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-8 lg:mt-10 lg:gap-14">
        {[...gruposPorCliente.entries()].map(([clienteNome, lotesDoCliente]) => (
          <section key={clienteNome}>
            <h2 className="text-lg font-semibold text-zinc-700 lg:text-3xl">{clienteNome}</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-[repeat(auto-fit,minmax(420px,1fr))] lg:items-start lg:gap-6">
              {lotesDoCliente.map((lote) => {
                const total = lote.pecas.length;
                const progresso = calcularProgressoLote(lote.pecas, etapasProducao);
                const danificadas = lote.pecas.filter((p) =>
                  p.bipagens.some((b) => excecaoIds.has(b.etapaId))
                ).length;
                // Concluido = toda peca ja passou pela ultima etapa de producao (Separacao). So
                // um indicador visual pra ajudar a decidir quando arquivar — nao bloqueia nem
                // exige nada.
                const ultimaEtapa = progresso[progresso.length - 1];
                const concluido = total > 0 && ultimaEtapa?.concluidas === total;

                return (
                  <Link
                    key={lote.id}
                    href={`/lotes/${lote.id}`}
                    className={`block rounded-lg border p-4 transition-colors lg:rounded-2xl lg:border-2 lg:p-7 ${
                      concluido
                        ? "border-green-300 bg-green-50 hover:border-green-400"
                        : "border-zinc-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-zinc-900 lg:text-2xl">{lote.ambiente}</p>
                      <div className="flex items-center gap-3">
                        {concluido && (
                          <p className="text-xs font-medium text-green-600 lg:text-lg">
                            ✓ concluído
                          </p>
                        )}
                        {danificadas > 0 && (
                          <p className="text-xs font-medium text-rose-600 lg:text-lg">
                            ⚠ {danificadas} danificada{danificadas > 1 ? "s" : ""}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 lg:text-lg">{total} peças</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-4">
                      <ArquivarLoteButton loteId={lote.id} arquivado={false} />
                      <ExcluirLoteButton
                        loteId={lote.id}
                        nomeLote={`${clienteNome} · ${lote.ambiente}`}
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
          </section>
        ))}
      </div>
    </div>
  );
}
