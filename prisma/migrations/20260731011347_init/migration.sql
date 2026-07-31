-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteNome" TEXT NOT NULL,
    "nomeArquivoOrigem" TEXT NOT NULL,
    "dataImportacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projetoId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chapaNum" INTEGER,
    "posicaoNoNesting" INTEGER,
    "moduloCodigo" TEXT NOT NULL,
    "descricaoPeca" TEXT NOT NULL,
    "comprimento" REAL,
    "profundidade" REAL,
    "espessura" REAL,
    "chapaMaterial" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Peca_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Bipagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pecaId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "estacaoNome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bipagem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bipagem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
