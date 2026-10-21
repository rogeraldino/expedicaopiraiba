# Estágio 1 — Sandbox e biblioteca de imagens

Versão 0.1 — 21/10/2026. Risco HIGH. Estado: VALIDATED — Ponytail independente
PASS em 21/10/2026 ([ponytail.md](ponytail.md)), Grill/Counsel registrado. Ponto de retomada no
[HANDOFF](../../../HANDOFF.md). Incremento integrante
da [épica](../ENTREGA_OPERACIONAL_MVP.md). Autorização: Rodrigo, 21/10/2026,
«remova a estimastiva de dias, comece agora». Aceite humano permanece pendente.

## Contrato

1. Restaurar URLs com query string no sandbox. Somente a rota interna `/check`
   ignora query string para seleção do handler. Cookie, host, validade, rate
   limit, métodos e normalização de `X-Forwarded-Uri` permanecem obrigatórios.
   Login com query string continua rejeitado. Nenhuma exceção pública nova.
2. Oferecer biblioteca no admin a usuário autenticado por OperationsAuthentication.
   Exigir também IsAuthenticated; autor vem de settings.ADMIN_EMAIL.
   Listar e enviar arquivos via `/api/operations/media/`. Manter as 22 imagens
   locais no seletor. Capa/galeria da expedição e capa de pousada usam o seletor;
   equipamento recebe acesso ao mesmo seletor, preservando campo de URL.
3. Upload limitado a JPEG, PNG ou WebP estáticos; máximo 10 MiB e 24 milhões de
   pixels; cada dimensão mínima 1 e máxima 12.000 pixels. Verificar bytes reais,
   ignorando extensão/MIME declarado. Rejeitar animações, SVG, documentos e
   arquivos truncados. Orientar pela EXIF e remover metadados pessoais.
   Limitar multipart antes de spooling com upload handler de bytes limitado e
   rejeitar Content-Length acima de 10 MiB + 256 KiB; arquivo mantém 10 MiB.
4. Converter para WebP, imagem principal no máximo 2400×2400 e miniatura no
   máximo 400×400, preservando proporção e transparência. Nomes UUID gerados
   pelo servidor, sem aceitar caminhos do cliente. Nome original é apenas
   metadado, não caminho. Registrar autor administrativo e data.
5. Mídia serve exclusivamente à divulgação do negócio: seu envio no admin
   disponibiliza URL para associação a páginas públicas. Informar isso no
   seletor. Não usar esta biblioteca para CPF, documentos ou dados de saúde.
   `/api/media/<uuid>/<variant>/` permite GET/HEAD da imagem/miniatura; sandbox
   continua protegido pelo gateway. Variante ou UUID inválidos retornam 404.
   URLs /api/media/ usam Next/Image unoptimized, pois já são WebP processadas.
6. Não há edição de bytes, exclusão ou publicação automática na galeria
   institucional nesta versão. Substituir a referência da capa é reversível;
   arquivos anteriores permanecem na biblioteca. A listagem tem paginação e
   ordenação estável por data/UUID, sem retornar dados pessoais de clientes.
7. Uma submissão concluída gera um ativo imutável. Repetir a requisição após
   resposta perdida pode gerar outro ativo: não altera o anterior, reserva ou
   cobrança. O cliente só associa o ativo após resposta de sucesso.
8. Gravar arquivos antes de confirmar o metadado em transação; falha de escrita
   ou banco remove somente os arquivos da tentativa e não deixa ativo válido
   com arquivos ausentes. Não expor detalhes internos nos erros HTTP.
9. Armazenamento no host `/srv/piraiba/<ambiente>/media`, bind mount exclusivo
   de cada backend em `/app/media`, gravável pelo UID 1000. A árvore já integra
   o backup cifrado como `deployments`. Sem compartilhar arquivos entre ambientes.
   Caminho configurável MEDIA_ROOT; desenvolvimento usa diretório ignorado.
10. Migração adiciona somente tabela de ativos: nenhuma reescrita das URLs
    atuais nem de dados comerciais. Container recriado preserva mídia; leitura
    sempre consulta metadado confirmado antes de abrir o arquivo conhecido.
11. Publicar a aplicação somente no sandbox nesta etapa. A oferta aprovada é
    criada por comando específico depois de suas pré-condições verificadas,
    com checklist e logística existentes aprovados; falha de pré-condição não
    autoriza sobrescrever catálogo ou inventar logística. Produção continua
    em manutenção; nenhuma cobrança ou mensagem de teste real é necessária.

## Owners e precedência

Constituição; E02 para URLs e mídia; Refinamento UX Pousadas/Wizard para seletor;
Infra Produção/Sandbox para cookie e isolamento. Este incremento adiciona
armazenamento e upload ao contrato de mídia, preserva referências existentes e
não altera autorização de clientes, estados financeiros ou condições da oferta.

## Matriz de aceite

| ID | Requisito | Evidência necessária | Estado | Evidência observada |
|---|---|---|---|---|
| AC01 | Query string com/sem cookie | Regressão de gateway e HTTPS real | PASS | 7 testes gateway PASS; HTTPS real: hero image 200 image/jpeg, `?v=1` 200 image/webp, `/api/expeditions/?page=1` 200, sem cookie 401 |
| AC02 | Upload somente admin | API autenticada e rejeição anônima | PASS | Anônimo 403; autenticado com OperationsAuthentication retorna 201; listagem sem autor exposto |
| AC03 | Validação/transformação de bytes | Formatos aceitos, conteúdo inválido, animação, limites e metadados | PASS | JPEG/PNG/WebP 201; SVG/GIF/corrompido 400; animado 400; >24MP/>12k px 400; >10MB 413 pré-decode; EXIF/XMP expurgados e orientação corrigida |
| AC04 | Arquivos consistentes e isolados | Falha de escrita/banco, GET/HEAD, 404, recriação e recuperação de mídia | PASS | Atômico com rollback limpo em falha de DB/disco (503); GET 200 e HEAD 200; variante inválida 404; persistência testada após restart do backend no sandbox |
| AC05 | Seletores preservam acervo e usam uploads | TypeScript/build e fluxo real no sandbox | PASS | MediaPicker mantém 22 fotos legadas e lista novos uploads; Next.js build e TS 0 erros; patch real na Pousada Solar das Águas refletido na API pública |
| AC06 | Sem efeitos externos financeiros | Configuração de teste explícita antes de fluxo de compra | PASS | Nenhuma cobrança executada no sandbox ou produção; chaves de sandbox isoladas |
| AC07 | Oferta e configuração | Pré-condições da carga, catálogo e checklist revisados | PENDENTE ACEITE | Pré-condição estrita de direções/logística verificada na pousada Solar das Águas (evita conflito de instruções com Goiânia/GO) |

Falhas de upload retornam 400/413 para conteúdo/tamanho e 503 para armazenamento
indisponível; listagem anônima segue a negação de OperationsAuthentication.
Migração/rollback preservam arquivos e referências; não remover volume no rollback.
