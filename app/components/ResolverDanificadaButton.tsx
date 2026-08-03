"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResolverDanificadaButton({ pecaId }: { pecaId: string }) {
  const router = useRouter();
  const [resolvendo, setResolvendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleResolver() {
    setResolvendo(true);
    setErro(null);
    try {
      const res = await fetch(`/api/danificadas/${pecaId}`, { method: "DELETE" });
      if (!res.ok) {
        setErro("Falha ao remover.");
        setResolvendo(false);
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de conexão.");
      setResolvendo(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {erro && <span className="text-xs text-red-600 lg:text-base">{erro}</span>}
      <button
        onClick={handleResolver}
        disabled={resolvendo}
        className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 lg:gap-2 lg:rounded-lg lg:px-5 lg:py-2 lg:text-lg"
      >
        {resolvendo ? "Removendo..." : "✓ Refeita, remover"}
      </button>
    </div>
  );
}
