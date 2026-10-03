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

Os dados anteriores continuam na mesma chave do localStorage. São locais ao navegador e à origem (domínio/porta): ao mudar de arquivo local para localhost, os dados não migram automaticamente. Não há sincronização entre dispositivos.

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

Conecte o repositório na Vercel e use a branch `main`. O servidor de desenvolvimento (`npm start`) não precisa ser executado na hospedagem. A configuração Neon está em `neon.ts`; o dashboard ainda salva os dados no navegador. Não publique `.env.local` nem `.neon`.
