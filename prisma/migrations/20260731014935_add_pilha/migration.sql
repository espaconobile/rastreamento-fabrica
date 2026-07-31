-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Peca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chapaNum" INTEGER,
    "posicaoNoNesting" INTEGER,
    "moduloCodigo" TEXT NOT NULL,
    "pilha" INTEGER NOT NULL DEFAULT 0,
    "descricaoPeca" TEXT NOT NULL,
    "comprimento" REAL,
    "profundidade" REAL,
    "espessura" REAL,
    "chapaMaterial" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Peca_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Peca" ("chapaMaterial", "chapaNum", "codigo", "comprimento", "createdAt", "descricaoPeca", "espessura", "id", "loteId", "moduloCodigo", "posicaoNoNesting", "profundidade") SELECT "chapaMaterial", "chapaNum", "codigo", "comprimento", "createdAt", "descricaoPeca", "espessura", "id", "loteId", "moduloCodigo", "posicaoNoNesting", "profundidade" FROM "Peca";
DROP TABLE "Peca";
ALTER TABLE "new_Peca" RENAME TO "Peca";
CREATE INDEX "Peca_codigo_idx" ON "Peca"("codigo");
CREATE UNIQUE INDEX "Peca_loteId_codigo_key" ON "Peca"("loteId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
