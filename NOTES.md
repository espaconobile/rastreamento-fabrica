# Notas do projeto — nuances e decisões

Este arquivo existe para não perdermos o porquê das decisões não óbvias deste projeto. O README
explica *como usar*; este arquivo explica *por que é assim*.

## O código da etiqueta (ponto mais importante)

A etiqueta do Promob tem **dois números diferentes**, e é fácil confundir os dois:

- **`Módulo:`** (campo `moduloCodigo` no banco) — identifica o módulo/armário da composição
  (ex: um balcão, uma porta de painel). **Todas as peças de um mesmo módulo compartilham esse
  número.** É esse número que permite separar o projeto módulo por módulo na triagem (confirmado
  com o usuário e validado nos dados reais: o módulo `11244` de um projeto real tem 17 peças,
  todas com esse mesmo `moduloCodigo`).
- **Número acima do código de barras** (campo `codigo` no banco) — identifica a **peça
  individualmente**. É esse valor que o código de barras carrega, e é único por peça mesmo quando
  várias peças pertencem ao mesmo módulo (nos mesmos 17 peças do módulo `11244`, são 17 códigos
  de peça distintos). É esse campo (`codigo`) que a bipagem usa para casar o scan com a peça no
  banco — não o `moduloCodigo`.
- Esse `codigo` **não é 100% único globalmente**. Em teste com um projeto real (786 peças), ~2%
  se repetiam — mas **nunca dentro do mesmo lote/ambiente**, só entre ambientes diferentes do
  mesmo cliente. Por isso a unicidade no banco é `@@unique([loteId, codigo])`, não global, e a API
  de bipagem (`app/api/bipar/route.ts`) trata o caso de mais de uma peça com o mesmo código
  (`status: "AMBIGUA"`) pedindo pro operador escolher o lote certo.
- Cogitamos usar o `Cut_Pro.csv` (export para software de nesting) como fonte de dados, mas ele
  **nem sempre é gerado** (só aparece quando o projeto passa por otimização externa). O
  `Etiquetas.pdf` é a fonte confiável, porque é sempre gerado (é o próprio arquivo de impressão das
  etiquetas físicas) e representa exatamente o que sai colado na peça.

## Pilhas de separação (uma pilha física por módulo)

Cada módulo de um lote vira uma **pilha** numerada sequencialmente (1, 2, 3...), guardada no
campo `pilha` da `Peca`. A ideia: ao bipar qualquer peça, o sistema mostra "Coloque na pilha N",
então todas as peças do mesmo módulo acabam fisicamente juntas, resolvendo o problema original
que motivou o projeto (peças se perdendo entre um processo e outro por falta de separação clara).

- **Como é calculada**: no import (`app/api/importar/route.ts`), para cada lote, percorre as
  peças na ordem em que aparecem no PDF e atribui o próximo número de pilha a cada `moduloCodigo`
  novo que encontra (`Map<moduloCodigo, pilha>`). Isso faz a numeração das pilhas seguir a ordem
  real de corte/impressão do projeto — não é alfabética nem numérica pelo código do módulo.
- **Onde aparece**: na tela de bipagem (`app/bipar/bipagem-client.tsx`), em destaque bem grande
  logo após o scan, junto com "X de Y peças desta pilha já bipadas nesta etapa" (pra saber se a
  pilha já está completa ou se ainda falta peça chegando). Também no detalhe do lote
  (`app/lotes/[id]/page.tsx`), que agora agrupa a tabela por pilha em vez de listar peça solta.
- **Só aparece na etapa de Separação.** A instrução de pilha é ruído nas outras etapas (Corte,
  Coladeira) — decisão do usuário. Implementado com um campo `usaPilha Boolean` na `Etapa` (não
  hardcoded pelo nome da etapa), setado só para "Separação" no `prisma/seed.ts`. A API de bipagem
  (`app/api/bipar/route.ts`) só calcula e retorna `peca.pilha`/`progressoPilha` quando
  `etapa.usaPilha` é true; o client só renderiza o painel grande se `feedback.peca.pilha` vier
  definido.
