# Parecer Ponytail Independente e Adversarial — Estágio 1 (Sandbox e Biblioteca de Mídia)

**Data da Revisão:** 21/10/2026  
**Revisor Independente:** Agente Ponytail (somente leitura)  
**Documento Normativo:** `docs/sdd/CONSTITUTION.md` (v0.2-pilot) e `specs/active/Estagio1_Sandbox_Midia/spec.md` (v0.1)  
**Veredito:** **PASS**

---

## 1. Resumo Executivo e Veredito

A implementação do **Estágio 1 (Sandbox e biblioteca de imagens)** foi submetida a revisão técnica adversarial profunda em conformidade com as regras da Constituição (seções 8, 9 e 14).

Todos os cinco critérios de aceitação do escopo do estágio (**AC01 a AC05**) foram rigorosamente verificados contra o código-fonte, a suíte de testes unitários/integrados e as ferramentas de build/lint. Todas as defesas contra abusos adversariais (path traversal, DoS por descompressão/spooling, bypass de autenticação, vazamento de metadados pessoais e integridade transacional de arquivos) foram comprovadas.

**Veredito Oficial:** **PASS**

---

## 2. Verificação de Evidências Automatizadas

| Evidência | Comando / Ambiente | Resultado | Detalhes |
|---|---|---|---|
| **Testes Backend (Django)** | `docker run ... piraiba-backend:estagio1-20261021 python manage.py test` (PostgreSQL 17) | **76 PASS** (12.78s) | 64 testes pré-existentes + 12 testes novos de `media_library` cobrindo formatos, dimensões, metadados, streaming HEAD, falhas de DB/disco e autorização. |
| **Migrations Dry-Run** | `python manage.py makemigrations --check --dry-run` | **PASS** (0 pending) | Nenhuma alteração não mapeada no esquema ou pendência de migração. |
| **Testes de Gateway** | `python3 deploy/sandbox/test_gateway.py` | **7 PASS** (4.99s) | Validação de cookies, rotação, rejeição de query no login, suporte a query em rotas públicas e bloqueio 401 de API sem cookie. |
| **TypeScript / Typegen** | `next typegen && tsc --noEmit` (Node 24 / Alpine) | **PASS** (0 erros) | Rotas tipadas com sucesso, integridade estática completa. |
| **Next.js Production Build** | `npm run build` (Turbopack / Standalone) | **PASS** (7.9s) | Todas as rotas (estáticas e dinâmicas) compiladas com sucesso sem erros de bundling. |
| **ESLint (Novo Componente)** | `eslint src/components/admin/media-picker.tsx` | **0 erros, 0 warnings** | Componente 100% aderente ao linter. |
| **ESLint (Admin Baseline)** | `eslint src/app/admin/admin-panel.tsx` | **6 erros, 10 avisos** | **Baseline conferido**: `origin/main` possuía exatamente os mesmos 6 erros de hook e 11 avisos. Houve redução líquida de 1 aviso e **zero** regressões introduzidas. |

---

## 3. Análise Adversarial de Casos de Borda (Security & Concurrency)

### 3.1. Segurança da Aplicação e Gateway
1. **Path Traversal em `asset_id` ou `variant`:**
   - **Mecanismo:** A rota `/api/media/<uuid:asset_id>/<str:variant>/` utiliza o conversor estrito de rota do Django (`uuid:asset_id`), que rejeita qualquer caractere fora da expressão regular padrão de UUID (barras, `..`, null bytes).
   - A view valida explicitamente: `if variant not in {"image", "thumbnail"}: raise Http404()`.
   - O caminho de armazenamento `asset_path(asset_id, variant)` constrói o caminho com `Path(settings.MEDIA_ROOT) / str(asset_id) / f"{variant}.webp"`.
   - O nome original do arquivo (`upload.name`) é tratado exclusivamente como metadado após sanitização com `Path(upload.name).name[:255]`, sem contato com a árvore de diretórios do host.
   - **Status:** **IMUNE A TRAVERSAL**.

2. **Acesso Não Autenticado:**
   - O endpoint administrativo `/api/operations/media/` exige `authentication_classes = [OperationsAuthentication]` e `permission_classes = [permissions.IsAuthenticated]`. Requisições anônimas ou com credenciais inválidas são rejeitadas com 401/403. Testado em `test_anonymous_cannot_list_or_upload`.
   - No gateway sandbox (`deploy/sandbox/gateway.py`), requisições para `/api/...` sem cookie válido de sandbox recebem status **401** imediatamente, impedindo vazamento de API para navegadores ou robôs anônimos.
   - O endpoint de entrega `/api/media/<uuid>/<variant>/` possui `AllowAny` e métodos limitados a `GET, HEAD, OPTIONS`, satisfazendo o contrato de fotos públicas de divulgação associadas às expedições/pousadas.

3. **Bypass de Content-Length e DoS de Upload:**
   - **Pré-parse:** `MediaLibraryView.post` inspeciona o cabeçalho `CONTENT_LENGTH`. Se o valor for omitido, malformado ou exceder `10 MiB + 256 KiB`, a requisição é abortada com HTTP 413 antes do processamento.
   - **Spooling:** `BoundedUploadHandler` é inserido na posição 0 dos upload handlers. Cada bloco transmitido em streaming é contabilizado (`self.received += len(raw_data)`). Caso ultrapasse 10 MiB (10.485.760 bytes), lança `UploadTooLarge` (413), impedindo que uploads forjados ou chunked transfers encham o tmpfs (`/tmp`).

