"use client";

import { useRef, useState } from "react";
import Link from "next/link";

interface ResumoLote {
  loteId: string;
  ambiente: string;
  total: number;
  ignoradas: number;
  pilhas: number;
}

interface ImportResult {
  projetoId: string;
  clienteNome: string;
  totalPecas: number;
  paginasIgnoradas: number;
  paginasComErro: { pagina: number; motivo: string }[];
  lotes: ResumoLote[];
}

export default function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setErro("Selecione o arquivo Etiquetas.pdf.");
      return;
    }

    setEnviando(true);
    setErro(null);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/importar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? "Falha ao importar o arquivo.");
        return;
      }

      setResultado(data);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setErro("Erro de conexão ao enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Importar projeto do Promob</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Envie o arquivo <code className="rounded bg-zinc-100 px-1 py-0.5">Etiquetas.pdf</code>{" "}
        exportado do Promob (pasta &ldquo;Listagem e Etiquetas&rdquo;). Cada ambiente encontrado
        no arquivo vira um lote de produção.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="block w-full rounded-lg border border-zinc-300 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        <button
          type="submit"
          disabled={enviando}
          className="w-fit rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {enviando ? "Importando..." : "Importar"}
        </button>
      </form>

      {erro && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Importação concluída para o cliente <strong>{resultado.clienteNome}</strong>
          </p>
          <p className="mt-1 text-sm text-green-800">
            {resultado.totalPecas} peças reconhecidas em {resultado.lotes.length} lote(s)
            {resultado.paginasIgnoradas > 0 && (
              <> · {resultado.paginasIgnoradas} etiqueta(s) de sobra de material ignoradas</>
            )}
          </p>

          <ul className="mt-4 divide-y divide-green-200 rounded-md bg-white">
            {resultado.lotes.map((lote) => (
              <li key={lote.loteId} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium text-zinc-800">{lote.ambiente}</span>
                <span className="text-zinc-500">
                  {lote.total} peças · {lote.pilhas} pilhas (módulos)
                  {lote.ignoradas > 0 && (
                    <span className="text-amber-600"> · {lote.ignoradas} ignorada(s)</span>
                  )}
                </span>
                <Link href={`/lotes/${lote.loteId}`} className="text-zinc-900 underline">
                  ver lote
                </Link>
              </li>
            ))}
          </ul>

          {resultado.paginasComErro.length > 0 && (
            <details className="mt-4 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {resultado.paginasComErro.length} página(s) não reconhecida(s)
              </summary>
              <ul className="mt-2 list-disc pl-5">
                {resultado.paginasComErro.map((p) => (
                  <li key={p.pagina}>
                    Página {p.pagina}: {p.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-900 underline">
            Ir para o painel
          </Link>
        </div>
      )}
    </div>
  );
}
