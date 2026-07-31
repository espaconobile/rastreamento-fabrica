import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { calcularProgressoLote } from "@/lib/loteProgress";

export default async function LoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lote = await db.lote.findUnique({
    where: { id },
    include: {
      projeto: true,
      pecas: {
        include: { bipagens: true },
        orderBy: [{ pilha: "asc" }, { descricaoPeca: "asc" }],
      },
    },
  });

  if (!lote) notFound();

  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });
  const progresso = calcularProgressoLote(lote.pecas, etapas);

  // Agrupa as pecas por pilha (1 pilha = 1 modulo) para a conferencia "modulo por modulo" e
  // para o mapa de pilhas que pode ser impresso/afixado na area de separacao.
  const pilhas = new Map<number, typeof lote.pecas>();
  for (const peca of lote.pecas) {
    const lista = pilhas.get(peca.pilha) ?? [];
    lista.push(peca);
    pilhas.set(peca.pilha, lista);
  }
  const gruposOrdenados = [...pilhas.entries()].sort((a, b) => a[0] - b[0]);
  const ultimaEtapa = etapas[etapas.length - 1];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 underline">
        ← todos os lotes
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
        {lote.projeto.clienteNome} · {lote.ambiente}
      </h1>
      <p className="text-sm text-zinc-500">
        {lote.pecas.length} peças · {pilhas.size} pilhas (módulos)
      </p>

      <div className="mt-4 flex flex-wrap gap-6">
        {progresso.map((et) => (
          <div key={et.etapaId} className="text-sm">
            <p className="font-medium text-zinc-900">{et.nome}</p>
            <p className="text-zinc-500">
              {et.concluidas} / {lote.pecas.length}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Peça</th>
              <th className="px-3 py-2">Dimensões</th>
              {etapas.map((et) => (
                <th key={et.id} className="px-3 py-2 text-center">
                  {et.nome}
                </th>
              ))}
            </tr>
          </thead>
          {gruposOrdenados.map(([pilha, pecasDaPilha]) => {
            const concluidasNaUltimaEtapa = pecasDaPilha.filter((p) =>
              p.bipagens.some((b) => b.etapaId === ultimaEtapa?.id)
            ).length;
            const pilhaCompleta = concluidasNaUltimaEtapa === pecasDaPilha.length;

            return (
              <tbody key={pilha} className="divide-y divide-zinc-100 border-t-2 border-zinc-900">
                <tr>
                  <td colSpan={2 + etapas.length} className="bg-zinc-900 px-3 py-1.5 text-white">
                    <span className="text-sm font-semibold">Pilha {pilha}</span>
                    <span className="ml-2 text-xs text-zinc-300">
                      módulo {pecasDaPilha[0].moduloCodigo} · {pecasDaPilha.length} peças
                      {ultimaEtapa && (
                        <>
                          {" "}
                          · {concluidasNaUltimaEtapa}/{pecasDaPilha.length} em {ultimaEtapa.nome}
                          {pilhaCompleta && " ✓ completa"}
                        </>
                      )}
                    </span>
                  </td>
                </tr>
                {pecasDaPilha.map((peca) => {
                  const etapasFeitas = new Set(peca.bipagens.map((b) => b.etapaId));
                  const temAlerta = peca.bipagens.some((b) => b.status !== "OK");
                  return (
                    <tr key={peca.id} className={temAlerta ? "bg-amber-50" : undefined}>
                      <td className="px-3 py-2 text-zinc-600">{peca.descricaoPeca}</td>
                      <td className="px-3 py-2 text-zinc-500">
                        {peca.comprimento && peca.profundidade
                          ? `${peca.comprimento} x ${peca.profundidade}`
                          : "-"}
                      </td>
                      {etapas.map((et) => (
                        <td key={et.id} className="px-3 py-2 text-center">
                          {etapasFeitas.has(et.id) ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
