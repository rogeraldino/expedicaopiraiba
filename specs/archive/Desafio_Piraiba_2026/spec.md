# Desafio Piraíba — Rio Araguaia (2026)

```yaml
identificador_normativo: DESAFIO-PIRAIBA-2026
classificacao_risco: HIGH
status_documento: ACCEPTED
versao: 1.0
data_criacao: 2026-10-02
autoridade_de_produto: Rodrigo
ready_at: 2026-10-02
ready_by: Rodrigo
ready_evidence: resposta explícita "READY — implementar v1.0" nesta sessão
accepted_at: 2026-10-02
accepted_by: Rodrigo
accepted_evidence: pedido explícito "so aceita e faz o push" nesta sessão, após Ponytail PASS
accepted_implementation_sha: d57b037c1e0275563917b1579482520d5effdf57
owners:
  - docs/sdd/CONSTITUTION.md
  - specs/archive/E02_Customizacao-Expedicoes/spec.md
  - specs/archive/FaseA_Dominio-Geografico-Pousadas/spec.md
  - specs/archive/FaseB_Pacotes-Construtor-Expedicoes/spec.md
  - specs/archive/FaseC_Tralhas-CRM-Pescadores/spec.md
  - specs/active/Refinamento_UX_Pousadas_Wizard/spec.md
```

## Escopo

Criar uma expedição única e editável no painel, com nome “Desafio Piraíba — Rio Araguaia”, de 28 a 31/10/2026, destino São Félix do Araguaia/MT, origem Goiânia/GO, 12 vagas e preço de R$ 5.600 por pessoa. Publicar após validar os vínculos e a regra de saldo. O sinal será R$ 1.120 por pessoa; o saldo vence 7 dias antes da viagem, em 21/10/2026. Usar todas as espécies ativas do catálogo, com Piraíba como principal.

Criar a pousada “Pousada Solar das Águas” em São Félix do Araguaia/MT se ainda não existir, com dados mínimos e sem atribuir serviços, endereço ou horário não confirmados. O ponto de partida da expedição é Goiânia/GO; instruções exatas de encontro ficam vazias. Como `Expedition.save()` herda `Lodge.directions` quando `meeting_instructions` está vazio, a carga deve verificar que a pousada vinculada não possui instruções de chegada que acabariam anunciadas como encontro em Goiânia.

Criar o **Pacote da Expedição — Desafio Piraíba**, copiando as inclusões do pacote regular “Estrutura Completa Regular (Sem Open Bar Alcoólico)” existente na migração `0011`, sem alterar esse pacote histórico. As inclusões copiadas são: hospedagem com café, almoço e jantar; combustível 100% incluso; guias nativos em barcos com rádio VHF; iscas vivas e naturais; kit sashimi e ceviche no rio; refrigerantes, água e gelo; torneio esportivo entre duplas com troféus. Criar o cardápio **Bebidas — Desafio Piraíba** somente com Cerveja Heineken, Cerveja Stella Artois e Cerveja Original. Para cada cerveja escolhida pelo participante, 18 unidades por pessoa formam a quantidade operacional padrão de compra. Não prometer 54 cervejas por pessoa nem inclusão de álcool no preço. Confirmar que os produtos ativos existem antes de vincular. Não anunciar cerveja como open bar ou consumo ilimitado. As inclusões da expedição são um snapshot editável no admin; editar o pacote mestre posteriormente não atualiza automaticamente esse snapshot.

Reutilizar o acervo estático do projeto. Capa escolhida: `/gallery/piraiba-rio.jpg`; galeria inicial: `/gallery/captura-dupla.jpg`, `/gallery/barco-araguaia.jpg`, `/gallery/ponte-sao-felix.jpg`, `/gallery/pescaria-barco.jpg`. Todas foram verificadas como arquivos existentes. Ampliar o seletor de galeria do admin para selecionar múltiplas imagens da expedição em `gallery_image_urls`, mantendo a seleção de capa existente. O wizard deve enviar e preservar `gallery_image_urls` e instruções de encontro em criação e edição. Exibir essas imagens na página pública da expedição. Substituir o bloco de quatro destaques da hero por um bloco dinâmico da próxima expedição publicada, futura e com vagas, com acesso à reserva. Em caso de API indisponível ou registro ausente, hero, detalhe e checkout não oferecem reserva baseada em dados demonstrativos.

Usar o catálogo `Amenity` atual. A migração `0009` já define exatamente as 17 comodidades solicitadas e o banco local contém todas elas. Verificar presença no ambiente alvo; não duplicar registros nem atribuir à pousada serviços não confirmados.

## Não objetivos

- Não criar equipamentos, produtos de tralha, preços ou estoque: o organizador adiou essa definição. O CRUD existente permanece disponível.
- Não criar imagens novas nem URLs externas.
- Não criar outra expedição para o mesmo pedido.
- Não atribuir endereço ou horário de encontro não fornecidos.
- Não alterar reservas ou dados financeiros existentes.

## Estados, falhas e repetição