- **Dado histórico**: peças importadas antes dessa mudança ficaram com `pilha = 0` (valor default
  da migration `add_pilha`). Foi rodado um script one-off pra recalcular a pilha dos lotes de
  teste já existentes (ordenando por `moduloCodigo` numérico, já que a ordem original do PDF não
  ficou salva) — não precisa rodar de novo, só serviu pra não perder os dados de teste na migration.

## Parsing do PDF de etiquetas (`lib/parseEtiquetas.ts`)

- **Uma etiqueta = uma página do PDF.** Isso só foi descoberto testando com `pdftotext -layout`
  (contando form-feeds `\f`). Foi a virada de chave que tornou o parsing confiável — antes disso
  tentamos separar por blocos de texto corrido, o que gerava falsos duplicados por causa de
  espaçamento inconsistente entre etiquetas.
- **A ordem do texto extraído pelo `pdf-parse` NÃO é a ordem visual da etiqueta.** Ex: numa
  etiqueta, o texto vem na ordem `Peça → Dimen → Chapa → Cliente → Projeto → Módulo → Pç/Ch →
  código`, não na ordem em que aparece impresso. Por isso o parser identifica cada campo pelo
  rótulo (regex por linha), independente da posição/ordem.
- Os campos `Ch:` (número da chapa) e `Pç:` (posição no nesting) vêm **na mesma "linha" separados
  por tab**, não por quebra de linha. O parser divide por `[\r\n\t]+`, não só `\r?\n`, por causa
  disso.
- Existem páginas de **"Sobra de Material"** misturadas no mesmo PDF (etiquetas de retalho de
  chapa, não são peças) — são ignoradas explicitamente (`SOBRA_RE`).
- `pdf-parse` é a **v2** (`PDFParse` class), API bem diferente da v1 clássica (`pdf(buffer)`).
- **Bug de bundler**: sob Turbopack (Next.js), a resolução automática do worker do `pdfjs-dist`
  falha (tenta importar um caminho dentro de `.next/` que não existe). Corrigido apontando
  manualmente `PDFParse.setWorker(...)` para o arquivo real dentro de `node_modules/pdfjs-dist`
  (ver topo de `lib/parseEtiquetas.ts`). Se essa dependência for atualizada, reveja isso primeiro
  se a importação começar a falhar com erro de "fake worker".

## Modelo de dados / regras de negócio (decisões confirmadas com o usuário)

- **Lote = todas as peças de um ambiente/cômodo** dentro de um projeto importado (ex:
  `1_COZINHAEAREA`). Não é o projeto inteiro nem uma seleção manual — é derivado automaticamente
  do campo `Projeto:` de cada etiqueta.
- **Sem login de operador.** A estação de bipagem só tem nome fixo (ex: "CNC 1") e etapa fixa,
  configurados uma vez e guardados em `localStorage`. Rastreabilidade é por estação, não por
  pessoa. Decisão explícita do usuário (trocado por simplicidade no dia a dia).
- **Alertas avisam mas não bloqueiam.** Peça bipada fora de ordem (pulou etapa anterior) ou
  bipada duas vezes na mesma etapa: o sistema registra e avisa (cor/som), mas sempre grava a
  bipagem — nunca impede o operador de prosseguir. Decisão explícita do usuário para não travar a
  produção por exceções legítimas.
- **3 etapas hoje**: Corte CNC → Coladeira de Bordas → Separação (a seccionadora de cortes
  avulsos ficou de fora por enquanto). A etapa 3 se chamava "Separação/Triagem Final" e foi
  renomeada para só "Separação" — o `prisma/seed.ts` faz upsert pela `ordem` (não pelo `nome`)
  exatamente pra permitir renomear uma etapa existente sem duplicá-la nem perder o histórico de
  bipagens (que referencia o `id`, que não muda). Uma etapa "Expedição" foi cogitada como próxima
  depois da Separação, mas não foi criada ainda (o usuário preferiu deixar só mencionado por
  enquanto — pedir explicitamente quando for a hora). Novas etapas não exigem mudança de código —
  só inserir linha na tabela `Etapa` com o `ordem` certo (e `usaPilha` se for o caso).

## Compatibilidade com iOS (Safari)

O iPhone tem duas restrições que o Android/Chrome não têm, ambas relevantes pra tela de bipagem:

