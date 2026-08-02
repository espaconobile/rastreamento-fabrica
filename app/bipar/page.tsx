import { db } from "@/lib/db";
import BipagemClient from "./bipagem-client";

export default async function BiparPage() {
  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });
  const projetos = await db.projeto.findMany({
    select: { clienteNome: true },
    orderBy: { dataImportacao: "desc" },
  });
  // Um mesmo cliente pode ter mais de um projeto importado (ex: reforma em duas etapas) — a
  // lista de selecao mostra cada nome uma unica vez, na ordem do projeto mais recente primeiro.
  const clientes = [...new Set(projetos.map((p) => p.clienteNome))];

  return (
    <div className="mx-auto max-w-lg px-4 py-6 lg:max-w-3xl lg:px-8 lg:py-10">
      <BipagemClient
        etapas={etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, usaPilha: e.usaPilha }))}
        clientes={clientes}
      />
    </div>
  );
}