- Criação de dados deve ser idempotente por chaves estáveis; repetir a operação não deve criar segunda expedição, pousada ou pacote.
- Se um registro para 28–31/10/2026 já existir no ambiente alvo, conferir reservas antes de alterar. Alteração de expedição com reservas exige nova decisão humana sobre migração; não substituir silenciosamente.
- No banco local inspecionado em 02/10/2026 não há expedição nessas datas, pousadas ou pacotes; os registros parecidos estão apenas no comando de demonstração. O ambiente de publicação deve ser inspecionado novamente antes de escrever.
- A carga dedicada é transacional e idempotente por slug estável. Se já houver exatamente uma expedição da mesma data/destino sem reservas, atualizar esse registro e preservar seu slug e referências. Se houver múltiplas correspondências, reservas ou destino divergente, interromper sem escrever.
- Reexecutar intencionalmente a carga reconcilia os dados aprovados e sobrescreve edições posteriores feitas no admin se não houver reservas. O comando não é uma rotina periódica.
- Publicação só ocorre com capacidade, preço, sinal, destino, datas, pousada, espécies, pacote e cardápio corretos.
- A carga cria DRAFT e transiciona a PUBLISHED somente depois de todos os vínculos e validações concluídos.
- A hero seleciona a expedição publicada com vaga e menor `starts_at` ainda não passada em `America/Sao_Paulo`; empate por `slug`. O CTA vai diretamente ao checkout. Não apresenta CTA quando não houver uma elegível ou se houver falha na API.
- Detalhe e checkout de slug inexistente ou com falha de API não devem exibir expedição fictícia nem permitir envio do formulário de reserva.
- Falha ao carregar ou salvar galeria deixa o cadastro anterior intacto e mostra erro acionável.

## Decisão sobre o saldo

O prazo padrão de 30 dias produziria vencimento em 28/09/2026, data já passada. Rodrigo escolheu 7 dias antes, 21/10/2026.

## Critérios de aceite

1. Existe exatamente uma nova expedição com os dados aprovados, publicada e editável no admin; não foram criadas reservas.
2. Pousada, Pacote da Expedição, cardápio, capa e galeria podem ser editados pelos fluxos administrativos existentes ou sua extensão direta.
3. O novo cardápio contém as três cervejas solicitadas, com padrão operacional de 18 unidades para cada opção selecionada e sem promessa de álcool incluído.
4. Todas as espécies globalmente ativas no catálogo são vinculadas, inclusive as 16 encontradas no banco local, com Piraíba como única principal.
5. As 17 comodidades estão disponíveis para seleção sem duplicação.
6. A hero mostra a próxima expedição elegível e seu CTA abre a reserva correta; hero, detalhe e checkout não oferecem reserva fictícia quando a API falha ou retorna 404.
7. A página da expedição exibe apenas imagens existentes selecionadas no admin.
8. Testes relevantes, lint, TypeScript, migrações, `make check-docs` e `git diff --check` são executados; mudanças de domínio são verificadas no PostgreSQL real.

## Matriz inicial de conformidade

| Requisito | Implementação planejada | Evidência esperada |
|---|---|---|
| Dados e vínculos editáveis | Modelos e endpoints de operações existentes, carga idempotente | Consulta PostgreSQL e leitura via API admin |
| Imagens | `GalleryPickerModal`, `gallery_image_urls`, página pública | Teste de contrato e verificação de interface |
| Próxima expedição | `HomeHero` + API pública | Testes para próxima data, esgotada e falha da API |
| Comodidades | `Amenity` e migração `0009` | Consulta de presença/contagem sem duplicação |

## Evidência de implementação (02/10/2026)

| Requisito | Implementação | Evidência |
|---|---|---|
| Dados e vínculos editáveis | Comando `create_desafio_piraiba_2026`, modelos e admin existentes | PostgreSQL local: ID `cbab883e-48c7-4aa3-9c4a-7a902db21363`, PUBLISHED, 12 vagas, preço 560000 centavos, sinal 112000, saldo 7 dias, 16 espécies, 3 ofertas de 18, 0 reservas; segunda execução preservou ID. |
| Imagens | Seletor múltiplo no wizard e `gallery_image_urls` na página pública | Cinco arquivos existentes verificados em `frontend/public/gallery/`; API pública retornou a capa e as quatro fotos. |
| Próxima expedição | `HomeHero` filtra data local, vagas e dados publicados da API | Build Next.js/TypeScript e 2 testes Node passaram; home Docker retornou 200 com nome, capa e CTA corretos. |
| Comodidades | Catálogo `Amenity` existente | 17 ativas no PostgreSQL local; comando verifica nomes antes de criar. |
| Segurança da carga | Transação, preflight de datas/reservas, transição DRAFT→PUBLISHED | Dois testes de comando verificam repetição sem duplicação e bloqueio com reserva. |

O banco local não tinha registro do pacote regular; as inclusões exatas da migração `0011` foram usadas na carga dedicada. O contêiner backend não monta `frontend/public`, portanto a presença dos arquivos foi verificada no host antes da criação. O backend passou 31 testes relevantes, inclusive repetição com conteúdo divergente, bloqueio com reserva e round trip da galeria via API admin e pública. `make check-docs`, `manage.py check`, `makemigrations --check --dry-run`, build Next.js e `git diff --check` passaram. O lint geral encontrou 9 erros `react-hooks/set-state-in-effect` preexistentes; nenhum erro novo nos arquivos públicos alterados. O Ponytail independente ainda está pendente.

## Evidências e gates

- Grill e Counsel independentes antes de READY humano.
- Após READY: implementação, validação local e no ambiente real pertinente, Ponytail independente e ACCEPTED humano.