- **Câmera exige HTTPS.** `getUserMedia` (usado pelo `@zxing/browser`) só funciona em "contexto
  seguro": `https://` ou `http://localhost`. Um IP de rede local por HTTP simples
  (`http://192.168.x.x:3000`, que é como acessamos pelo celular) **não conta como seguro pro
  Safari** — a câmera é bloqueada (digitação manual do código continua funcionando normalmente,
  só a câmera que falha).
  - **Para testar localmente com HTTPS**: rodar `npm run dev:https` em vez de `npm run dev`. Usa
    um certificado autoassinado em `certs/` (gerado uma vez com `openssl`, veja comando abaixo).
    No Safari vai aparecer um aviso de "conexão não é privada" — é esperado, toca em "Mostrar
    Detalhes" → "Visitar este site" e segue normal.
  - **Gotcha**: a flag padrão do Next.js (`next dev --experimental-https`, sem apontar
    `--experimental-https-key`/`--experimental-https-cert`) usa `mkcert`, que tenta instalar uma
    CA raiz no Windows — isso pede elevação de administrador (prompt do UAC) e **trava
    indefinidamente** se rodado num shell não-interativo (sem alguém pra clicar "Sim"). Por isso
    geramos o certificado manualmente com `openssl` (sem precisar de admin) e apontamos os
    caminhos explicitamente no script `dev:https` do `package.json`. Comando usado pra gerar:
    `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/localhost-key.pem -out
    certs/localhost.pem -config certs/openssl-san.cnf` (o `.cnf` inclui o IP da máquina como SAN).
    Esse certificado expira em 1 ano e não é versionado (`/certs` no `.gitignore`) — se expirar,
    só rodar o comando de novo.
  - Isso é só pra **teste local**. Publicando na nuvem (Vercel), o HTTPS já vem de fábrica com
    certificado válido, sem esse problema.
  - **Gotcha 2**: a primeira versão do `certs/openssl-san.cnf` tinha `keyUsage = keyEncipherment,
    dataEncipherment` (sem `digitalSignature`). Isso passa batido no Safari, mas **navegadores
    baseados em Chromium (Chrome, Edge...) recusam a conexão com erro
    `ERR_SSL_KEY_USAGE_INCOMPATIBLE`**, porque TLS moderno (ECDHE/RSA-PSS) exige `digitalSignature`
    no certificado do servidor. Corrigido pra `keyUsage = digitalSignature, keyEncipherment`. Se
    for gerar um certificado novo do zero, não esquecer o `digitalSignature`.
  - **Gotcha 3**: mesmo com o certificado certo, a página abria mas os **botões não faziam nada**
    (cliques em "Começar a bipar" resultavam numa navegação `GET /bipar?` no log — ou seja, o
    formulário caiu no submit nativo do HTML porque o JavaScript não tinha hidratado). Causa: o
    Next.js bloqueia por padrão o acesso a recursos de dev (HMR/websocket) vindos de um IP que não
    seja o próprio host — aparece no log como `Blocked cross-origin request to Next.js dev
    resource /_next/webpack-hmr from "<ip>"`. Sem o HMR conectar, a hidratação do React não
    completa e a página fica "morta" (só HTML estático, sem interatividade). Corrigido com
    `allowedDevOrigins: ["192.168.100.17"]` no `next.config.ts` (documentado pelo próprio aviso do
    Next.js no terminal). **Se o IP da máquina mudar, esse valor precisa ser atualizado.**
- **Áudio exige gesto do usuário.** Safari só libera `AudioContext` se ele for criado (ou
  retomado) dentro do clique/toque do operador — um `AudioContext` novo criado depois de um
  `await` (ex: depois da resposta da API) é bloqueado silenciosamente. Corrigido em
  `app/bipar/bipagem-client.tsx`: mantemos uma única instância de `AudioContext` num `ref`,
  destravada logo no clique do botão "OK" ou "Ativar câmera" (`obterAudioContext`), reaproveitada
  nas bipagens seguintes.
- **Câmera frontal por padrão.** Sem pedir explicitamente `facingMode: "environment"`, é comum o
  iPhone abrir a câmera frontal (selfie) em vez da traseira. Trocamos
  `reader.decodeFromVideoDevice(...)` por `reader.decodeFromConstraints({ video: { facingMode: {
  ideal: "environment" } } }, ...)` pra pedir a traseira explicitamente.
