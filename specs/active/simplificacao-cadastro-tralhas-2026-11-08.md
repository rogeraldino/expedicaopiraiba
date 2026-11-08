# Simplificação do cadastro de tralhas — 08/11/2026

**Estado:** VALIDATED no sandbox · **Risco:** MEDIUM · **Solicitante:** Rodrigo · **Release:** `20261108T015957Z-8af82a25f422`

## Problema e resultado

O cadastro de tralhas exibe categorias com exemplos de peixes e pede especificações técnicas em JSON. O administrador deve escolher categorias curtas e claras, preencher os dados comerciais e escrever uma descrição comum, sem editar JSON.

## Escopo e comportamento

1. Preservar os cinco códigos de categoria existentes e os produtos já cadastrados. Os nomes passam a ser: `Varas e carretilhas pesadas`, `Varas e carretilhas leves e médias`, `Acessórios de pesca`, `Roupas e proteção` e `Iscas e atrativos`. O mesmo nome aparece no formulário, filtro, listagem e respostas da API.
2. Remover o campo de especificações técnicas do formulário de criação e edição, sua validação JSON e seu envio no payload. A edição não altera `technical_specs` já salvo. O campo legado pode continuar na API e no banco para compatibilidade e auditoria; nenhuma migração apaga dados.
3. Remover os modelos prontos do modal, que preenchem produtos e JSON de exemplo. O nome e a descrição usam dicas neutras. Busca e filtros continuam operando pelos campos de nome, descrição e código de categoria.

## Não objetivos

- Não alterar preços, estoque, locação, venda, reservas ou cobrança.
- Não excluir produtos ou especificações técnicas legadas.
- Não criar novas categorias nem reclassificar produtos automaticamente.

## Critérios e evidências

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Cinco nomes curtos em todos os pontos | `GearCategory`, migração de choices, filtro e modal do admin | Teste de API para `category_display`, build e inspeção visual |
| Cadastro sem JSON e preservação de legado | Modal sem campo/validação/payload `technical_specs`; serializer mantém campo legado | Teste de PATCH que preserva especificações existentes; busca no frontend |
| Fluxo comercial preservado | Códigos de categoria e campos comerciais sem alteração | Suíte relevante de operações e `make check-docs` |

**Evidência final:** 115 testes Django no PostgreSQL; build Next.js/TypeScript; `makemigrations --check --dry-run` sem alterações; `make check-docs`; modal no HTTPS do sandbox com cinco rótulos novos e sem JSON ou presets. O lint do arquivo do admin manteve os 6 erros e 12 avisos anteriores, sem ocorrência nova nesta mudança.

## Falhas e atualização

Falhas de salvar continuam visíveis no modal. Produtos legados mantêm categoria, descrição, preços, estoque e especificações já salvas. A mudança de nome das choices é aditiva para os dados: altera apenas rótulos, sem modificar os códigos persistidos.
