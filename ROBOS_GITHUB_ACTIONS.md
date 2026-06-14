# Robos de vinculacao via GitHub Actions

## Secrets no GitHub

Em `Settings > Secrets and variables > Actions`, cadastre:

- `HITS_EMAIL`: usuario do HITS.
- `HITS_PASSWORD`: senha do HITS.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: conteudo completo do arquivo `automacao-mapinha-cb0bced39056.json`.
- `GOOGLE_OAUTH_CLIENT_SECRET_JSON`: conteudo completo do arquivo `client_secret.json`.
- `GOOGLE_OAUTH_TOKEN_JSON`: conteudo completo do arquivo `token.json`.

Esses arquivos nao devem ser commitados no repositorio.

## Variaveis no Vercel

Em `Project Settings > Environment Variables`, cadastre:

- `GITHUB_OWNER`: dono/organizacao do repositorio.
- `GITHUB_REPO`: nome do repositorio.
- `GITHUB_REF`: branch usada no deploy, normalmente `main`.
- `GITHUB_WORKFLOW_TOKEN`: token do GitHub com permissao para executar Actions.
- `GITHUB_VINCULACAO_WORKFLOW`: `vinculacao.yml`.
- `MAPINHA_SHEET_ID`: id da planilha `Controle de ocupantes (mapinha)`.
- `MAPINHA_PRINT_RANGE`: range de impressao, por padrao `Mapinha!A1:K145`.
- `MAPINHA_ESCALA_RANGE`: range da escala, por padrao `ESCALA!A1:H12`.
- `MAPINHA_PDF_RANGES`: blocos impressos, um por pagina. Padrao: `Mapinha!A1:K47,Mapinha!A49:K94,Mapinha!A96:K145`.
- `MAPINHA_PDF_SCALE`: escala do PDF, por padrao `2` para encaixar cada bloco na largura da folha.

O token pode ser um fine-grained token com acesso ao repositorio e permissao de `Actions: Read and write`.

Compartilhe a planilha `Controle de ocupantes (mapinha)` com o e-mail definido em `GOOGLE_SERVICE_ACCOUNT_EMAIL`, com permissao de editor. Sem isso, o app nao consegue ler/imprimir o Mapinha nem atualizar os nomes da escala.

O botao `Imprimir` abre um PDF exportado diretamente da aba `Mapinha`. O navegador ainda mostra a janela de impressao/visualizacao do PDF, porque navegadores nao permitem impressao silenciosa direta por seguranca.

## Celulas dos nomes das camareiras

Por padrao, o app atualiza:

- 200: `Mapinha!E41`
- 300: `Mapinha!J41`
- 400: `Mapinha!E88`
- 500: `Mapinha!J88`
- 600: `Mapinha!E135`
- 700: `Mapinha!J135`

Se alguma celula estiver diferente, cadastre no Vercel:

```txt
MAPINHA_NAME_CELLS_JSON={"200":"Mapinha!E41","300":"Mapinha!J41","400":"Mapinha!E88","500":"Mapinha!J88","600":"Mapinha!E135","700":"Mapinha!J135"}
```

## Rotinas disponiveis

- `verificacao_diaria`: executa `mr.py`, `obs.py`, `vinc2.py`.
- `vinculacao_semanal`: executa `limpeza.py`, `mr.py`, `obs.py`, `vinc2.py`.
- `mapa`: executa `mapa.py`.

## Teste manual

No GitHub, abra `Actions > Vinculacao HITS > Run workflow` e escolha a rotina.

Depois de validar manualmente, use a aba `Robos` no app para disparar pelo Vercel.
