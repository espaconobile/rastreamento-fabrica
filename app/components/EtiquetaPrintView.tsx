"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface EtiquetaData {
  codigo: string;
  moduloCodigo: string;
  descricaoPeca: string;
  comprimento: number | null;
  profundidade: number | null;
  chapaMaterial: string | null;
  chapaNum: number | null;
  posicaoNoNesting: number | null;
  clienteNome: string;
  ambiente: string;
}

// A etiqueta original do Promob nao fica salva (o PDF e descartado logo apos a importacao, ver
// app/api/importar/route.ts) — esta e uma etiqueta nova, gerada a partir dos dados ja extraidos,
// pensada pra ser impressa numa impressora termica de rolo 100x50mm (ver @page "etiqueta" no
// globals.css, que so se aplica a esta pagina via a classe .pagina-etiqueta).
export default function EtiquetaPrintView({ peca }: { peca: EtiquetaData }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, peca.codigo, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 50,
      });
    }
  }, [peca.codigo]);

  return (
    <div className="pagina-etiqueta">
      <div className="etiqueta">
        <p className="etiqueta-cliente">{peca.clienteNome}</p>
        <p className="etiqueta-ambiente">{peca.ambiente}</p>
        <p className="etiqueta-peca">{peca.descricaoPeca}</p>
        <p className="etiqueta-linha">
          {peca.comprimento && peca.profundidade
            ? `${peca.comprimento} x ${peca.profundidade}`
            : null}
          {peca.chapaMaterial ? ` · ${peca.chapaMaterial}` : null}
        </p>
        <p className="etiqueta-linha">
          Módulo: {peca.moduloCodigo}
          {peca.chapaNum ? ` · Ch: ${peca.chapaNum}` : null}
          {peca.posicaoNoNesting ? ` · Pç: ${peca.posicaoNoNesting}` : null}
        </p>
        <svg ref={barcodeRef} className="etiqueta-barcode" />
        <p className="etiqueta-codigo">{peca.codigo}</p>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="no-print mt-6 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-lg"
      >
        Imprimir etiqueta
      </button>
    </div>
  );
}
