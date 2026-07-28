# Robos de vinculacao HITS

Esta pasta contem o fluxo operacional disparado pelo GitHub Actions.

## Fluxos

- `vinculacao_diaria`: `limpeza.py` -> `mr.py` -> `obs.py` -> `vinc2.py`.

O `run.py` executa os robos em sequencia e repete somente o robo que falhar. Por
padrao sao feitas 3 tentativas, com intervalo de 20 segundos. Os valores podem
ser alterados por `ROBOT_RETRIES` e `ROBOT_RETRY_SLEEP`.

## Execucao

No GitHub Actions, o fluxo sempre usa Chrome headless:

```bash
python robots/vinculacao/run.py vinculacao_diaria --headless
```

Para acompanhar o navegador localmente, execute na pasta do repositorio:

```bash
python robots/vinculacao/run.py vinculacao_diaria --visual
```

## Arquivos operacionais

- `limpeza.py`: desvincula reservas no mapa antes da rotina semanal.
- `mr.py`: atualiza a projecao de reservas dos proximos 7 dias.
- `obs.py`: atualiza as solicitacoes das reservas.
- `vinc3.py`: vincula os apartamentos, incluindo reservas de grupo.
- `run.py`: coordena a ordem, o modo visual/headless e as novas tentativas.
- `requirements.txt`: dependencias Python do fluxo.

O VINC3 confirma o overbooking por padrao depois de validar o apartamento e a
categoria. Para desativar o clique emergencialmente, defina
`PERMITIR_CLIQUE_OVERBOOKING=0`.

## Credenciais

Credenciais nunca devem ser commitadas. No GitHub, configure os secrets
`HITS_EMAIL`, `HITS_PASSWORD`, `GOOGLE_TOKEN_JSON` e
`GOOGLE_SERVICE_ACCOUNT_JSON`. Para execucao local, os robos tambem aceitam os
arquivos ignorados pelo Git `token.json`, `client_secret.json` e
`automacao-mapinha-cb0bced39056.json` na mesma pasta dos scripts.

## Ferramentas auxiliares

Os arquivos `checkin_whatsapp.py`, `conciliar.py`, `mapa.py`,
`testar_escrita_obs.py` e `hits_popup_guard.py` permanecem no repositorio para
uso isolado. Eles nao fazem parte das rotinas disparadas pelo app.
