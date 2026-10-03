# Planejamento Morazzini

Painel responsivo de compras, patrimônio e planejamento financeiro. Requer Node.js 22 ou superior; não usa dependências externas.

## Executar

```sh
npm run build
npm start
```

Abra http://localhost:3000. Para testar no celular conectado à mesma rede, acesse o IP do computador com a porta 3000 (o firewall precisa permitir a conexão).

## Organização

- `src/layout.html`: estrutura e navegação compartilhadas.
- `src/partials/items.html`: lista e cadastro de produtos.
- `src/partials/finance.html`: campos financeiros.
- `src/partials/summary.html`: resumo financeiro.
- `assets/css/base.css` e `mobile.css`: estilos gerais e ajustes responsivos.
- `assets/js/`: configuração, persistência, formatação, produtos, renderização e eventos separados.
- `server.cjs`: servidor local e consulta de páginas de lojas.
- `scripts/build.cjs`: gera `index.html`, `patrimonio.html` e `financeiro.html` a partir dos arquivos de origem. Execute após alterar `src/`.

## Produtos e dados

Cole o link da loja encontrado no Google Shopping. O servidor tenta ler nome e preço de metadados e JSON-LD. Confira a versão, a voltagem e o preço antes de confirmar. Lojas com bloqueios, login ou conteúdo carregado por JavaScript podem exigir preenchimento manual; qualquer produto pode ser cadastrado com nome, preço e link. Links de resultados do Shopping sem destino de loja exigem abrir a oferta e copiar o endereço da loja.

Não usa proxies públicos nem uma API oficial do Google Shopping. A importação automática depende da disponibilidade de cada loja. Abrir o HTML sem o servidor mantém a edição manual, mas não a consulta automática.

Os dados são lidos e gravados no Neon pelas APIs `state`, `session` e `import`, com acesso pela senha compartilhada do painel. O navegador guarda uma cópia local para recuperação de falhas. A indicação "Salvo no Neon" confirma a gravação. Versões do planejamento impedem sobrescrever silenciosamente alterações de outro dispositivo.

A antiga lista local pode ser importada usando "Importar itens deste navegador", no mesmo navegador e endereço em que foi cadastrada. A importação preserva os valores financeiros existentes no banco e evita repetir itens iguais. Se o banco estiver vazio, a lista local é usada na primeira conexão. Dados antigos de localhost não ficam disponíveis automaticamente no domínio da Vercel.

O servidor precisa de `DATABASE_URL`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH` (`salt:scrypt`, 64 bytes) e `DASHBOARD_SESSION_SECRET` (valor aleatório). Somente o hash da senha é armazenado; a sessão usa cookie HttpOnly, SameSite e Secure em produção. Essas variáveis nunca entram nos arquivos publicados. A API recusa leituras e alterações sem sessão, valida a origem das requisições de escrita e limita tentativas de login por uma janela de 15 minutos no banco. Ao trocar a senha, troque também o segredo da sessão para invalidar os acessos antigos.

A lista inicial fica em `lib/default-items.cjs` e só é enviada após login. Dados reais da empresa não devem ser adicionados ao código ou aos arquivos públicos. O repositório contém somente a estrutura e os exemplos iniciais; valores reais ficam no Neon. O controle de acesso do painel não restringe quem possui credenciais do banco ou acesso ao projeto Neon/Vercel.

## Verificação e Git

```sh
npm test
git status
git add .
git commit -m "Organiza páginas e melhora cadastro de produtos e UI mobile"
```

O repositório Git local está preparado. Crie o repositório remoto no provedor escolhido e configure `git remote add origin URL_DO_REPOSITORIO`, seguido de `git push -u origin main`. Nenhum remoto é configurado automaticamente.

## Publicar na Vercel

O arquivo `vercel.json` configura o projeto sem framework, com `npm run build` e saída `dist/`. O build copia somente páginas, estilos, scripts e logos para a publicação. A consulta de produtos funciona por `api/product.mjs`, uma função Node.js que reutiliza a leitura segura das lojas em `server.cjs`.

Conecte o repositório na Vercel e use a branch `main`. O servidor de desenvolvimento (`npm start`) não precisa ser executado na hospedagem. A configuração Neon está em `neon.ts`; migrações e documentação do banco estão em `db/`. Não publique `.env.local` nem `.neon`.
