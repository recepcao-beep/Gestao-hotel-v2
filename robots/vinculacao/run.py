import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


ROTINAS = {
    "vinculacao_diaria": [
        ["limpeza.py", "--pausa-rolagem", "1.0", "--pausa-acao", "1.0"],
        ["mr.py", "--fator-pausa", "0.5"],
        ["obs.py", "--fator-pausa", "0.7"],
        ["vinc3.py", "--fator-pausa", "0.8"],
    ],
    "mr": [
        ["mr.py", "--fator-pausa", "0.5"],
    ],
    "vinc3": [
        ["vinc3.py", "--fator-pausa", "0.8"],
    ],
    "limpeza": [
        ["limpeza.py", "--pausa-rolagem", "1.0", "--pausa-acao", "1.0"],
    ],
}


def inteiro_positivo(nome: str, padrao: int) -> int:
    try:
        return max(1, int(os.getenv(nome, str(padrao))))
    except ValueError as exc:
        raise SystemExit(f"{nome} deve ser um numero inteiro positivo.") from exc


def validar_ambiente(base_dir: Path) -> None:
    if os.getenv("GITHUB_ACTIONS", "").lower() != "true":
        return

    faltando = [
        nome
        for nome in ("HITS_EMAIL", "HITS_PASSWORD")
        if not os.getenv(nome, "").strip()
    ]
    if not os.getenv("GOOGLE_TOKEN_JSON", "").strip() and not (
        base_dir / "token.json"
    ).exists():
        faltando.append("GOOGLE_TOKEN_JSON")
    if not os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip() and not (
        base_dir / "automacao-mapinha-cb0bced39056.json"
    ).exists():
        faltando.append("GOOGLE_SERVICE_ACCOUNT_JSON")

    if faltando:
        raise SystemExit(f"Secrets obrigatorios ausentes: {', '.join(faltando)}")


def executar(
    comando: list[str],
    base_dir: Path,
    modo: str,
    tentativas: int,
    pausa_retry: int,
) -> None:
    comando_completo = [sys.executable, *comando, modo]
    nome = comando[0]

    for tentativa in range(1, tentativas + 1):
        print(
            f"\n=== {nome} | tentativa {tentativa}/{tentativas} ===",
            flush=True,
        )
        resultado = subprocess.run(comando_completo, cwd=base_dir, check=False)
        if resultado.returncode == 0:
            print(f"=== {nome} concluido ===", flush=True)
            return

        print(f"{nome} falhou com codigo {resultado.returncode}.", flush=True)
        if tentativa < tentativas:
            print(f"Nova tentativa em {pausa_retry}s...", flush=True)
            time.sleep(pausa_retry)

    raise subprocess.CalledProcessError(resultado.returncode, comando_completo)


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa o fluxo de vinculacao HITS.")
    parser.add_argument("rotina", choices=sorted(ROTINAS))
    grupo_modo = parser.add_mutually_exclusive_group()
    grupo_modo.add_argument("--headless", action="store_true")
    grupo_modo.add_argument("--visual", action="store_true")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    validar_ambiente(base_dir)

    headless = args.headless or (
        not args.visual and os.getenv("ROBOT_HEADLESS", "1") != "0"
    )
    modo = "--headless" if headless else "--visual"
    tentativas = inteiro_positivo("ROBOT_RETRIES", 3)
    pausa_retry = inteiro_positivo("ROBOT_RETRY_SLEEP", 20)

    print(
        f"Rotina: {args.rotina} | Modo: {modo[2:]} | "
        f"Tentativas por robo: {tentativas}",
        flush=True,
    )
    for comando in ROTINAS[args.rotina]:
        executar(comando, base_dir, modo, tentativas, pausa_retry)

    print("\nRotina finalizada com sucesso.", flush=True)


if __name__ == "__main__":
    main()