- **Leitura da câmera não pegava o código automaticamente — trocamos de biblioteca.** A primeira
  tentativa foi `@zxing/browser`/`@zxing/library` (port puro-JS do ZXing), com hints de formato +
  `TRY_HARDER` + resolução de vídeo maior. Não foi suficiente: continuou sem ler no dispositivo
  real testado. `zxing-js` tem reputação de ser pouco confiável pra código de barras 1D em câmera
  de celular (é uma biblioteca antiga, sem manutenção ativa). Substituído por
  **`@undecaf/zbar-wasm`** — um build WebAssembly do ZBar (biblioteca C, muito mais robusta pra
  decodificação 1D). Removidas as dependências `@zxing/browser` e `@zxing/library` do projeto.
  - Como funciona agora (`app/bipar/bipagem-client.tsx`): a câmera é aberta manualmente via
    `getUserMedia` (mesmos constraints de câmera traseira/resolução de antes) e anexada ao
    `<video>`. A cada 250ms, um `setInterval` desenha o frame atual num `<canvas>` invisível
    (`canvasRef`, reaproveitado entre frames) e chama `scanImageData` do zbar-wasm nesse frame. Um
    `leituraEmAndamentoRef` evita sobrepor scans se uma decodificação demorar mais que o intervalo.
  - **`zbar.wasm` é carregado de um CDN** (`ZBAR_WASM_URL`, jsdelivr) via `setModuleArgs({
    locateFile })`, em vez de deixar o bundler (Turbopack) tentar localizar o arquivo `.wasm`
    sozinho — isso é sugerido pela própria doc do zbar-wasm como "último recurso" pra bundlers
    problemáticos, e evitamos gastar tempo depurando a integração do Turbopack com WASM. **Efeito
    colateral**: a leitura por câmera passa a depender de internet (só a leitura — o resto do app
    continua funcionando 100% local/offline). Se um dia isso for um problema real (fábrica sem
    internet), dá pra trocar pra servir o `.wasm` localmente (está em
    `node_modules/@undecaf/zbar-wasm/dist/zbar.wasm`, só copiar pra `public/` e apontar
    `locateFile` pra lá).
  - zbar-wasm suporta os formatos que interessam aqui: Code 39/93/128, Codabar, EAN/GTIN,
    ITF, QR — cobre qualquer simbologia razoável que o Promob deva estar usando (nunca
    confirmamos qual exatamente — ver seção "O código da etiqueta").

## Decisões de stack (e por quê)

- **Prisma fixado em 5.22.0**, não a versão instalada por padrão (7.x). A v7 mudou bastante a
  arquitetura (exige adapters até para SQLite) e isso era risco desnecessário para um MVP. Se for
  atualizar o Prisma no futuro, ler o changelog da v6/v7 com atenção antes.
- **Next.js 16**: o projeto tem `AGENTS.md`/`CLAUDE.md` na raiz instruindo para ler
  `node_modules/next/dist/docs/` antes de mexer em rotas/App Router — a API pode ter mudado desde
  o treinamento do modelo (ex: `params`/`searchParams` são `Promise`, `refresh()` novo em
  `next/cache`, `PageProps`/`LayoutProps` helpers globais). Sempre checar essa pasta antes de
  fazer mudanças estruturais nas rotas.
- **SQLite local por padrão**, pensado para trocar para Postgres (Neon/Supabase) na hora de
  publicar na nuvem — ver seção "Publicando na nuvem" no `README.md`.
- **`@zxing/browser`** para leitura de código de barras via câmera (testado e confirmado
  funcionando pelo usuário em dispositivo real).

## Pendências / não implementado ainda

- Import via `Cut_Pro.csv` (dados mais ricos: furos, rebaixos, código de material) — hoje só
  usamos o `Etiquetas.pdf`. Ficou de fora por não ser gerado em todo projeto.
- Seccionadora de cortes avulsos como etapa própria.
- Reimpressão de etiqueta (para etiqueta danificada).
- Alertas de peça "parada há muito tempo" numa etapa.