4. **Descompressão Maliciosa (Decompression Bomb / Memory Exhaustion):**
   - O processamento de imagem em `services.py`:
     1. Eleva `Image.DecompressionBombWarning` a exceção fatal (`warnings.simplefilter("error", Image.DecompressionBombWarning)`).
     2. Inspeciona as dimensões do cabeçalho sem carregar o raster: `width * height > 24_000_000` ou `max(width, height) > 12_000` causa rejeição imediata com HTTP 400.
     3. Animações (GIFs animados, APNG, WebP animado) são verificadas e rejeitadas (`is_animated` ou `n_frames > 1`).
     4. `source.verify()` é executado contra o fluxo de bytes.
     5. O redimensionamento em memória usa `LANCZOS` gerando WebP 2400×2400 (principal) e 400×400 (miniatura), com consumo de memória estritamente limitado.

5. **Vazamento de Dados Pessoais (EXIF / GPS / Autor):**
   - A rotação respeita o EXIF via `ImageOps.exif_transpose(source)`.
   - Em seguida, uma nova imagem é criada do zero (`Image.new(mode, converted.size)`), e apenas os pixels são colados (`image.paste(converted)`). Tags EXIF, XMP, comentários e dados de geolocalização do autor **não trafegam** para o arquivo WebP público.
   - O autor administrativo (`created_by`) é gravado no banco de dados como `settings.ADMIN_EMAIL`, mas é estritamente omitido do serializer e payload retornado (`asset_payload`), evitando vazamento em listagens.

### 3.2. Concorrência, Armazenamento e Falhas Transacionais
1. **Colisão de UUID e Sobrescrita:**
   - A criação de diretório usa `directory.mkdir(parents=True, exist_ok=False)`. Caso já exista uma pasta com o UUID gerado, gera `FileExistsError`.
   - A gravação dos arquivos físicos usa o modo exclusivo `"xb"`.
   - A inserção no banco utiliza `asset.save(force_insert=True)`.
   - Sobrescrita de arquivo existente é impossível.

2. **Falha Parcial e Limpeza Transacional:**
   - Em caso de falha de I/O na escrita dos arquivos ou falha na transação do banco (`DatabaseError`), o bloco `except (OSError, DatabaseError)` percorre a lista de arquivos gravados (`written`), remove cada arquivo gerado (`unlink(missing_ok=True)`) e remove o diretório temporário (`rmdir()`), lançando `MediaUnavailable` (503).
   - Nenhum arquivo órfão é mantido no disco e nenhum registro incompleto permanece no banco. Validado pelos testes `test_database_failure_removes_files` e `test_write_failure_does_not_publish_partial_asset`.

3. **Isolamento de Ambientes:**
   - O caminho de armazenamento é configurável via `MEDIA_ROOT`.
   - Na infraestrutura de deploy (`deploy/hosted/compose.yaml`), o volume é montado exclusivamente a partir de `${MEDIA_HOST_DIR}` (`/srv/piraiba/sandbox/media` vs `/srv/piraiba/production/media`), garantindo separação física entre ambientes. Produção permanece isolada e em manutenção.

---

## 4. Matriz de Critérios de Aceite (AC01 a AC05)

- **AC01 — Query string com/sem cookie no Sandbox:** **CUMPRIDO**. `deploy/sandbox/gateway.py` normaliza `self.path.partition('?')[0]` para `/check`, mantendo a verificação estrita da rota `X-Forwarded-Uri`. Acesso sem cookie a páginas redireciona (302) para login; chamadas à API sem cookie retornam 401. Login com query string retorna 404. Testes de gateway aprovados com 7 PASS.
- **AC02 — Upload restrito a Administrador:** **CUMPRIDO**. Protegido por `OperationsAuthentication` e `IsAuthenticated`. Autor derivado de `ADMIN_EMAIL`. Anônimos recebem 403.
- **AC03 — Validação e Transformação de Bytes:** **CUMPRIDO**. Aceita apenas JPEG, PNG e WebP estáticos; limite de 10 MiB, 24 MP e 12.000 px por lado; remoção de EXIF e metadados; conversão para WebP (2400px e miniatura 400px).
- **AC04 — Consistência de Arquivos e Isolamento:** **CUMPRIDO**. Gravação atômica reversível em caso de falha no disco ou banco; endpoints GET/HEAD respondem 200 para ativos existentes e 404 para variações/arquivos inexistentes.
- **AC05 — Seletores Preservam Acervo e Integram Uploads:** **CUMPRIDO**. `MediaPicker` mantém as 22 imagens locais históricas intactas, pagina os uploads reais do servidor, integra-se aos cadastros de expedições, pousadas e equipamentos (preservando campo de URL textual). Uso de `unoptimized` no `next/image` implementado para `/api/media/`. TypeScript e Next.js build aprovados com zero erros.

---

## 5. Achados e Recomendações Operacionais (Findings)

1. **[Operacional / Rebuild de Imagem] Reconstrução do container de backend antes da implantação:**
   - *Observação:* O container `expedicaopiraiba-backend-1` em execução contínua no host foi criado antes da adição do `Pillow==13.0.0` ao `requirements.txt`. A validação foi executada com a nova imagem `piraiba-backend:estagio1-20261021`. Para implantação no sandbox, garantir que a imagem seja recriada via Compose (`docker compose build backend`).
2. **[Documental / Handoff] Rastreabilidade de Release do Gateway:**
   - *Observação:* Atualização do hash SHA256 do gateway no manifesto `/etc/piraiba/infra-release.json` concluída e registrada com sucesso (`infra-20261021T164601Z.tar.gz`).

---

## 6. Conclusão da Revisão

A implementação do **Estágio 1** atende com excelência técnica a todos os requisitos da especificação e da Constituição de Desenvolvimento. Não foram identificadas vulnerabilidades exploráveis, regressões ou brechas de conformidade.

**Veredito:** **PASS**
