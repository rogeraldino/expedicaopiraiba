# Épica — Entrega operacional e comercial do MVP

Identificador proposto: `ENTREGA-OPERACIONAL-MVP`.
Versão: 0.2, 21/10/2026. Status: **IN_PROGRESS — estágio 1 VALIDATED (Ponytail PASS), publicado e verificado no sandbox**.
Responsável pelo produto: Rodrigo.
Base técnica: `ad84eed57db10743f17c9ab5ba84351bdffd1d8d`.

Retomada após pausa técnica: Estágio 1 validado com Ponytail PASS independente,
publicado no sandbox em HTTPS real (`sb.expedicaopiraiba.com.br`), uploads persistentes
e catálogo integrados, aguardando validação visual e aceite humano do estágio.

## Objetivo

Permitir que o organizador publique uma expedição com fotos próprias, receba
reservas e pagamentos, acompanhe o preparo dos participantes e conduza o
embarque com dados confiáveis. O cliente deve conseguir comprar, recuperar
seu acesso e concluir sua preparação sem utilizar simuladores.

O [diagnóstico de 21/10](../../docs/AUDITORIA_OPERACIONAL_2026-10-21.md)
contém os achados, reproduções e limites da evidência.

## Escopo preservado e estratégia de prazo

Reaproveitar o backend, o painel e as telas atuais. Corrigir as ligações entre
eles, completar os provedores e executar uma homologação integral.

O escopo de provedores registrado em [PROVIDER_PREP](../../docs/PROVIDER_PREP.md)
inclui **Pix, cartão, boleto, cancelamentos e devoluções**, com WhatsApp e
e-mail transacionais. Este plano preserva esse compromisso. Uma estreia com
Pix/e-mail seguida dos outros métodos seria uma alternativa de redução de
prazo, sujeita a decisão expressa do responsável, não uma premissa adotada.

Três estágios com critérios de saída; consolidar as dúvidas de produto antes
da implementação HIGH. Preparar as pendências externas da Meta no início,
enquanto avança o trabalho independente de mídia e correções locais.

Execução autorizada por Rodrigo em 21/10/2026: «remova a estimastiva de dias,
comece agora». A entrega será acompanhada por critérios concluídos e evidências.

## Estágio 1 — Sandbox utilizável e autonomia de conteúdo

Resultado: organizador consegue criar e revisar a oferta completa no sandbox,
com fotos próprias, sem depender de edição de código.

Entregas:

1. Corrigir o roteamento do gateway com query strings. Versionar a fonte
   efetiva da infraestrutura e registrar release/rollback do artefato.
2. Conferir a configuração explícita dos provedores por ambiente antes de
   executar novos cenários de compra. Presença de token não deve representar
   autorização implícita para cobrança real no sandbox.
3. Preparar carga revisada da expedição aprovada e seus vínculos, checklist,
   bebidas, logística e imagens; reaproveitar o comando específico existente
   após verificar suas pré-condições. Evitar publicar datas vencidas ou usar
   `seed_demo` como carga comercial.
4. Adicionar upload administrativo e biblioteca de mídia compartilhada por
   expedições, pousadas e equipamentos; permitir capa e galeria com preview,
   estado de envio e erro legível.
5. Adotar armazenamento persistente externo ao container, com chave de arquivo
   própria, validação de formato/conteúdo/tamanho/dimensões, miniaturas e
   referência ao autor. Especificar remoção de mídia em uso, falha parcial e
   recuperação dos arquivos em backup.
6. Preservar os caminhos/URLs existentes e manter a definição de onde as fotos
   aparecem: biblioteca administrativa, galeria da expedição e galeria pública.

Critérios de saída:

- Home, galeria e capas respondem com imagens válidas pelo domínio protegido;
  APIs com filtros funcionam; requisições sem cookie mantêm a proteção.
- Organizador envia uma foto pelo admin e a usa na oferta; foto e vínculo
  continuam disponíveis após recriar o container.
- Uma expedição revisada aparece na vitrine do sandbox, com datas e valores
  corretos, bebidas e checklist configurados.
- Nenhuma cobrança ou mensagem real é disparada por esses critérios.

Achados: IMG-01, CAT-01, MEDIA-01, FLOW-01, parte de OPS-01.

