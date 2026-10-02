# Especificação — Fase C: Locação/Venda de Tralhas e CRM de Pescadores

```yaml
identificador_normativo: FASEC-TRALHAS-CRM-PESCADORES
classificacao_risco: HIGH
modulo: operacoes_comercial_crm
status_documento: ACCEPTED
data_criacao: 2026-10-01
data_aceite: 2026-10-01
autor: Equipe de Arquitetura Expedição Piraíba
aprovado_por: Rodrigo
base_normativa:
  - docs/sdd/CONSTITUTION.md (§1, §2, §3, §4, §5, §6, §8, §9)
  - docs/sdd/PLAYBOOK.md
  - specs/backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md (Pilares 4 e 5)
  - specs/archive/FaseA_Dominio-Geografico-Pousadas/spec.md
  - specs/archive/FaseB_Pacotes-Construtor-Expedicoes/spec.md
```

---

## 1. Visão Geral e Contexto de Negócio

Nas pescarias esportivas de grandes bagres amazônicos (especialmente Piraíbas que ultrapassam 2 metros e Pirararas acima de 40 kg), os pescadores enfrentam dois grandes atritos operacionais e comerciais:

1. **Restrições Logísticas e Custo de Equipamentos Pesados:** A maioria dos participantes viaja de avião até os aeroportos regionais e enfrenta severas franquias de bagagem para varas inteiriças de 100-120 lb (tubos de transporte caros e volumosos). Além disso, carretilhas pesadas de perfil alto com linha multifilamento de 8 fios e chicotes de aço representam um investimento inicial elevado para clientes eventuais. A locação de tralhas pesadas na base e a venda de kits terminais oficiais soluciona essa dor, evita quebra de equipamentos inadequados no rio e gera receita acessória imediata.
2. **Ausência de CRM e Histórico Consolidado de Clientes:** Atualmente, a entidade `Customer` é uma tabela plana com dados de contato imediatos. O organizador Rodrigo não possui uma visão centralizada dos clientes recorrentes (LTV, quantas expedições já participou, rios já visitados, licença de pesca RGP ativa/vencida, restrições alimentares habituais e anotações operacionais internas sobre o pescador).

A **Fase C** implementa a infraestrutura completa de:
* Catálogo e inventário de equipamentos de pesca (`FishingGearProduct`) para locação ou venda;
* Vinculação transacional e auditada de tralhas às reservas (`ReservationGearAddon`);
* Perfil estendido e central de relacionamento com o pescador (`CustomerProfile` e `CustomersPanel`);
* Exibição dos equipamentos locados no Manifesto Oficial de Embarque (`ManifestPanel`) para a pousada e o piloteiro prepararem os barcos antes da partida.

---

## 2. Escopo e Objetivos da Fase C

1. **Catálogo de Equipamentos de Pesca (`FishingGearProduct`):**
   - Suporte a modalidades: `RENTAL` (Locação por expedição), `SALE` (Venda direta) e `BOTH` (Ambas);
   - Categorias técnicas: Conjunto Pesado (Piraíba / Bagres), Conjunto Médio (Pirarara / Tucunaré), Acessórios & Terminais, Vestuário UV / Proteção, e Iscas Especiais;
   - Especificações técnicas estruturadas em JSON (`libragem`, `linha`, `carretilha_molinete`, `anzol_terminal`);
   - Controle de estoque físico disponível na base (`inventory_quantity`).

2. **Adição de Tralhas na Reserva (`ReservationGearAddon`):**
   - Vinculação a uma reserva e opcionalmente a um participante específico (`ReservationParticipant`);
   - Recálculo transacional de valor total e saldo remanescente da reserva (`total_price_cents`, `remaining_balance_cents`);
   - Registro auditável do evento em `ReservationEvent`.

3. **Perfil Estruturado e CRM do Pescador (`CustomerProfile`):**
   - Vínculo 1:1 com `Customer`;
   - Registro Geral de Pesca (`fishing_license_number` / RGP) e validade (`fishing_license_expiry`);
   - Dados civis (RG, órgão emissor, data de nascimento, cidade, estado);
   - Tamanho preferencial de colete / camisa UV, histórico de restrições alimentares e notas médicas;
   - Anotações operacionais exclusivas do organizador (`internal_admin_notes`);
   - Sincronização automática quando o participante preenche a ficha de embarque web.

4. **Painel do Administrador (Frontend `admin-panel.tsx`):**
   - Nova aba *"Tralhas & Loja"* (`GearPanel`): listagem de equipamentos, filtros por categoria/modalidade, controle de estoque e modal de cadastro/edição (`GearModal`);
   - Nova aba *"CRM de Clientes"* (`CustomersPanel`): busca por Nome, CPF, WhatsApp, Cidade, status do RGP, métricas de LTV (valor total pago acumulado), total de viagens e gaveta/modal com histórico detalhado e anotações internas (`CustomerModal`);
   - Atualização do **Manifesto de Embarque (`ManifestPanel`)**: listagem dos equipamentos locados por participante para controle de entrega na pousada.

