export interface EtapaProgresso {
  etapaId: string;
  nome: string;
  ordem: number;
  concluidas: number;
}

export function calcularProgressoLote(
  pecas: { bipagens: { etapaId: string }[] }[],
  etapas: { id: string; nome: string; ordem: number }[]
): EtapaProgresso[] {
  return etapas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((etapa) => ({
      etapaId: etapa.id,
      nome: etapa.nome,
      ordem: etapa.ordem,
      concluidas: pecas.filter((p) => p.bipagens.some((b) => b.etapaId === etapa.id)).length,
    }));
}
