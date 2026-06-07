# Evolução do módulo Controle de Enxoval

## Etapa obrigatória no Supabase
Antes de publicar, execute no SQL Editor o arquivo `SUPABASE_ENXOVAL_MENSAL_MIGRATION.sql`.
Ele cria a tabela `linenmonthlyinventories`, utilizada para manter o histórico das contagens mensais.

## O que foi incluído
- Parâmetros independentes por hotel: apartamentos, camas totais, camas de solteiro, camas de casal e quantidade ideal de giros.
- Cadastro de cada peça com base de cálculo flexível: apartamento, cama total, cama de solteiro, cama de casal ou mínimo manual.
- Separação das peças manchadas e rasgadas, além de outras avarias e extravios.
- Cálculo automático de estoque mínimo, estoque ideal, estoque físico e estoque utilizável.
- Justificativa obrigatória ao transferir itens para manchados, rasgados ou extraviados e ao registrar baixas.
- Fechamento mensal da contagem física, com justificativa obrigatória para qualquer divergência entre saldo esperado e saldo contado.
- Histórico mensal com gráfico de progressão do inventário físico, utilizável, manchado e rasgado.

## Configuração inicial sugerida com base na planilha enviada
### Village Inn
- Apartamentos: 208
- Camas de casal: 240
- Camas de solteiro: 350

### Golden Park
- Apartamentos: 116
- Camas de casal: 172
- Camas de solteiro: 116

### Thermas Resort
- Apartamentos: 148
- Camas de casal: 247
- Camas de solteiro: 94

Confira os quantitativos antes de cadastrá-los em produção.