---

## 3. Não-Objetivos (Fora de Escopo)

1. Não implementar gateway de pagamento com cartão de crédito nem maquininha de cartão física (mantém-se o fluxo de pagamento PIX e registro manual já homologados);
2. Não alterar o mecanismo transacional de hold de 15 minutos de vagas nem a concorrência pessimista de checkout;
3. Não criar e-commerce aberto para o público geral (as tralhas são exclusivas para participantes e reservas de expedições da Piraíba);
4. Não alterar as regras de cancelamento e reembolso de reservas pactuadas na Constituição.

---

## 4. Modelagem de Dados Detalhada (Backend Django)

### 4.1. Equipamentos de Pesca e Addons em Reservas

```python
# apps/expeditions/models.py

class GearCategory(models.TextChoices):
    HEAVY_ROD_REEL = "HEAVY_ROD_REEL", "Conjunto Pesado (Piraíba / Grandes Bagres)"
    MEDIUM_ROD_REEL = "MEDIUM_ROD_REEL", "Conjunto Médio (Pirarara / Tucunaré)"
    TERMINAL_TACKLE = "TERMINAL_TACKLE", "Acessórios e Terminais (Anzóis, Encastoados, Chumbadas)"
    APPAREL = "APPAREL", "Vestuário UV, Bonés e Proteção"
    SPECIALTY_BAIT = "SPECIALTY_BAIT", "Iscas Especiais e Atrativos"


class FishingGearProduct(models.Model):
    class Modality(models.TextChoices):
        RENTAL = "RENTAL", "Locação por Expedição"
        SALE = "SALE", "Venda Direta"
        BOTH = "BOTH", "Venda ou Locação"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160, unique=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    category = models.CharField(max_length=30, choices=GearCategory.choices)
    modality = models.CharField(max_length=10, choices=Modality.choices, default=Modality.RENTAL)
    technical_specs = models.JSONField(default=dict, blank=True)
    rental_price_cents = models.PositiveIntegerField(default=0)  # Valor da diária/viagem
    sale_price_cents = models.PositiveIntegerField(default=0)    # Preço de aquisição
    inventory_quantity = models.PositiveSmallIntegerField(default=0)
    image_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category", "name")

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_modality_display()})"
```

```python
# apps/reservations/models.py

class ReservationGearAddon(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="gear_addons")
    participant = models.ForeignKey(ReservationParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name="gear_addons")
    gear_product = models.ForeignKey("expeditions.FishingGearProduct", on_delete=models.PROTECT, related_name="addons")
    modality = models.CharField(max_length=10, choices=FishingGearProduct.Modality.choices)
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price_cents = models.PositiveIntegerField()
    total_price_cents = models.PositiveIntegerField()
    notes = models.CharField(max_length=200, blank=True)
    delivered = models.BooleanField(default=False)  # Confirmado na pousada
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.gear_product.name} ({self.quantity}x) - Reserva {self.reservation.id}"
```

### 4.2. Perfil e CRM do Pescador

```python
# apps/customers/models.py

class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="profile")
    rg = models.CharField(max_length=20, blank=True)
    rg_issuer = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    fishing_license_number = models.CharField(max_length=50, blank=True)  # Registro Geral de Pesca (RGP)
    fishing_license_expiry = models.DateField(null=True, blank=True)
    default_vest_size = models.CharField(max_length=10, blank=True)
    dietary_notes = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=160, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    internal_admin_notes = models.TextField(blank=True)  # Anotações exclusivas do organizador
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Perfil de {self.customer.full_name}"

    @property
    def has_valid_license(self):
        if not self.fishing_license_number:
            return False
        if not self.fishing_license_expiry:
            return True
        return self.fishing_license_expiry >= timezone.now().date()
```

---

## 5. Seed Inicial de Equipamentos Canônicos de Pesca

1. **Conjunto Pesado Piraíba Bruta 100-120 lb (Locação):**
   - Varas 100-120 lb inteiriças de carbono com passadores reforçados;
   - Carretilhas perfil alto (Penn Squall 50 / Shimano Torium 30) abastecidas com 300m de linha multifilamento 0,85mm de 8 fios;
   - Preço de Locação: R$ 350,00 por expedição; Estoque: 12 unidades.
2. **Conjunto Médio Pesado Pirarara & Bagres 60-80 lb (Locação):**
   - Vara 60-80 lb com carretilha perfil médio (Shimano Tranx 400 / Daiwa Lexa 400);
   - Linha multifilamento 0,50mm com chicote fluorocarbono 80 lb;
   - Preço de Locação: R$ 250,00 por expedição; Estoque: 14 unidades.
