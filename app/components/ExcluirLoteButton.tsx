"use client";

import { useRouter } from "next/navigation";
import { useState, type SVGProps } from "react";

function IconeLixeira(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function ExcluirLoteButton({ loteId, nomeLote }: { loteId: string; nomeLote: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleExcluir() {
    setExcluindo(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lotes/${loteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error ?? "Falha ao excluir o lote.");
        setExcluindo(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Erro de conexão ao excluir o lote.");
      setExcluindo(false);
    }
  }

  // "display: contents" nao gera caixa propria no layout (o botao precisa ficar exatamente onde
  // estava antes, sem virar mais um item de flex/wrapper — usado tanto solto quanto dentro do
  // card do lote no Dashboard), mas ainda deixa a gente capturar todo clique aqui dentro (inclusive
  // nos botoes do painel de confirmacao) e impedir que ele "vaze" pro <Link> do card do lote no
  // Dashboard, que senao navegaria pro lote junto com o clique de excluir/cancelar.
  return (
    <div
      className="contents"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {confirmando ? (
        <div className="w-full rounded-lg border-2 border-red-300 bg-red-50 p-4 lg:rounded-2xl lg:border-4 lg:p-7">
          <p className="text-sm font-semibold text-red-900 lg:text-2xl">
            Excluir o lote &ldquo;{nomeLote}&rdquo;?
          </p>
          <p className="mt-1 text-sm text-red-800 lg:mt-2 lg:text-xl">
            Isso apaga todas as peças e todo o histórico de bipagem deste lote. Essa ação não pode
            ser desfeita.
          </p>
          {erro && <p className="mt-2 text-sm font-medium text-red-700 lg:text-lg">{erro}</p>}
          <div className="mt-3 flex gap-2 lg:mt-5 lg:gap-3">
            <button
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 lg:px-6 lg:py-3 lg:text-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleExcluir}
              disabled={excluindo}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 lg:px-6 lg:py-3 lg:text-xl"
            >
              {excluindo ? "Excluindo..." : "Sim, excluir lote"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmando(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-red-600 lg:gap-2 lg:text-lg"
        >
          <IconeLixeira className="h-4 w-4 lg:h-6 lg:w-6" />
          Excluir lote
        </button>
      )}
    </div>
  );
}
