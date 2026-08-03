"use client";

import { useCallback, useEffect, useRef, useState, type SVGProps } from "react";

// Carrega o zbar.wasm de um CDN em vez de depender do bundler (Turbopack) posicionar o arquivo
// .wasm no lugar certo — mais confiavel entre ambientes. Usa a mesma versao instalada no package.json.
const ZBAR_WASM_URL = "https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.11.0/dist/zbar.wasm";

interface Etapa {
  id: string;
  nome: string;
  ordem: number;
  usaPilha: boolean;
  ehExcecao: boolean;
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
  codigo: string;
  moduloCodigo: string;
  pilha?: number;
  descricaoPeca: string;
  comprimento: number | null;
  profundidade: number | null;
  chapaMaterial: string | null;
}

type FeedbackTipo =
  | "OK"
  | "ALERTA_DUPLICADO"
  | "ALERTA_FORA_DE_ORDEM"
  | "NAO_ENCONTRADA"
  | "ERRO"
  | "EXCECAO_REGISTRADA";

interface ProgressoPilha {
  concluidas: number;
  total: number;
}

interface PecaDanificada {
  pecaId: string;
  codigo: string;
  moduloCodigo: string;
  descricaoPeca: string;
  ambiente: string;
}

interface Feedback {
  tipo: FeedbackTipo;
  mensagem: string;
  peca?: PecaInfo;
  progressoPilha?: ProgressoPilha;
  pilhaAvulsas?: boolean;
}

// Em telas de celular usamos fundo claro (mais legivel de perto); a partir de "lg" (monitor de
// producao, visto de longe) trocamos para fundo saturado com texto branco, que mantem contraste
// alto mesmo a distancia e sob iluminacao de chao de fabrica.
const CORES: Record<FeedbackTipo, string> = {
  OK: "border-green-300 bg-green-50 text-green-900 lg:border-green-700 lg:bg-green-600 lg:text-white",
  ALERTA_DUPLICADO:
    "border-amber-300 bg-amber-50 text-amber-900 lg:border-amber-600 lg:bg-amber-400 lg:text-amber-950",
  ALERTA_FORA_DE_ORDEM:
    "border-amber-300 bg-amber-50 text-amber-900 lg:border-amber-600 lg:bg-amber-400 lg:text-amber-950",
  NAO_ENCONTRADA: "border-red-300 bg-red-50 text-red-900 lg:border-red-800 lg:bg-red-600 lg:text-white",
  ERRO: "border-red-300 bg-red-50 text-red-900 lg:border-red-800 lg:bg-red-600 lg:text-white",
  // Cor propria (rosa/vinho), diferente do verde de sucesso e do amarelo de alerta — marcar uma
  // peca como danificada nao e um erro nem um "tudo certo", e precisa se destacar visualmente
  // dos dois pra ninguem confundir com bipagem normal.
  EXCECAO_REGISTRADA:
    "border-rose-300 bg-rose-50 text-rose-900 lg:border-rose-800 lg:bg-rose-600 lg:text-white",
};

function IconeCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
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

function IconeErro(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9 9 15" />
    </svg>
  );
}

function IconeCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function IconeTrocar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </svg>
  );
}

function IconePilha(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function IconeExcecao(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 3.5L17 11H6" />
    </svg>
  );
}

const ICONES_FEEDBACK: Record<FeedbackTipo, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  OK: IconeCheck,
  ALERTA_DUPLICADO: IconeAlerta,
  ALERTA_FORA_DE_ORDEM: IconeAlerta,
  NAO_ENCONTRADA: IconeErro,
  ERRO: IconeErro,
  EXCECAO_REGISTRADA: IconeExcecao,
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
    } else if (tipo === "ALERTA_DUPLICADO" || tipo === "ALERTA_FORA_DE_ORDEM" || tipo === "EXCECAO_REGISTRADA") {
      tocarTom(520, 0, 0.1);
      tocarTom(520, 0.15, 0.1);
    } else {
      tocarTom(220, 0, 0.3);
    }
  } catch {
    // Audio nao suportado neste navegador; segue sem som.
  }
}

