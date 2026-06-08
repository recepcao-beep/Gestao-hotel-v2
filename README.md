# Gestão Hotel V2 — versão corrigida

Projeto completo para publicação na Vercel.

## Antes de usar o Controle de Enxoval

Execute no SQL Editor do Supabase o arquivo:

`1_EXECUTAR_NO_SUPABASE.sql`

O script cria ou repara as tabelas necessárias sem apagar registros existentes.

## Publicação

1. Instale as dependências localmente, caso precise testar: `npm install`.
2. Valide o projeto: `npm run lint` e `npm run build`.
3. Envie todos os arquivos desta pasta ao repositório GitHub conectado à Vercel.
4. Aguarde o deployment da Vercel ficar com status `Ready`.
5. Atualize o aplicativo com `Ctrl + F5`.

## Correções incluídas

- Mapeamento separado entre abas do Google Sheets e tabelas do Supabase.
- Gravação do enxoval exclusivamente nas tabelas corretas: `linenitems`, `linenhistory` e `linenmonthlyinventories`.
- Gravação das configurações em `config`.
- Resposta de erro real quando uma tabela estiver ausente; o aplicativo não simula mais um salvamento bem-sucedido.
- Controle de enxoval simplificado: em uso, manchado, rasgado, recuperado, reciclado, extraviado e baixa definitiva.
- Inventário mensal com progressão histórica.