## Estágio 2 — Identidade e venda real completas

Resultado: cliente verifica um canal, paga pelo método contratado, recebe
confirmação confiável e recupera a reserva em outro dispositivo.

Entregas:

1. Implementar adaptadores de e-mail e WhatsApp com rastreabilidade de envio,
   falha, retry e idempotência; enviar OTP e links aos canais definidos na
   spec. Resolver faturamento/template/permissões Meta quando aplicável.
2. Remover `dev_code` de ambientes comerciais, impedir alteração de contato
   de cliente existente antes da verificação e corrigir persistência de
   tentativas, expiração, reenvio e proteção contra abuso/enumeração.
3. Fechar a semântica de reacesso, sessão, alteração sensível e recuperação de
   canal; declarar a precedência entre E04 e as regras de canal verificado do
   MVP. Revogar/versionar tokens de convidados na substituição.
4. Corrigir e unificar sinal por quantidade de participantes, totais, saldo e
   ocupação entre vitrine, checkout, admin, compra direta e manifesto.
5. Isolar os simuladores no servidor e no frontend; uma cobrança real não
   pode ser marcada como paga por chamada do cliente.
6. Concluir Pix e implementar cartão/boleto no provedor escolhido. Guardar
   identificadores e chave de idempotência estável antes dos retries; fechar
   validade/reemissão da cobrança, estados intermediários e reconciliação.
7. Exigir assinatura válida no webhook e confrontar a consulta do provedor com
   pagamento/reserva, valor, moeda e ambiente. Persistir recebimento e resultado
   para retry/replay; falha de processamento não pode ser perdida por ACK 200.
8. Definir e implementar pagamento tardio, cancelamento no provedor, devolução
   total/parcial e tratamento de contestação, preservando auditoria e vagas.
9. Substituir o sucesso por simulação pelo acompanhamento de status real;
   exibir código/QR Pix, informações do boleto e erros/retomada do pagamento
   inicial e do saldo. Criar sessão do comprador em ponto explícito do fluxo.
10. Concluir confirmação transacional e recuperação da reserva por canal,
    com destinatários, conteúdo e repetição definidos.

Critérios de saída:

- Cliente novo e recorrente recebem/validam OTP; tentativas erradas persistem;
  alteração de contato sem comprovação e acesso de terceiro são rejeitados.
- Para 1, 2 e 4 participantes, valor exibido, sinal cobrado e saldo conferem.
- Sinal seguido de saldo não altera artificialmente a ocupação; concorrência
  na última vaga é validada em PostgreSQL.
- Pix, cartão e boleto percorrem sucesso, falha, pendência e retomada no
  ambiente de homologação; assinatura ausente/inválida, valor/referência
  divergentes e evento repetido não confirmam pagamento indevidamente.
- Pagamento após expiração e devolução obedecem à política aprovada, sem
  overbooking e sem perda de eventos.
- Cliente acessa a reserva em outro dispositivo; convidado mantém isolamento
  financeiro e link anterior à substituição é rejeitado.
- Evidência de provedor real distingue criação de cobrança, confirmação,
  webhook e conciliação. Testes com mock não fecham esse gate.

Achados: AUTH-01/02/03, PAY-01 a PAY-07, CAP-01, GUEST-01, MSG-01.

## Estágio 3 — Preparação, embarque e liberação da operação

Resultado: uma reserva completa chega à operação com valores, passageiros,
preferências e equipamentos consistentes; a versão está pronta para publicação.

Entregas:

1. Conectar seleção de tralhas do cliente ao catálogo e adicionais do backend,
   com preço/estoque calculados no servidor e vínculo ao participante. Eliminar
   a dependência comercial de resumo textual e localStorage; fechar o ciclo
   de devolução de estoque na expiração/cancelamento e de locação por viagem.
2. Validar completude da ficha conforme E04 e levar dados operacionais
   necessários ao manifesto, incluindo emergência, saúde e tamanho de colete,
   com acesso restrito e apresentação adequada.
3. Conferir bebidas, restrições e checklist do titular e convidado; comparar
   preparo informado, manifesto, compras, adicionais e saldo.
4. Publicar os textos de termos, privacidade e cancelamento aprovados pelo
   responsável, com aceite/versionamento rastreável na reserva.
