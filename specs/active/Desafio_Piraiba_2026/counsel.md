# Counsel independente — Desafio Piraíba 2026

Data: 2026-10-02. Revisão independente, somente leitura, antes do READY humano.

- Usar carga dedicada e transacional pelos modelos existentes; não executar `seed_demo`, que contém expedição histórica nas mesmas datas e altera outros dados.
- Criar a expedição em DRAFT e publicar só após verificar todos os vínculos, mantendo idempotência e interrompendo em colisão com reservas.
- Usar pousada mínima com nome/cidade/UF, origem Goiânia explícita e sem instruções ou comodidades atribuídas sem evidência.
- Copiar inclusões do pacote regular e gravar snapshot na expedição. Edição do pacote mestre não atualiza a cópia da expedição automaticamente.
- Reutilizar o seletor visual e o acervo local existente para capa e galeria.
- Basear o CTA da hero somente na API pública real; remover fallback demonstrativo dos caminhos de detalhe e checkout ligados à reserva.

As decisões do usuário sobre preço, sinal, saldo, cervejas e equipamentos adiado tornam o contrato implementável. READY humano HIGH ainda exigido pela Constituição.
