# Rastreamento de Peças

Sistema de conferência/bipagem para rastrear peças entre as etapas de produção (Corte CNC →
Coladeira de Bordas → Separação), evitando que peças se percam entre um processo e
outro.

## Como funciona

1. **Importar** (`/importar`): envie o arquivo `Etiquetas.pdf` exportado do Promob (pasta
   "Listagem e Etiquetas"). O sistema lê cada etiqueta (uma por página do PDF), ignora as páginas
   de "Sobra de Material", e cria um **lote** de produção para cada ambiente/cômodo encontrado
   (ex: `1_COZINHAEAREA`, `2_SALA`), com todas as suas peças.
2. **Bipar** (`/bipar`): tela para o chão de fábrica. Cada estação configura uma vez o nome (ex:
   "CNC 1") e a etapa fixa dela (Corte CNC, Coladeira de Bordas ou Separação), e depois só bipa o
   código de barras de cada peça (via câmera ou digitando manualmente). O sistema avisa (com som e
   cor) quando uma peça é bipada fora de ordem ou já havia sido bipada naquela etapa — mas **não
   bloqueia**, apenas registra o alerta para o gestor ver depois. Na etapa de Separação, além
   disso, o sistema mostra em qual **pilha** (uma por módulo) a peça deve ser deixada.
3. **Painel** (`/`): lista os lotes em produção com barra de progresso por etapa. Clicando em um
   lote, é possível ver peça por peça quais etapas já foram concluídas e identificar rapidamente o
   que falta bipar antes de liberar o lote para a próxima fase.

### Sobre o código da etiqueta

O valor codificado no código de barras da etiqueta do Promob é o número solto impresso logo
abaixo do nome da peça (ex: `!LAT_ESQ` seguido de `5444`). Esse número normalmente é único, mas
o Promob não garante unicidade 100% global — em testes com dados reais, ~2% dos códigos se
repetiam entre peças de **ambientes diferentes** (nunca dentro do mesmo lote). Por isso, se uma
bipagem encontrar mais de uma peça com o mesmo código em lotes diferentes, o sistema pede para o
operador escolher manualmente o lote correto antes de registrar.

## Rodando localmente

```bash
npm install
npm run db:seed   # cria as 3 etapas padrão (só precisa rodar uma vez)
npm run dev
```

Acesse http://localhost:3000.

O banco de dados local é um arquivo SQLite (`prisma/dev.db`), criado automaticamente pela
migration em `prisma/migrations/`.

### Testando a câmera num iPhone pela rede local

O Safari só libera acesso à câmera em conexão HTTPS. Pra testar a leitura de código de barras
num iPhone conectado no mesmo Wi-Fi, use `npm run dev:https` em vez de `npm run dev` — ele sobe o
servidor em `https://<ip-da-máquina>:3000` com um certificado autoassinado (gerado uma vez com
`openssl`, arquivos em `certs/`). O Safari vai mostrar um aviso de "conexão não é privada" na
primeira vez — toque em "Mostrar Detalhes" → "Visitar este site" pra prosseguir. Isso só é
necessário para teste local; publicando na nuvem o HTTPS já vem pronto.

## Etapas de produção

As etapas ficam na tabela `Etapa` e podem ser ajustadas editando `prisma/seed.ts` (e rodando
`npm run db:seed` de novo) ou diretamente no banco. Hoje são três, na ordem:

1. Corte CNC
2. Coladeira de Bordas
3. Separação (`usaPilha = true` — só nela a bipagem mostra a instrução de pilha)

Novas etapas (ex: Furação, Expedição, Montagem) podem ser adicionadas sem alterar código —
apenas inserindo uma nova linha na tabela `Etapa` com o `ordem` correto (e `usaPilha = true` se a
etapa também precisar mostrar a instrução de pilha).

## Produção

O sistema está publicado e acessível de qualquer lugar (não depende do Wi-Fi da fábrica nem de
um computador local ligado):

- **App**: [Vercel](https://vercel.com), deploy automático a cada push na branch `main` do
  repositório GitHub `espaconobile/rastreamento-fabrica`.
- **Banco**: Postgres no [Neon](https://neon.tech). A `DATABASE_URL` configurada nas Environment
  Variables do projeto na Vercel usa a connection string **"pooled"** (com `-pooler` no
  hostname) — obrigatório em ambiente serverless, senão o banco esgota conexões rápido sob uso
  real.
- O banco de **desenvolvimento local** é um projeto Neon separado, configurado só no `.env` local
  (não versionado) — testes daqui não tocam nos dados reais de produção.

Detalhes de como isso foi montado (e um gotcha de deploy na Vercel com cache do Prisma Client)
estão em `NOTES.md`, seção "Deploy em produção".

Para criar um banco novo do zero (ex: se for recriar o ambiente): rodar
`npx prisma migrate deploy` com a `DATABASE_URL` apontando pro banco novo, seguido de
`npm run db:seed` pra popular as etapas fixas de produção.

## Dispositivo de bipagem recomendado

Um coletor Android com Wi-Fi e câmera (ex: Urovo, Newland, Elgin linha industrial, ou Zebra) que
abra o navegador e acesse a página `/bipar` publicada. A tela de bipagem funciona com câmera
(leitura automática) ou com um leitor de código de barras USB/Bluetooth comum que "digita" o
código no campo de texto (modo teclado).

## Estrutura do projeto

- `lib/parseEtiquetas.ts` — parser do PDF de etiquetas do Promob.
- `lib/loteProgress.ts` — cálculo de progresso por etapa de um lote.
- `app/api/importar/route.ts` — recebe o PDF e grava projeto/lotes/peças no banco.
- `app/api/bipar/route.ts` — valida e registra cada bipagem (sequência, duplicidade, ambiguidade).
- `app/bipar/` — tela de bipagem para o chão de fábrica.
- `app/lotes/[id]/` — detalhe de um lote (peça a peça, por etapa).
- `prisma/schema.prisma` — modelo de dados.
