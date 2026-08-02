-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Etapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "usaPilha" BOOLEAN NOT NULL DEFAULT false,
    "ehExcecao" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Etapa" ("id", "nome", "ordem", "usaPilha") SELECT "id", "nome", "ordem", "usaPilha" FROM "Etapa";
DROP TABLE "Etapa";
ALTER TABLE "new_Etapa" RENAME TO "Etapa";
CREATE UNIQUE INDEX "Etapa_nome_key" ON "Etapa"("nome");
CREATE UNIQUE INDEX "Etapa_ordem_key" ON "Etapa"("ordem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
