# Counsel — Estágio 2 v0.1

**Data:** 21/10/2026  
**Revisor:** Agente Revisor Independente (SDD Counsel / Constituição §5)  
**Alvo da Análise:** Confronto com owners existentes e precedência normativa para o Estágio 2  
**Owners Referenciados:** `CONSTITUTION.md`, `PRODUCT-MVP`, `E01-P0-CLOSURE`, `E03-VENDA-DIRETA-MANIFESTO`, `E04-PORTAL-CLIENTE-FICHA`, `PROVIDER_PREP.md`  

---

## 1. Confrontação de Alternativas e Decisões de Produto

### 1.1. Contingência de Canal de Comunicação (E-mail vs. WhatsApp)
- **Alternativa A (Bloqueante):** Postergar a entrega da autenticação e notificações até que o titular da conta Meta resolva as permissões de faturamento da WABA e obtenha aprovação do template de autenticação.
- **Alternativa B (Contingência Gradual — Aprovada):** Operar imediatamente o envio de códigos e confirmações de compra via E-mail (Gmail SMTP autenticado e testado no host), mantendo o cliente da API do WhatsApp Cloud integrado e pronto para disparo imediato assim que os modelos forem aprovados.
- **Parecer do Counsel:** A Alternativa B é plenamente aderente aos princípios de entrega contínua do MVP registrados em `ENTREGA_OPERACIONAL_MVP.md` e foi homologada pelo responsável Rodrigo em 21/10/2026. Evita o travamento da operação comercial por burocracias externas de terceiros, preservando a segurança de autenticação do comprador.

### 1.2. Coleta de Endereço do Pagador no Checkout
- **Alternativa A (Fricção Global):** Tornar obrigatórios os campos de endereço residencial (CEP, rua, número, bairro, cidade, UF) para todos os clientes no primeiro passo do checkout.
- **Alternativa B (Coleta Condicional — Aprovada):** Manter o checkout minimalista (Nome, CPF, Telefone, E-mail) para os pagamentos via PIX e Cartão de Crédito, exibindo os campos de endereço somente se o cliente selecionar a opção "Boleto Bancário" (onde a regulamentação do BACEN e a API do Mercado Pago tornam a identificação residencial do pagador obrigatória).
- **Parecer do Counsel:** A Alternativa B foi formalmente chancelada pelo organizador em 21/10/2026. O modelo `CustomerProfile` já possui os campos de cidade e estado; a adição dos campos de logradouro, número, complemento e CEP completa o cadastro do pescador sem criar atrito de conversão nas compras via PIX.

### 1.3. Precedência Normativa sobre a Épica E04 (Reacesso ao Portal)
- **Conflito Identificado:** A Épica arquivada `E04_Portal-Cliente-Ficha` definia que o endpoint `/api/me/auth/lookup/` autenticava o comprador e devolvia a sessão com base apenas na conferência do CPF e dos dígitos finais do telefone, sem emitir código de verificação. A auditoria de 21/10/2026 demonstrou que essa lógica permitia que terceiros que conhecessem o telefone de um passageiro tomassem controle do painel financeiro da reserva (achado AUTH-03).
- **Parecer do Counsel:** Em conformidade com a Constituição § 10 (Supersessão e Migração), a especificação do Estágio 2 supersede formalmente o mecanismo de login da E04. Todo reacesso ao portal do cliente agora requer autenticação em dois fatores com envio e conferência obrigatória de OTP, garantindo conformidade com a LGPD e a segurança de dados dos participantes.

---

## 2. Conclusão do Counsel

Não há conflitos conceituais não resolvidos. As escolhas técnicas respeitam os limites da Constituição, protegem a integridade transacional das reservas e alinham-se rigorosamente com as decisões manifestadas pelo responsável pelo produto. O Estágio 2 encontra-se apto para a declaração de READY humano.
