# Atualização — Controle de Enxoval Simplificado e Reciclagem

## Objetivo

Esta atualização simplifica o módulo de enxoval para o fluxo real da governança. O sistema deixa de exigir controle de peças limpas, sujas ou em lavanderia e passa a trabalhar com:

- **Em uso**
- **Manchado**
- **Rasgado**
- **Extraviado** — histórico acumulado de perdas

O estoque físico total de cada item é calculado automaticamente como:

```text
Total físico = Em uso + Manchado + Rasgado
```

Campos antigos continuam existindo internamente apenas para migração segura dos registros anteriores. Na primeira leitura, eventuais saldos antigos de limpo, sujo e lavanderia são incorporados ao saldo **Em uso**.

## Operações disponíveis

### Entrada
Adiciona novas peças diretamente ao saldo **Em uso**.

### Registrar avaria
Retira peças do saldo **Em uso** e transfere para **Manchado** ou **Rasgado**.

Exemplo:

```text
Toalha de banho: Em uso 500 → 470
Toalha de banho: Rasgado 0 → 30
```

### Recuperação
Retira peças de **Manchado** ou **Rasgado** e devolve ao saldo **Em uso** do mesmo item.

### Reciclagem
Retira peças de **Manchado** ou **Rasgado** de um item e gera automaticamente saldo **Em uso** em outro material.

Exemplo:

```text
Origem: Lençol de casal rasgado — retirar 1 unidade
Destino: Fronha — adicionar 2 unidades em uso
```

A quantidade de origem e a quantidade gerada são campos separados. Isso permite registrar conversões como 1 lençol transformado em 2 fronhas.

### Extravio
Retira a peça do inventário físico e registra a perda acumulada como extravio. A justificativa é obrigatória.

### Baixa definitiva
Retira peças definitivamente do inventário físico. Pode ser aplicada a peças em uso, manchadas ou rasgadas. A justificativa é obrigatória.

## Inventário mensal

O fechamento mensal foi mantido. Para cada item, informe:

- Em uso
- Manchado
- Rasgado

O sistema calcula automaticamente:

- total físico contado;
- divergência em relação ao saldo esperado;
- progressão mensal do estoque total, saldo em uso, peças manchadas e peças rasgadas.

Quando houver divergência, a justificativa será obrigatória.

## Instalação

### 1. Não executar novo SQL

Esta atualização **não exige nenhuma nova migração no Supabase**. As tabelas existentes já armazenam os dados em formato JSON e suportam os novos campos.

### 2. Substituir os arquivos

Extraia `Patch-controle-enxoval-simplificado-reciclagem.zip` e copie todo o conteúdo para a pasta principal do projeto. Confirme a substituição dos arquivos existentes.

Arquivos alterados:

```text
App.tsx
api/server.ts
components/LinenView.tsx
types.ts
```

### 3. Publicar

No GitHub Desktop:

```text
Commit: Simplificar controle de enxoval e adicionar reciclagem
Push origin
```

A Vercel deverá iniciar um novo deploy automaticamente.

## Teste recomendado após o deploy

1. Cadastre dois itens de teste: `Lençol de casal` e `Fronha`.
2. Informe `10` unidades em uso para o lençol.
3. Registre uma avaria: `2` lençóis rasgados.
4. Confirme que o lençol ficou com `8` em uso e `2` rasgados.
5. Clique na quantidade rasgada do lençol.
6. Escolha `Reciclar em outro item`.
7. Retire `1` lençol rasgado e gere `2` fronhas.
8. Confirme que o lençol ficou com `1` rasgado e que a fronha recebeu `+2` unidades em uso.
9. Atualize a página com `F5` para confirmar a persistência.

## Validação técnica realizada

```text
npm run lint
npm run build
GET /api/health → status ok
```
