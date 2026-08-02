-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "nomeArquivoOrigem" TEXT NOT NULL,
    "dataImportacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chapaNum" INTEGER,
    "posicaoNoNesting" INTEGER,
    "moduloCodigo" TEXT NOT NULL,
    "pilha" INTEGER NOT NULL DEFAULT 0,
    "descricaoPeca" TEXT NOT NULL,
    "comprimento" DOUBLE PRECISION,
    "profundidade" DOUBLE PRECISION,
    "espessura" DOUBLE PRECISION,
    "chapaMaterial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "usaPilha" BOOLEAN NOT NULL DEFAULT false,
    "ehExcecao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bipagem" (
    "id" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bipagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lote_projetoId_ambiente_key" ON "Lote"("projetoId", "ambiente");

-- CreateIndex
CREATE INDEX "Peca_codigo_idx" ON "Peca"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Peca_loteId_codigo_key" ON "Peca"("loteId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_nome_key" ON "Etapa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_ordem_key" ON "Etapa"("ordem");

-- CreateIndex
CREATE INDEX "Bipagem_pecaId_idx" ON "Bipagem"("pecaId");

-- CreateIndex
CREATE INDEX "Bipagem_etapaId_idx" ON "Bipagem"("etapaId");

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peca" ADD CONSTRAINT "Peca_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bipagem" ADD CONSTRAINT "Bipagem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bipagem" ADD CONSTRAINT "Bipagem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
