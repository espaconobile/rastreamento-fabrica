import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ETAPAS = [
  { nome: "Corte CNC", ordem: 1, usaPilha: false },
  { nome: "Coladeira de Bordas", ordem: 2, usaPilha: false },
  { nome: "Separação", ordem: 3, usaPilha: true },
];

async function main() {
  for (const etapa of ETAPAS) {
    // upsert pela "ordem" (nao pelo "nome"), porque a etapa 3 ja existia com o nome antigo
    // "Separação/Triagem Final" e precisamos renomea-la em vez de criar uma etapa duplicada.
    await db.etapa.upsert({
      where: { ordem: etapa.ordem },
      update: { nome: etapa.nome, usaPilha: etapa.usaPilha },
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
