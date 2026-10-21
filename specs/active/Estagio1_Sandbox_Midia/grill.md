# Grill/Counsel — estágio 1 v0.1

21/10/2026. Revisor independente: agente `/root/grill_estagio1`, somente leitura.
Execução autorizada por Rodrigo em 21/10 sobre a épica apresentada: «remova a
estimastiva de dias, comece agora». Nenhuma autorização comercial adicional.

Resultado: prosseguir após incorporar quatro ajustes técnicos, sem nova decisão
de produto bloqueante identificada: IsAuthenticated explícito; autor configurado
em ADMIN_EMAIL; limite de ingestão antes de ocupar tmpfs; unoptimized nas imagens
/api/media/. Ajustes incorporados ao contrato v0.1 antes do upload.

Delta gateway: PASS independente. Ignorar query exclusivamente na seleção de
/check preserva validação de cookie, URI conservadora, rate limit e login estrito.
Testes de regressão: sete PASS. HTTPS após implantação confirmou otimizador e API
com query 200; API sem cookie GET/POST 401. Login com query continua coberto.

Critérios de execução técnicos fechados para sandbox/mídia sob autorização da
épica. A revisão não declara ACCEPTED; Ponytail e evidências reais do upload
continuam necessários antes de encerrar o estágio.
