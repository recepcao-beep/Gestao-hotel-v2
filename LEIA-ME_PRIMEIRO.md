# Gestão Hotel V2 — instalação da versão corrigida

Esta versão contém o módulo de enxoval simplificado com:

- total físico;
- peças em uso;
- peças manchadas;
- peças rasgadas;
- recuperação de peças;
- reciclagem de uma peça em outro item;
- extravio e baixa definitiva;
- inventário mensal e gráfico de progressão;
- parâmetros por hotel para apartamentos e camas.

## Arquivo obrigatório do Supabase

Antes de utilizar o módulo, execute no SQL Editor do Supabase:

`1_EXECUTAR_NO_SUPABASE.sql`

O arquivo cria somente as tabelas ausentes e não apaga os dados existentes.

## Publicação

1. Substitua o conteúdo do repositório GitHub pelo conteúdo desta pasta.
2. Faça commit e push para a branch principal.
3. Aguarde o novo deploy da Vercel ficar com status `Ready`.
4. Execute o SQL no mesmo projeto Supabase indicado pela variável `SUPABASE_URL` da Vercel.
5. Atualize o aplicativo com `Ctrl + F5` e teste o cadastro de um item.

## Tabelas esperadas

- `config`
- `linenitems`
- `linenhistory`
- `linenmonthlyinventories`
