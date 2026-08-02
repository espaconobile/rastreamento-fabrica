/*
  Warnings:

  - You are about to drop the column `estacaoNome` on the `Bipagem` table. All the data in the column will be lost.
  - Added the required column `clienteNome` to the `Bipagem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bipagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pecaId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bipagem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bipagem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Bipagem" ("createdAt", "etapaId", "id", "pecaId", "status") SELECT "createdAt", "etapaId", "id", "pecaId", "status" FROM "Bipagem";
DROP TABLE "Bipagem";
ALTER TABLE "new_Bipagem" RENAME TO "Bipagem";
CREATE INDEX "Bipagem_pecaId_idx" ON "Bipagem"("pecaId");
CREATE INDEX "Bipagem_etapaId_idx" ON "Bipagem"("etapaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
