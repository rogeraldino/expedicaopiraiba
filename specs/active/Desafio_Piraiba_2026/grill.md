# Grill independente — Desafio Piraíba 2026

Data: 2026-10-02. Revisão independente, somente leitura, antes do READY humano.

| Finding | Risco identificado | Disposição na spec v1.0 |
|---|---|---|
| G1 | 18 unidades por cerveja poderiam ser confundidas com 54 cervejas incluídas por pessoa. | Rodrigo escolheu opções individuais com 18 unidades como padrão operacional de compra; a spec proíbe promessa de álcool incluso/open bar. |
| G2 | Detalhe e checkout usam dados demonstrativos em 404/falha, com sinal divergente. | A spec exige ausência de reserva fictícia nas três superfícies. |
| G3 | `Expedition.save()` pode copiar horário e instruções da pousada para o encontro. | A spec exige pousada sem instruções não confirmadas e verificação antes da carga. |
| G4 | Há 16 espécies globalmente ativas, incluindo uma adicional ao seed original. | Rodrigo autorizou todas as espécies existentes; a spec fixa todas globalmente ativas e Piraíba como única principal. |
| G5 | Pode existir expedição da mesma data no ambiente alvo. | A spec exige inspeção, atualização única sem reservas ou interrupção segura. |
| G6 | Wizard não envia galeria nem instruções de encontro. | A spec exige criação e edição posteriores sem perda dos campos. |
| G7 | “Próxima” e destino do CTA estavam indefinidos. | A spec fixa data local, vagas, desempate e checkout como destino. |

Resultado após incorporação: sem SPEC GAP conhecido; READY humano permanece obrigatório.
