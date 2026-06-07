# Módulo Controle de Enxoval

## O que foi adicionado

A nova aba **Enxoval** aparece no menu lateral e na navegação inferior. Ela permite:

- cadastrar e editar peças de enxoval;
- definir o estoque mínimo de peças limpas;
- visualizar saldos de peças limpas, em uso, sujas, na lavanderia, danificadas e extraviadas;
- registrar entradas, transferências e baixas;
- informar local ou referência da movimentação, como apartamento, rouparia ou lavanderia;
- consultar o histórico recente por usuário e data;
- controlar a visibilidade da aba em **Configurações > Menu**;
- conceder ou retirar o acesso à aba por usuário, como nas demais permissões do sistema.

## Passo obrigatório antes do deploy

No painel do Supabase, abra o **SQL Editor** e execute o conteúdo do arquivo:

`SUPABASE_ENXOVAL_MIGRATION.sql`

Esse script cria as tabelas `linenitems` e `linenhistory`. Sem essa etapa, o módulo abrirá normalmente no navegador, mas os novos registros não serão persistidos no banco de dados.

## Google Sheets como fallback

Quando o Supabase não estiver configurado, a API cria ou utiliza automaticamente as abas:

- `Enxoval_<HOTEL>`
- `Historico_Enxoval_<HOTEL>`

Exemplos: `Enxoval_VILLAGE` e `Historico_Enxoval_VILLAGE`.

## Validação executada

A versão foi validada com:

```bash
npm run lint
npm run build
```
