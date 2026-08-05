import Link from "next/link";
import { db } from "@/lib/db";
import { calcularProgressoLote } from "@/lib/loteProgress";
import ExcluirLoteButton from "@/app/components/ExcluirLoteButton";
import ArquivarLoteButton from "@/app/components/ArquivarLoteButton";
import ResolverDanificadaButton from "@/app/components/ResolverDanificadaButton";
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

  // Painel global de pecas danificadas: reune de todos os clientes/lotes de uma vez, pra quem
  // esta olhando o monitor/TV do chao de fabrica ver na hora o que precisa ser refeito, sem
  // precisar abrir lote por lote ou estar bipando um cliente especifico (ver app/bipar, que tem a
  // mesma lista mas so do cliente configurado naquela sessao).
  const pecasDanificadas = await db.peca.findMany({
    where: { bipagens: { some: { etapa: { ehExcecao: true } } } },
    include: { lote: { include: { projeto: true } } },
    orderBy: { createdAt: "asc" },
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

      {pecasDanificadas.length > 0 && (
        <div className="mt-6 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 lg:mt-8 lg:rounded-2xl lg:border-4 lg:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-900 lg:gap-3 lg:text-3xl">
            ⚠ Peças danificadas aguardando refazer ({pecasDanificadas.length})
          </p>
          <ul className="mt-3 flex flex-col gap-2 lg:mt-6 lg:gap-4">
            {pecasDanificadas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-white px-4 py-3 lg:rounded-xl lg:px-7 lg:py-5"
              >
                <span className="text-sm text-rose-900 lg:text-2xl">
                  <span className="mr-1.5 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs text-rose-700 lg:text-base">
                    {p.codigo}
                  </span>
                  {p.descricaoPeca} · módulo {p.moduloCodigo} · {p.lote.projeto.clienteNome} ·{" "}
                  {p.lote.ambiente}
                </span>
                <div className="flex items-center gap-3 lg:gap-5">
                  <Link
                    href={`/lotes/${p.loteId}`}
                    className="text-sm text-blue-600 underline lg:text-xl"
                  >
                    ver lote
                  </Link>
                  <ResolverDanificadaButton pecaId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        </div>
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
                    className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-blue-300 lg:rounded-2xl lg:border-2 lg:p-7"
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