5. Alinhar runbooks e configuração efetiva; produzir release identificada por
   commit/artefato, backup atual com restauração em ambiente isolado, rollback,
   monitoramento de falhas e procedimento de reconciliação.
6. Executar um checkpoint completo da versão candidata: testes backend e
   concorrência PostgreSQL, frontend, lint, TypeScript, build, migrações,
   auditoria de dependências, documentação e verificação visual em celular e
   desktop. Cobrir falha de rede, expiração de sessão e retomada.
7. Fazer revisão independente e homologação do responsável sobre a versão
   imutável; liberar produção apenas após esses critérios.

Critérios de saída:

- Uma compra e uma venda manual completas chegam a manifesto e lista de
  compras corretos; titular e convidado concluem preparação.
- Tralha selecionada aparece no admin/manifesto com estoque e financeiro
  consistentes e persiste em outro dispositivo.
- Cancelamento, expiração e devolução são conciliados e auditáveis.
- Fotos, dados e configurações sobrevivem à recriação e são recuperáveis.
- Nenhum P0 desta auditoria permanece aberto; critérios obrigatórios do
  escopo têm evidência, revisão e aceite conforme a Constituição.

Achados: GEAR-01, BOARD-01, LEGAL-01, OPS-01 e regressão dos estágios anteriores.

## Decisões a fechar no refinamento

| Decisão | Quem decide | Trabalho independente que pode avançar |
|---|---|---|
| Sinal por pessoa/reserva e tratamento de cobranças existentes | Rodrigo, confrontando owners e oferta | Diagnóstico do cálculo e cenários de regressão |
| Reacesso com comprovação de canal; precedência sobre E04 | Rodrigo | Adaptadores, contagem persistente e proposta de migração |
| Parcelas/juros, vencimento de boleto, hold e pagamento tardio | Rodrigo | Contratos do provedor, UI e recebimento durável de eventos |
| Cancelamento, devolução e contestação | Rodrigo | Mapeamento técnico e trilha auditável |
| Escopo mínimo de mensagens recebidas e eventos/destinatários de envio | Rodrigo | Upload, correções locais e adaptador de e-mail |
| Meta: faturamento, permissões e template | Titular/administrador da conta | Trabalho local e e-mail alternativo previsto no MVP |
| Limites/visibilidade/remoção de uploads e inclusão na galeria pública | Rodrigo, com proposta técnica | Inventário do acervo, modelo e desenho da biblioteca |

## Governança e conformidade mínima

Este documento acompanha a execução autorizada da épica; não redefine owners
aprovados nem declara ACCEPTED. As especificações dos incrementos fecham
comandos, estados, erros, retries, migração e provas de aceite.

Autenticação, pagamentos, armazenamento/acesso a arquivos e infraestrutura
envolvem gatilhos HIGH da [Constituição](../../docs/sdd/CONSTITUTION.md).
Aplicar Grill/Counsel e Ponytail independentes e registrar READY/ACCEPTED
humanos nos pontos previstos; não repetir autorização já concedida para
escopo idêntico. A autorização acima inicia o estágio 1; políticas financeiras
pendentes continuam registradas para refinamento do estágio 2.

| Requisito | Implementação prevista | Prova de aceite | Estado |
|---|---|---|---|
| Mídia e sandbox | Gateway, upload e biblioteca | HTTPS autenticado + recriação + recuperação de foto | Planejado |
| Oferta revisada | Catálogo, publicação e configuração | Expedição completa no sandbox | Planejado |
| Canal e acesso | Clientes, adaptadores e tokens | OTP real, abuso, retomada e isolamento | Planejado |
| Venda e recebimento | Pagamentos, checkout, webhook | Homologação por método e retry/reconciliação | Planejado |
| Integridade comercial | Reservas, disponibilidade e adicionais | Cenários monetários + concorrência PostgreSQL | Planejado |
| Preparo e embarque | Cliente, convidado e operações | Manifesto/compras comparados à reserva | Planejado |
| Publicação | Release, observabilidade e backup | Versão imutável, restauração, rollback e aceite | Planejado |

Melhorias posteriores: refatoração ampla do admin, novos relatórios, automações
avançadas de atendimento e alta disponibilidade. A existência de backlog
antigo marcado como pendente não implica refazer as fases já implementadas.
