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

O token pode ser um fine-grained token com acesso ao repositorio e permissao de `Actions: Read and write`.

## Rotinas disponiveis

- `verificacao_diaria`: executa `mr.py`, `obs.py`, `vinc2.py`.
- `vinculacao_semanal`: executa `limpeza.py`, `mr.py`, `obs.py`, `vinc2.py`.
- `mapa`: executa `mapa.py`.

## Teste manual

No GitHub, abra `Actions > Vinculacao HITS > Run workflow` e escolha a rotina.

Depois de validar manualmente, use a aba `Robos` no app para disparar pelo Vercel.
