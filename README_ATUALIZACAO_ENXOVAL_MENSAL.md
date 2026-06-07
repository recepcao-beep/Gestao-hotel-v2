# Atualização: inventário mensal do enxoval

## Ordem de instalação
1. No Supabase, abra `SQL Editor` e execute o arquivo `SUPABASE_ENXOVAL_MENSAL_MIGRATION.sql`.
2. Extraia o arquivo `Patch-controle-enxoval-inventario-mensal.zip`.
3. Copie os arquivos extraídos para a raiz do projeto atual e confirme a substituição dos arquivos existentes.
4. Faça commit e push para o GitHub.
5. Aguarde o novo deploy da Vercel.
6. Entre na aba `Enxoval`, clique em `Parâmetros` e preencha os dados de cada hotel.
7. Edite ou cadastre os itens de enxoval indicando a base de cálculo e a quantidade necessária por apartamento ou cama.
8. Ao final do mês, use `Fechar inventário mensal` para registrar a contagem física completa.

## Como a lógica funciona
- Estoque físico: peças existentes no hotel, inclusive manchadas, rasgadas e outras avarias.
- Estoque utilizável: limpas, em uso, sujas e na lavanderia.
- Extraviadas: peças que não estão fisicamente disponíveis.
- Mínimo: quantidade necessária para um giro operacional completo.
- Ideal: mínimo multiplicado pelos giros configurados, normalmente 3.
- Divergência mensal: diferença entre o saldo físico esperado e a contagem física informada. Quando houver diferença, a justificativa é obrigatória.

## Referência identificada na planilha enviada
Confira os números antes de cadastrá-los em produção.

### Village Inn
- Apartamentos: 208
- Camas de casal: 240
- Camas de solteiro: 350
- Camas totais pela soma: 590

### Golden Park
- Apartamentos: 116
- Camas de casal: 172
- Camas de solteiro: 116
- Camas totais pela soma: 288

### Thermas Resort
- Apartamentos: 148
- Camas de casal: 247
- Camas de solteiro: 94
- Camas totais pela soma: 341

## Exemplos de base de cálculo
- Toalha de banho: base `Apartamento`, quantidade por apartamento conforme o padrão do hotel.
- Lençol de solteiro: base `Cama solteiro`.
- Lençol de casal: base `Cama casal`.
- Fronha: escolha a base que represente corretamente o padrão do hotel ou use mínimo manual.
- Itens excepcionais: use `Manual` quando a quantidade mínima não depender diretamente da capacidade.