3. **Kit Terminal de Aço para Piraíba & Anzóis Circulares (Venda):**
   - 6 anzóis circulares forjados 10/0 e 12/0 com encastoado flexível de 150 lb e giradores marítimos;
   - Preço de Venda: R$ 120,00; Estoque: 40 kits.
4. **Camisa UV 50+ Oficial Expedição Piraíba (Venda):**
   - Tecido tecnológico com proteção solar máxima, secagem rápida e estampa oficial;
   - Preço de Venda: R$ 180,00; Estoque: 30 unidades.

---

## 6. Endpoints da API Operacional

### Catálogo de Tralhas:
* `GET /api/operations/gear-products/` — Lista produtos de pesca com filtro por `category`, `modality` e `active`;
* `POST /api/operations/gear-products/` — Cria novo produto;
* `GET, PATCH, DELETE /api/operations/gear-products/<id>/` — Detalhes, atualização e exclusão (409 Conflict se houver addons vinculados em reservas ativas).

### Addons de Tralhas em Reservas:
* `GET /api/operations/reservations/<id>/gear-addons/` — Lista tralhas vinculadas à reserva;
* `POST /api/operations/reservations/<id>/gear-addons/` — Adiciona tralha, valida estoque, recalcula `total_price_cents` da reserva e emite `ReservationEvent`;
* `DELETE /api/operations/reservations/<id>/gear-addons/<addon_id>/` — Remove tralha, restaura estoque e recalcula saldo da reserva.

### CRM de Pescadores:
* `GET /api/operations/customers/` — Lista clientes com paginação e busca por nome, CPF, telefone e cidade. Retorna métricas agregadas: LTV (`lifetime_value_cents`), total de viagens e status da licença de pesca (RGP);
* `GET /api/operations/customers/<id>/` — Detalhes completos do cliente, perfil, lista de reservas históricas com passageiros e status financeiro;
* `PATCH /api/operations/customers/<id>/` — Atualização do perfil civil, RGP e anotações operacionais internas (`internal_admin_notes`).

---

## 7. Matriz de Rastreabilidade e Critérios de Aceite

| ID Requisito | Descrição | Implementação Alvo | Critério de Aceite / Teste |
|---|---|---|---|
| **REQ-C01** | Modelagem `FishingGearProduct` | `backend/apps/expeditions/models.py` | Migração aplicada, suporte a categorias, modalidades e especificações técnicas. |
| **REQ-C02** | Seed de Equipamentos Oficiais | Migração de dados Django | Conjuntos pesados, médios, kits terminais e vestuário criados com preços e estoques. |
| **REQ-C03** | Modelagem `ReservationGearAddon` | `backend/apps/reservations/models.py` | Relação com reserva e participante opcional; recálculo atômico do saldo. |
| **REQ-C04** | Modelagem `CustomerProfile` | `backend/apps/customers/models.py` | Relacionamento OneToOne com `Customer`, campos de RGP, colete e notas operacionais. |
| **REQ-C05** | Endpoints de Tralhas e Estoque | `backend/apps/operations/views.py` | CRUD completo, validação de estoque suficiente no aluguel/venda e 409 em exclusão indevida. |
| **REQ-C06** | Endpoints de CRM de Clientes | `backend/apps/operations/views.py` | Listagem com cálculo exato de LTV, busca avançada e histórico de expedições. |
| **REQ-C07** | Seção "Tralhas & Loja" no Admin | `frontend/src/app/admin/admin-panel.tsx` | Painel `GearPanel` com controle de estoque, filtros e modais de criação/edição. |
| **REQ-C08** | Seção "CRM de Pescadores" no Admin | `frontend/src/app/admin/admin-panel.tsx` | Painel `CustomersPanel` com visualização de LTV, status do RGP e gaveta de detalhes. |
| **REQ-C09** | Integração no Manifesto de Embarque | `frontend/src/app/admin/admin-panel.tsx` | Visualização e exportação das tralhas locadas por passageiro para a pousada/piloteiro. |
| **REQ-C10** | Dossiês Grill e Ponytail | `specs/active/FaseC_Tralhas-CRM-Pescadores/` | Grill independente com READY humano antes de codificar, e Ponytail PASS antes de ACCEPTED. |

---

## 8. Definition of Done (DoD)

1. Modelos `FishingGearProduct`, `ReservationGearAddon` e `CustomerProfile` criados com migrações aplicadas;
2. Suíte de testes automatizados incluindo concorrência e integridade financeira sem quebra dos 44 testes existentes;
3. `make check-docs` e `git diff --check` sem erros;
4. Interfaces de Tralhas e CRM funcionando integradas no `/admin`;
5. Grill adversarial executado com aprovação formal de READY por Rodrigo;
6. Implementação finalizada e auditada por Ponytail com parecer PASS.
