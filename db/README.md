# Banco do dashboard

Migrações SQL versionadas em `migrations/`. O executor usa conexão direta, TLS com validação do certificado, transação e trava para impedir aplicações concorrentes. A tabela `migracoes_dashboard` registra cada arquivo com SHA-256; migrações já aplicadas não são executadas novamente e não devem ser editadas.

## Tabelas

- `planejamentos`: planejamento da empresa, nome, moeda e datas. O perfil inicial Morazzini tem id `c1acfc7e-9c85-4e23-a451-d518e59c1332`.
- `itens`: nome, preço, link da oferta, ordem, status e data da compra. `planned` corresponde à lista de abertura; `purchased` corresponde ao patrimônio. Alterar o status evita copiar ou duplicar o item entre tabelas. Uma compra exige `purchased_at`.
- `configuracoes_financeiras`: valor guardado, salário mensal e percentual a guardar, uma configuração por perfil.
- `migracoes_dashboard`: histórico técnico das migrações.
- `tentativas_login`: limite de tentativas por origem, com identificador protegido por HMAC e janela de 15 minutos.

Valores monetários usam `numeric(14,2)`, evitando erros de ponto flutuante. Percentuais ficam entre 0 e 100; nomes vazios, preços negativos e links com protocolos inválidos são rejeitados. `updated_at` é atualizado por triggers. Totais, progresso e prazo devem ser calculados a partir dos registros, como no dashboard atual.

## Executar

`npm run db:migrate` usa `DATABASE_URL_UNPOOLED` de `.env.local`. Para um ambiente separado:

```sh
node scripts/db.cjs migrate .env.schema-test
node scripts/db.cjs verify .env.schema-test
node scripts/db.cjs inspect .env.schema-test
```

`verify` cria um item temporário, testa a compra e as restrições, e reverte os registros de teste. Teste novas migrações em uma branch temporária antes de aplicar em produção.

O perfil Morazzini e a configuração financeira inicial foram criados pela migração. A API grava os itens e as finanças neste perfil, com senha compartilhada e verificação de versão (`planejamentos.revision`). A primeira conexão importa a lista local se o banco estiver vazio; importações posteriores usam o botão do painel e preservam as finanças existentes. Credenciais do banco permanecem no servidor.
