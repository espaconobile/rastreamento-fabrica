"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// Carrega o zbar.wasm de um CDN em vez de depender do bundler (Turbopack) posicionar o arquivo
// .wasm no lugar certo — mais confiavel entre ambientes. Usa a mesma versao instalada no package.json.
const ZBAR_WASM_URL = "https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.11.0/dist/zbar.wasm";

interface Etapa {
  id: string;
  nome: string;
  ordem: number;
  usaPilha: boolean;
}

interface Candidato {
  pecaId: string;
  loteId: string;
  ambiente: string;
  clienteNome: string;
  moduloCodigo: string;
  pilha: number;
  descricaoPeca: string;
}

interface PecaInfo {
  moduloCodigo: string;
  pilha?: number;
  descricaoPeca: string;
  comprimento: number | null;
  profundidade: number | null;
  chapaMaterial: string | null;
}

type FeedbackTipo = "OK" | "ALERTA_DUPLICADO" | "ALERTA_FORA_DE_ORDEM" | "NAO_ENCONTRADA" | "ERRO";

interface ProgressoPilha {
  concluidas: number;
  total: number;
}

interface Feedback {
  tipo: FeedbackTipo;
  mensagem: string;
  peca?: PecaInfo;
  progressoPilha?: ProgressoPilha;
}

const CORES: Record<FeedbackTipo, string> = {
  OK: "border-green-300 bg-green-50 text-green-900",
  ALERTA_DUPLICADO: "border-amber-300 bg-amber-50 text-amber-900",
  ALERTA_FORA_DE_ORDEM: "border-amber-300 bg-amber-50 text-amber-900",
  NAO_ENCONTRADA: "border-red-300 bg-red-50 text-red-900",
  ERRO: "border-red-300 bg-red-50 text-red-900",
};

// iOS/Safari só libera o AudioContext se ele for criado (ou retomado) dentro de um gesto do
// usuário (clique/tap). Por isso mantemos uma unica instancia, "destravada" no primeiro tap do
// operador, em vez de criar um AudioContext novo a cada beep (que o Safari bloqueia silenciosamente).
function obterAudioContext(ref: { current: AudioContext | null }): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ref.current) ref.current = new Ctx();
    if (ref.current.state === "suspended") ref.current.resume();
    return ref.current;
  } catch {
    return null;
  }
}

function tocarBeep(ctx: AudioContext | null, tipo: FeedbackTipo) {
  if (!ctx) return;
  try {
    const tocarTom = (freq: number, inicio: number, duracao: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao);
    };

    if (tipo === "OK") {
      tocarTom(880, 0, 0.12);
    } else if (tipo === "ALERTA_DUPLICADO" || tipo === "ALERTA_FORA_DE_ORDEM") {
      tocarTom(520, 0, 0.1);
      tocarTom(520, 0.15, 0.1);
    } else {
      tocarTom(220, 0, 0.3);
    }
  } catch {
    // Audio nao suportado neste navegador; segue sem som.
  }
}

