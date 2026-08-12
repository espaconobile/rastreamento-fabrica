import Link from "next/link";
import { db } from "@/lib/db";
import ResolverDanificadaButton from "@/app/components/ResolverDanificadaButton";
import AutoRefresh from "@/app/components/AutoRefresh";

// Mesmo motivo do dashboard: sem isso a pagina fica congelada na versao do build.
export const dynamic = "force-dynamic";

export default async function DanificadasPage() {
  const pecasDanificadas = await db.peca.findMany({
    where: { bipagens: { some: { etapa: { ehExcecao: true } } } },
    include: { lote: { include: { projeto: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-none lg:px-10 lg:py-14">
      <AutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 lg:text-5xl">Peças danificadas</h1>
        <Link href="/" className="text-sm text-zinc-500 underline lg:text-xl">
          ← voltar ao painel
        </Link>
      </div>

      {pecasDanificadas.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 lg:text-xl">
          Nenhuma peça danificada no momento.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2 lg:mt-8 lg:gap-4">
          {pecasDanificadas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 lg:rounded-xl lg:px-7 lg:py-5"
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
      )}
    </div>
  );
}
