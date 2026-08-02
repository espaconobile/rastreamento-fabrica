"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rebusca os dados do servidor periodicamente (sem recarregar a pagina inteira), para telas
// somente-leitura deixadas abertas no chao de fabrica (ex: um monitor grande mostrando o painel
// ou o detalhe de um lote) refletirem bipagens feitas em outras estacoes quase em tempo real.
export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