export default function BipagemClient({ etapas }: { etapas: Etapa[] }) {
  const [estacaoNome, setEstacaoNome] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [configurando, setConfigurando] = useState(true);
  const [codigoManual, setCodigoManual] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [codigoPendente, setCodigoPendente] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ totalNaEtapa: number; totalNoLote: number } | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zbarConfiguradoRef = useRef(false);
  const leituraEmAndamentoRef = useRef(false);
  const ultimaLeituraRef = useRef<{ codigo: string; ts: number }>({ codigo: "", ts: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const est = localStorage.getItem("bipagem.estacao");
    const et = localStorage.getItem("bipagem.etapaId");
    if (est && et && etapas.some((e) => e.id === et)) {
      setEstacaoNome(est);
      setEtapaId(et);
      setConfigurando(false);
    }
  }, [etapas]);

  useEffect(() => {
    if (!configurando) inputRef.current?.focus();
  }, [configurando]);

  const enviarCodigo = useCallback(
    async (codigo: string, loteId?: string) => {
      if (!codigo || enviando) return;
      setEnviando(true);
      try {
        const res = await fetch("/api/bipar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo, etapaId, estacaoNome, loteId }),
        });
        const data = await res.json();

        if (data.status === "AMBIGUA") {
          setCandidatos(data.candidatos);
          setCodigoPendente(codigo);
          setFeedback(null);
          return;
        }

        setCandidatos(null);
        setCodigoPendente(null);
        const tipo: FeedbackTipo = data.status ?? "ERRO";
        setFeedback({
          tipo,
          mensagem: data.mensagem ?? "Erro inesperado.",
          peca: data.peca,
          progressoPilha: data.progressoPilha,
        });
        if (data.progresso) setProgresso(data.progresso);
        tocarBeep(audioCtxRef.current, tipo);
      } catch {
        setFeedback({ tipo: "ERRO", mensagem: "Erro de conexão ao registrar a bipagem." });
        tocarBeep(audioCtxRef.current, "ERRO");
      } finally {
        setEnviando(false);
        setCodigoManual("");
        inputRef.current?.focus();
      }
    },
    [etapaId, estacaoNome, enviando]
  );

  function handleSalvarConfiguracao(e: React.FormEvent) {
    e.preventDefault();
    if (!estacaoNome.trim() || !etapaId) return;
    localStorage.setItem("bipagem.estacao", estacaoNome.trim());
    localStorage.setItem("bipagem.etapaId", etapaId);
    setConfigurando(false);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    obterAudioContext(audioCtxRef); // destrava o audio dentro do gesto de tap/clique (exigencia do iOS)
    enviarCodigo(codigoManual.trim());
  }

  const pararCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  async function ativarCamera() {
    obterAudioContext(audioCtxRef); // destrava o audio no tap que ativa a camera (exigencia do iOS)
    setCameraAtiva(true);
    try {
      // Pede explicitamente a camera traseira (facingMode "environment") em vez de deixar o
      // dispositivo escolher — no iOS Safari, sem isso, e comum abrir a camera frontal por padrao.
      // Resolucao mais alta (ideal, nao obrigatoria) ajuda a decodificar codigo de barras 1D.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // zbar-wasm (ZBar via WebAssembly) decodifica muito melhor codigo de barras 1D em camera de
      // celular do que o zxing-js puro-JS que usavamos antes — foi trocado por isso.
      const { scanImageData, setModuleArgs } = await import("@undecaf/zbar-wasm");
      if (!zbarConfiguradoRef.current) {
        setModuleArgs({ locateFile: () => ZBAR_WASM_URL });
        zbarConfiguradoRef.current = true;
      }
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");

      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0 || leituraEmAndamentoRef.current) return;

        leituraEmAndamentoRef.current = true;
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const simbolos = await scanImageData(imageData);
          if (simbolos.length > 0) {
            const texto = simbolos[0].decode();
            const agora = Date.now();
            // Evita reenviar o mesmo codigo repetidas vezes enquanto a peca continua no quadro.
            if (texto === ultimaLeituraRef.current.codigo && agora - ultimaLeituraRef.current.ts < 3000) {
              return;
            }
            ultimaLeituraRef.current = { codigo: texto, ts: agora };
            enviarCodigo(texto);
          }
        } finally {
          leituraEmAndamentoRef.current = false;
        }
      }, 250);
    } catch {
      setFeedback({ tipo: "ERRO", mensagem: "Não foi possível acessar a câmera." });
      pararCamera();
      setCameraAtiva(false);
    }
  }

  function desativarCamera() {
    pararCamera();
    setCameraAtiva(false);
  }

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  const etapaAtual = etapas.find((e) => e.id === etapaId);

  if (configurando) {
    return (
      <form onSubmit={handleSalvarConfiguracao} className="flex flex-col gap-4">
        <Link href="/" className="text-xs font-medium text-zinc-500 underline">
          ← painel
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">Configurar estação</h1>
        <label className="flex flex-col gap-1 text-sm">
          Nome da estação
          <input
            value={estacaoNome}
            onChange={(e) => setEstacaoNome(e.target.value)}
            placeholder="Ex: CNC 1"
            className="rounded-lg border border-zinc-300 p-3"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Etapa desta estação
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="rounded-lg border border-zinc-300 p-3"
            required
          >
            <option value="">Selecione...</option>
            {etapas.map((et) => (
              <option key={et.id} value={et.id}>
                {et.nome}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white">
          Começar a bipar
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{estacaoNome}</p>
          <h1 className="text-xl font-semibold text-zinc-900">{etapaAtual?.nome}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-medium text-zinc-500 underline">
            painel
          </Link>
          <button
            onClick={() => setConfigurando(true)}
            className="text-xs font-medium text-zinc-500 underline"
          >
            trocar estação
          </button>
        </div>
      </div>

      {progresso && (
        <p className="text-sm text-zinc-600">
          {progresso.totalNaEtapa} de {progresso.totalNoLote} peças bipadas nesta etapa (lote atual)
        </p>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={codigoManual}
          onChange={(e) => setCodigoManual(e.target.value)}
          placeholder="Digite ou bipe o código da peça"
          inputMode="numeric"
          autoFocus
          className="flex-1 rounded-lg border border-zinc-300 p-4 text-lg"
        />
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          OK
        </button>
      </form>

      {!cameraAtiva ? (
        <button
          onClick={ativarCamera}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700"
        >
          Ativar câmera para ler código de barras
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} className="w-full rounded-lg border border-zinc-300" muted playsInline />
          <button
            onClick={desativarCamera}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
          >
            Desativar câmera
          </button>
        </div>
      )}

      {candidatos && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Este código existe em mais de um lote. Selecione o correto:
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {candidatos.map((c) => (
              <li key={c.pecaId}>
                <button
                  onClick={() => codigoPendente && enviarCodigo(codigoPendente, c.loteId)}
                  className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100"
                >
                  <span className="font-medium">{c.clienteNome}</span> · {c.ambiente} · módulo{" "}
                  {c.moduloCodigo} · {c.descricaoPeca} · <span className="font-medium">pilha {c.pilha}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback?.peca?.pilha != null && (
        <div className="flex flex-col items-center gap-1 rounded-xl border-4 border-zinc-900 bg-zinc-900 py-6 text-center text-white">
          <span className="text-sm uppercase tracking-wide text-zinc-300">Coloque a peça na</span>
          <span className="text-6xl font-bold leading-none">Pilha {feedback.peca.pilha}</span>
          {feedback.progressoPilha && (
            <span className="mt-1 text-sm text-zinc-300">
              {feedback.progressoPilha.concluidas} de {feedback.progressoPilha.total} peças desta
              pilha já bipadas em {etapaAtual?.nome}
            </span>
          )}
        </div>
      )}

      {feedback && (
        <div className={`rounded-lg border p-4 ${CORES[feedback.tipo]}`}>
          <p className="text-base font-semibold">{feedback.mensagem}</p>
          {feedback.peca && (
            <p className="mt-1 text-sm">
              Módulo {feedback.peca.moduloCodigo} · {feedback.peca.descricaoPeca}
              {feedback.peca.comprimento && feedback.peca.profundidade && (
                <> · {feedback.peca.comprimento} x {feedback.peca.profundidade}</>
              )}
              {feedback.peca.chapaMaterial && <> · {feedback.peca.chapaMaterial}</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
