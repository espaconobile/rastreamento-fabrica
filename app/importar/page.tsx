"use client";

import { useRef, useState, type SVGProps } from "react";
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

function IconeUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 15V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconeArquivo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconeCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}

function IconeErro(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9 9 15" />
    </svg>
  );
}

function IconeAlerta(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);

  function selecionarArquivo(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setErro("Selecione um arquivo PDF (Etiquetas.pdf exportado do Promob).");
      return;
    }
    setErro(null);
    setResultado(null);
    setArquivo(file);
  }

  function removerArquivo() {
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    selecionarArquivo(e.dataTransfer.files?.[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) {
      setErro("Selecione o arquivo Etiquetas.pdf.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const formData = new FormData();
      formData.append("file", arquivo);
      const res = await fetch("/api/importar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? "Falha ao importar o arquivo.");
        return;
      }

      setResultado(data);
      removerArquivo();
    } catch {
      setErro("Erro de conexão ao enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:max-w-3xl lg:px-8 lg:py-14">
      <h1 className="text-2xl font-semibold text-zinc-900 lg:text-4xl">Importar projeto do Promob</h1>
      <p className="mt-2 text-sm text-zinc-600 lg:text-xl">
        Envie o arquivo <code className="rounded bg-zinc-100 px-1 py-0.5">Etiquetas.pdf</code>{" "}
        exportado do Promob (pasta &ldquo;Listagem e Etiquetas&rdquo;). Cada ambiente encontrado
        no arquivo vira um lote de produção.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 lg:gap-6">
        {arquivo ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 lg:rounded-2xl lg:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <IconeArquivo className="h-8 w-8 shrink-0 text-red-500 lg:h-10 lg:w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800 lg:text-lg">
                  {arquivo.name}
                </p>
                <p className="text-xs text-zinc-500 lg:text-sm">{formatarTamanho(arquivo.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={removerArquivo}
              className="shrink-0 text-xs font-medium text-blue-600 underline lg:text-base"
            >
              trocar arquivo
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors lg:rounded-2xl lg:p-16 ${
              arrastando ? "border-blue-500 bg-blue-50" : "border-zinc-300 hover:border-blue-300 hover:bg-zinc-50"
            }`}
          >
            <IconeUpload className="h-10 w-10 text-zinc-400 lg:h-16 lg:w-16" />
            <p className="text-sm font-medium text-zinc-700 lg:text-xl">
              Arraste o arquivo aqui, ou <span className="text-blue-600 underline">clique para selecionar</span>
            </p>
            <p className="text-xs text-zinc-500 lg:text-base">Apenas arquivo PDF</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => selecionarArquivo(e.target.files?.[0])}
              className="hidden"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!arquivo || enviando}
          className="flex w-fit items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 lg:px-7 lg:py-4 lg:text-xl"
        >
          {enviando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent lg:h-6 lg:w-6" />
              Importando...
            </>
          ) : (
            <>
              <IconeUpload className="h-4 w-4 lg:h-6 lg:w-6" />
              Importar
            </>
          )}
        </button>
      </form>

      {erro && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 lg:rounded-2xl lg:border-2 lg:p-7 lg:text-xl">
          <IconeErro className="h-5 w-5 shrink-0 lg:h-8 lg:w-8" />
          <span>{erro}</span>
        </div>
      )}

      {resultado && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 lg:rounded-2xl lg:border-2 lg:p-7">
          <div className="flex items-start gap-3">
            <IconeCheck className="h-6 w-6 shrink-0 text-green-600 lg:h-9 lg:w-9" />
            <div>
              <p className="text-sm font-medium text-green-900 lg:text-xl">
                Importação concluída para o cliente <strong>{resultado.clienteNome}</strong>
              </p>
              <p className="mt-1 text-sm text-green-800 lg:text-lg">
                {resultado.totalPecas} peças reconhecidas em {resultado.lotes.length} lote(s)
                {resultado.paginasIgnoradas > 0 && (
                  <> · {resultado.paginasIgnoradas} etiqueta(s) de sobra de material ignoradas</>
                )}
              </p>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-green-200 rounded-md bg-white lg:mt-6 lg:rounded-lg">
            {resultado.lotes.map((lote) => (
              <li
                key={lote.loteId}
                className="flex items-center justify-between px-4 py-2 text-sm lg:px-6 lg:py-4 lg:text-lg"
              >
                <span className="font-medium text-zinc-800">{lote.ambiente}</span>
                <span className="text-zinc-500">
                  {lote.total} peças · {lote.pilhas} pilhas (módulos)
                  {lote.ignoradas > 0 && (
                    <span className="text-amber-600"> · {lote.ignoradas} ignorada(s)</span>
                  )}
                </span>
                <Link href={`/lotes/${lote.loteId}`} className="text-blue-600 underline">
                  ver lote
                </Link>
              </li>
            ))}
          </ul>

          {resultado.paginasComErro.length > 0 && (
            <details className="mt-4 text-sm text-amber-800 lg:mt-6 lg:text-lg">
              <summary className="flex cursor-pointer items-center gap-2 font-medium">
                <IconeAlerta className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" />
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

          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-blue-600 underline lg:mt-6 lg:text-lg"
          >
            Ir para o painel
          </Link>
        </div>
      )}
    </div>
  );
}
