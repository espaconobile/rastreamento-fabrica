import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ETAPAS = [
  { nome: "Corte CNC", ordem: 1, usaPilha: false, ehExcecao: false },
  { nome: "Coladeira de Bordas", ordem: 2, usaPilha: false, ehExcecao: false },
  { nome: "Separação", ordem: 3, usaPilha: true, ehExcecao: false },
  // Etapa de excecao: pode ser bipada a qualquer momento do fluxo (nao exige etapa anterior) e
  // serve so pra marcar a peca como danificada/precisa refazer — nao e uma etapa sequencial de
  // producao, por isso fica de fora dos calculos de progresso normais (ver lib/loteProgress.ts).
  { nome: "Peça Danificada", ordem: 4, usaPilha: false, ehExcecao: true },
];

async function main() {
  for (const etapa of ETAPAS) {
    // upsert pela "ordem" (nao pelo "nome"), porque a etapa 3 ja existia com o nome antigo
    // "Separação/Triagem Final" e precisamos renomea-la em vez de criar uma etapa duplicada.
    await db.etapa.upsert({
      where: { ordem: etapa.ordem },
      update: { nome: etapa.nome, usaPilha: etapa.usaPilha, ehExcecao: etapa.ehExcecao },
      create: etapa,
    });
  }
  console.log("Etapas seeded:", ETAPAS.map((e) => e.nome).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
