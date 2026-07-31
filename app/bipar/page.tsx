import { db } from "@/lib/db";
import BipagemClient from "./bipagem-client";

export default async function BiparPage() {
  const etapas = await db.etapa.findMany({ orderBy: { ordem: "asc" } });

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <BipagemClient
        etapas={etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, usaPilha: e.usaPilha }))}
      />
    </div>
  );
}
