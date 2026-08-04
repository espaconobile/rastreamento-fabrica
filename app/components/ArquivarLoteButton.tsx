"use client";

import { useRouter } from "next/navigation";
import { useState, type SVGProps } from "react";

function IconeArquivo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 4h18v4H3z" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

// Arquivar/desarquivar (ao contrario de excluir) e reversivel e nao apaga nada — por isso, sem
// painel de confirmacao aqui, so um toggle direto.
export default function ArquivarLoteButton({
  loteId,
  arquivado,
}: {
  loteId: string;
  arquivado: boolean;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function handleClick() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/lotes/${loteId}/arquivar`, {
        method: arquivado ? "DELETE" : "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setEnviando(false);
    }
  }

  // "display: contents" pelo mesmo motivo do ExcluirLoteButton: o card do lote no Dashboard e um
  // <Link>, e o clique aqui nao pode navegar junto.
  return (
    <div
      className="contents"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        onClick={handleClick}
        disabled={enviando}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 disabled:opacity-50 lg:gap-2 lg:text-lg"
      >
        <IconeArquivo className="h-4 w-4 lg:h-6 lg:w-6" />
        {enviando ? "..." : arquivado ? "Desarquivar" : "Arquivar"}
      </button>
    </div>
  );
}