export default function BipagemClient({ etapas, clientes }: { etapas: Etapa[]; clientes: string[] }) {
  const [clienteNome, setClienteNome] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [configurando, setConfigurando] = useState(true);
  const [codigoManual, setCodigoManual] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [codigoPendente, setCodigoPendente] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ totalNaEtapa: number; totalNoLote: number } | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [danificadas, setDanificadas] = useState<PecaDanificada[]>([]);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [modoDanificada, setModoDanificada] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zbarConfiguradoRef = useRef(false);
  const leituraEmAndamentoRef = useRef(false);
  const ultimaLeituraRef = useRef<{ codigo: string; ts: number }>({ codigo: "", ts: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);
  // O loop de leitura da camera e configurado uma unica vez em ativarCamera() e fica rodando num
  // setInterval de vida longa — sem essa ref, o callback do interval ficaria preso ao valor de
  // modoDanificada de quando a camera foi ligada (closure "presa"), e nunca perceberia o operador
  // tocando em "Marcar peça danificada" enquanto a camera ja esta ativa.
  const modoDanificadaRef = useRef(false);

  useEffect(() => {
    const cli = localStorage.getItem("bipagem.cliente");
    const et = localStorage.getItem("bipagem.etapaId");
    if (cli && et && clientes.includes(cli) && etapas.some((e) => e.id === et)) {
      // Restaura a configuracao salva do localStorage, que so existe no cliente (nao no SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClienteNome(cli);
      setEtapaId(et);
      setConfigurando(false);
    }
  }, [etapas, clientes]);

  useEffect(() => {
    if (!configurando) inputRef.current?.focus();
  }, [configurando]);

  useEffect(() => {
    modoDanificadaRef.current = modoDanificada;
  }, [modoDanificada]);

  const etapaDanificada = etapas.find((e) => e.ehExcecao);

  const carregarDanificadas = useCallback(async () => {
    if (!clienteNome) return;
    try {
      const res = await fetch(`/api/danificadas?cliente=${encodeURIComponent(clienteNome)}`);
      const data = await res.json();
      if (Array.isArray(data.danificadas)) setDanificadas(data.danificadas);
    } catch {
      // Falha ao atualizar a lista nao e critica — o operador ainda consegue biper normalmente;
      // a lista so fica desatualizada ate a proxima tentativa (proxima bipagem ou resolucao).
    }
  }, [clienteNome]);

  useEffect(() => {
    if (!configurando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- setState so ocorre apos o await, dentro da funcao async
      carregarDanificadas();
    }
  }, [configurando, carregarDanificadas]);

  const enviarCodigo = useCallback(
    async (codigo: string, loteId?: string, etapaIdOverride?: string) => {
      if (!codigo || enviando) return;
      setEnviando(true);
      try {
        const res = await fetch("/api/bipar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo, etapaId: etapaIdOverride ?? etapaId, clienteNome, loteId }),
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
          pilhaAvulsas: data.pilhaAvulsas,
        });
        // So atualiza o contador "X de Y bipadas nesta etapa" quando o scan foi de fato pra etapa
        // configurada — marcar danificada usa uma etapa diferente (a de excecao) e atualizar o
        // contador com esse numero mostraria uma contagem errada pra etapa que esta na tela.
        if (data.progresso && !etapaIdOverride) setProgresso(data.progresso);
        tocarBeep(audioCtxRef.current, tipo);
        if (tipo === "EXCECAO_REGISTRADA") carregarDanificadas();
      } catch {
        setFeedback({ tipo: "ERRO", mensagem: "Erro de conexão ao registrar a bipagem." });
        tocarBeep(audioCtxRef.current, "ERRO");
      } finally {
        setEnviando(false);
        setCodigoManual("");
        inputRef.current?.focus();
        // O "modo danificada" vale so pra 1 bipagem: depois de usado (digitado ou bipado pela
        // camera), volta sozinho pro modo normal, pra nao correr o risco do operador esquecer que
        // estava ativo e marcar sem querer a proxima peca normal como danificada.
        if (etapaIdOverride) setModoDanificada(false);
      }
    },
    [etapaId, clienteNome, enviando, carregarDanificadas]
  );

  async function resolverDanificada(pecaId: string) {
    setResolvendoId(pecaId);
    try {
      const res = await fetch(`/api/danificadas/${pecaId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setDanificadas((atual) => atual.filter((d) => d.pecaId !== pecaId));
        setCandidatos(null);
        setCodigoPendente(null);
        setFeedback({
          tipo: "OK",
          mensagem: "Peça refeita — removida da lista de danificadas.",
          peca: data.peca,
          pilhaAvulsas: data.pilhaAvulsas,
        });
        tocarBeep(audioCtxRef.current, "OK");
      }
    } catch {
      // Falha de rede ao resolver: a peca simplesmente continua na lista pro operador tentar de novo.
    } finally {
      setResolvendoId(null);
    }
  }

  function handleSalvarConfiguracao(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteNome || !etapaId) return;
    localStorage.setItem("bipagem.cliente", clienteNome);
    localStorage.setItem("bipagem.etapaId", etapaId);
    setConfigurando(false);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    obterAudioContext(audioCtxRef); // destrava o audio dentro do gesto de tap/clique (exigencia do iOS)
    enviarCodigo(codigoManual.trim(), undefined, modoDanificada ? etapaDanificada?.id : undefined);
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
            enviarCodigo(texto, undefined, modoDanificadaRef.current ? etapaDanificada?.id : undefined);
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
      <form onSubmit={handleSalvarConfiguracao} className="flex flex-col gap-4 lg:gap-6">
        <h1 className="text-xl font-semibold text-zinc-900 lg:text-4xl">Configurar bipagem</h1>
        {clientes.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 lg:p-5 lg:text-xl">
            Nenhum cliente importado ainda. Importe um projeto em &quot;Importar&quot; antes de bipar.
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-sm lg:gap-2 lg:text-xl">
            Cliente
            <select
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              className="rounded-lg border border-zinc-300 p-3 lg:p-5 lg:text-2xl"
              required
            >
              <option value="">Selecione...</option>
              {clientes.map((cli) => (
                <option key={cli} value={cli}>
                  {cli}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm lg:gap-2 lg:text-xl">
          Etapa em que a peça está
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="rounded-lg border border-zinc-300 p-3 lg:p-5 lg:text-2xl"
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
        <button
          type="submit"
          disabled={clientes.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 lg:py-6 lg:text-2xl"
        >
          <IconeCheck className="h-5 w-5 lg:h-8 lg:w-8" />
          Começar a bipar
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 lg:text-lg">{clienteNome}</p>
          <h1 className="text-xl font-semibold text-zinc-900 lg:text-5xl">{etapaAtual?.nome}</h1>
        </div>
        <button
          onClick={() => setConfigurando(true)}
          className="flex items-center gap-1 text-xs font-medium text-zinc-500 lg:gap-2 lg:text-lg"
        >
          <IconeTrocar className="h-4 w-4 lg:h-6 lg:w-6" />
          trocar cliente
        </button>
      </div>

      {progresso && (
        <p className="text-sm text-zinc-600 lg:text-2xl">
          {progresso.totalNaEtapa} de {progresso.totalNoLote} peças bipadas nesta etapa (lote atual)
        </p>
      )}

      {danificadas.length > 0 && (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3 lg:rounded-2xl lg:border-4 lg:p-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-900 lg:gap-2 lg:text-2xl">
            <IconeExcecao className="h-4 w-4 lg:h-7 lg:w-7" />
            Peças danificadas aguardando refazer ({danificadas.length})
          </p>
          <ul className="mt-2 flex flex-col gap-2 lg:mt-4 lg:gap-3">
            {danificadas.map((d) => (
              <li
                key={d.pecaId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 lg:rounded-lg lg:px-5 lg:py-3"
              >
                <span className="text-sm text-rose-900 lg:text-xl">
                  <span className="mr-1.5 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs lg:text-base">
                    {d.codigo}
                  </span>
                  {d.descricaoPeca} · módulo {d.moduloCodigo} · {d.ambiente}
                </span>
                <button
                  type="button"
                  disabled={resolvendoId === d.pecaId}
                  onClick={() => resolverDanificada(d.pecaId)}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 lg:gap-2 lg:rounded-lg lg:px-5 lg:py-2 lg:text-lg"
                >
                  <IconeCheck className="h-3.5 w-3.5 lg:h-5 lg:w-5" />
                  {resolvendoId === d.pecaId ? "Removendo..." : "Refeita, remover"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2 lg:gap-3">
        <input
          ref={inputRef}
          value={codigoManual}
          onChange={(e) => setCodigoManual(e.target.value)}
          placeholder="Digite ou bipe o código da peça"
          inputMode="numeric"
          autoFocus
          className={`flex-1 rounded-lg border p-4 text-lg lg:p-7 lg:text-4xl ${
            modoDanificada ? "border-rose-500 ring-2 ring-rose-300" : "border-zinc-300"
          }`}
        />
        <button
          type="submit"
          disabled={enviando}
          className={`flex items-center gap-1.5 rounded-lg px-5 text-sm font-medium text-white disabled:opacity-50 lg:gap-3 lg:px-9 lg:text-3xl ${
            modoDanificada ? "bg-rose-600" : "bg-blue-600"
          }`}
        >
          {modoDanificada ? (
            <IconeExcecao className="h-5 w-5 lg:h-9 lg:w-9" />
          ) : (
            <IconeCheck className="h-5 w-5 lg:h-9 lg:w-9" />
          )}
          OK
        </button>
      </form>

      {etapaDanificada &&
        etapaDanificada.id !== etapaId &&
        (modoDanificada ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-rose-600 bg-rose-600 px-4 py-3 text-white lg:gap-4 lg:rounded-xl lg:border-4 lg:py-5">
            <span className="flex items-center gap-2 text-sm font-semibold lg:gap-3 lg:text-2xl">
              <IconeExcecao className="h-5 w-5 shrink-0 lg:h-8 lg:w-8" />
              Modo danificada ativo — bipe ou digite o código da peça
            </span>
            <button
              type="button"
              onClick={() => setModoDanificada(false)}
              className="shrink-0 rounded-md bg-white/20 px-3 py-1.5 text-xs font-medium lg:px-5 lg:py-2 lg:text-lg"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModoDanificada(true)}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 lg:gap-3 lg:rounded-xl lg:border-4 lg:py-5 lg:text-2xl"
          >
            <IconeExcecao className="h-5 w-5 lg:h-8 lg:w-8" />
            Marcar peça danificada
          </button>
        ))}

      {!cameraAtiva ? (
        <button
          onClick={ativarCamera}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 lg:gap-3 lg:py-6 lg:text-2xl"
        >
          <IconeCamera className="h-5 w-5 lg:h-8 lg:w-8" />
          Ativar câmera para ler código de barras
        </button>
      ) : (
        <div className="flex flex-col gap-2 lg:gap-3">
          <video
            ref={videoRef}
            className="w-full max-h-[35vh] rounded-lg border border-zinc-300 object-cover lg:mx-auto lg:max-w-xl lg:max-h-[45vh]"
            muted
            playsInline
          />
          <button
            onClick={desativarCamera}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 lg:gap-3 lg:py-4 lg:text-2xl"
          >
            <IconeCamera className="h-5 w-5 lg:h-8 lg:w-8" />
            Desativar câmera
          </button>
        </div>
      )}

      {candidatos && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 lg:rounded-2xl lg:border-4 lg:p-7">
          <p className="text-sm font-medium text-amber-900 lg:text-2xl">
            Este código existe em mais de um lote. Selecione o correto:
          </p>
          <ul className="mt-2 flex flex-col gap-2 lg:mt-4 lg:gap-3">
            {candidatos.map((c) => (
              <li key={c.pecaId}>
                <button
                  onClick={() => codigoPendente && enviarCodigo(codigoPendente, c.loteId)}
                  className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 lg:rounded-lg lg:px-5 lg:py-4 lg:text-xl"
                >
                  <span className="font-medium">{c.clienteNome}</span> · {c.ambiente} · módulo{" "}
                  {c.moduloCodigo} · {c.descricaoPeca} · <span className="font-medium">pilha {c.pilha}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback?.peca?.pilha != null && (() => {
        const pilhaCompleta =
          !!feedback.progressoPilha && feedback.progressoPilha.concluidas === feedback.progressoPilha.total;
        return (
          <div
            className={`flex flex-col items-center gap-1 rounded-xl border-4 py-6 text-center text-white lg:gap-3 lg:border-8 lg:py-16 ${
              pilhaCompleta ? "border-green-700 bg-green-600" : "border-blue-700 bg-blue-600"
            }`}
          >
            <span
              className={`flex items-center gap-1.5 text-sm uppercase tracking-wide lg:gap-3 lg:text-2xl ${
                pilhaCompleta ? "text-green-100" : "text-blue-100"
              }`}
            >
              {pilhaCompleta ? (
                <IconeCheck className="h-4 w-4 lg:h-8 lg:w-8" />
              ) : (
                <IconePilha className="h-4 w-4 lg:h-8 lg:w-8" />
              )}
              {pilhaCompleta ? "Completa! Coloque esta última peça na" : "Coloque a peça na"}
            </span>
            <span className="text-6xl font-bold leading-none lg:text-[10rem]">Pilha {feedback.peca.pilha}</span>
            {feedback.pilhaAvulsas && (
              <span className="mt-1 rounded-md bg-white/20 px-3 py-1 font-mono text-2xl font-bold lg:mt-2 lg:px-6 lg:py-2 lg:text-5xl">
                Peça {feedback.peca.codigo}
              </span>
            )}
            {pilhaCompleta ? (
              <span className="mt-1 text-base font-semibold text-green-50 lg:mt-3 lg:text-3xl">
                ✓ Módulo {feedback.peca.moduloCodigo} completo para separação — pronto para pré-montagem
              </span>
            ) : (
              feedback.progressoPilha && (
                <span className="mt-1 text-sm text-blue-100 lg:mt-3 lg:text-2xl">
                  {feedback.progressoPilha.concluidas} de {feedback.progressoPilha.total} peças desta
                  pilha já bipadas em {etapaAtual?.nome}
                </span>
              )
            )}
          </div>
        );
      })()}

      {feedback && (() => {
        const IconeFeedback = ICONES_FEEDBACK[feedback.tipo];
        return (
          <div className={`flex items-start gap-3 rounded-lg border p-4 lg:gap-5 lg:rounded-2xl lg:border-4 lg:p-8 ${CORES[feedback.tipo]}`}>
            <IconeFeedback className="h-6 w-6 shrink-0 lg:h-14 lg:w-14" />
            <div>
              <p className="text-base font-semibold lg:text-4xl">{feedback.mensagem}</p>
              {feedback.peca && (
                <p className="mt-1 text-sm lg:mt-3 lg:text-2xl">
                  Módulo {feedback.peca.moduloCodigo} · {feedback.peca.descricaoPeca}
                  {feedback.peca.comprimento && feedback.peca.profundidade && (
                    <> · {feedback.peca.comprimento} x {feedback.peca.profundidade}</>
                  )}
                  {feedback.peca.chapaMaterial && <> · {feedback.peca.chapaMaterial}</>}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
