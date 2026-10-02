# Ponytail independente — Desafio Piraíba 2026

Data: 02/10/2026  
Revisor: agente independente da implementação  
Versão revisada: spec v1.0, árvore de trabalho antes do commit final  
Veredito após revisão delta: **PASS** para a implementação e validação locais. O aceite humano e a revisão do SHA final permanecem gates separados da Constituição.

## Achados iniciais e disposição

1. **Resolvido — carga de registro publicado divergente.** O retorno antecipado foi removido. O comando reconcilia a única expedição DRAFT ou PUBLISHED sem reservas dentro de transação; bloqueia estados incompatíveis e registros com reservas. O teste de drift altera dados já publicados e confirma a restauração do conteúdo aprovado sem duplicar a expedição.
2. **Resolvido — conteúdo de pacote/cardápio pré-existente.** O pacote dedicado é atualizado com inclusões aprovadas; itens de cerveja e ofertas fora das três opções são removidos. Antes da alteração, o comando rejeita pacote dedicado compartilhado com outra expedição. O teste de drift insere bebida e oferta extras e confirma que restam somente as três.

## Revisão delta e evidência

- A seleção da hero foi extraída para `next-expedition.ts`; dois testes Node passaram para data passada, esgotada, próxima data, desempate e ausência de elegível. A API pública só lista publicadas. A home usa `force-dynamic`, evitando prerenderizar lista vazia durante o build. Smoke HTTP local após build Docker mostrou home 200 com nome/capa/CTA corretos, detalhe e checkout 200, checkout de slug inexistente 404.
- O seletor múltiplo, payload do wizard e serializer administrativo mantêm capa, galeria e instruções. Teste de integração no PostgreSQL cobre PATCH/GET administrativo e leitura pública da galeria, inclusive edição posterior. A interface de seleção foi revisada pelo código; não há automação visual de cliques, então a prova de interação visual é limitada.
- O backend passou 31 testes e os dois testes Node passaram. `make check-docs`, build Next.js/TypeScript, Django check, verificação de migrations e `git diff --check` passaram. O lint geral mantém nove erros React preexistentes de `set-state-in-effect`, sem erros novos nos arquivos públicos alterados. Os dados foram verificados no PostgreSQL local real; a carga não foi executada em produção nesta revisão.
- A reexecução intencional do comando sobrescreve edições administrativas da expedição enquanto não houver reservas. Esse comportamento agora está explícito na spec, no `HANDOFF.md` e no runbook; o comando não é rotina periódica.

## Conformidade observada

- O comando usa transação, chave de slug estável e bloqueia alterações quando há reservas.
- Capa e quatro fotos pertencem ao acervo `frontend/public/gallery/`; a página pública usa `gallery_image_urls` da API.
- A hero deixa de exibir CTA quando a lista pública está vazia; detalhe e checkout chamam `notFound()` se a API falha ou retorna erro.
- As 17 comodidades são verificadas antes da criação, sem duplicação no comando.

## Gate final

Nenhum achado bloqueante permanece na implementação local revisada. Este PASS não é aceite humano. A Constituição exige revisão do SHA imutável e declaração ACCEPTED da autoridade humana antes de arquivar o dossiê; eventual publicação em outro ambiente requer seu próprio preflight de colisões/reservas e verificação nesse ambiente.
