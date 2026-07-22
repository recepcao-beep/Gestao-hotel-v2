import argparse
import os
import subprocess
import sys
from pathlib import Path


ROTINAS = {
    "verificacao_diaria": ["mr.py", "obs.py", "vinc3.py --headless"],
    "verificacao_diaria_conciliada": ["mr.py", "obs.py", "conciliar.py", "vinc3.py --headless", "mr.py"],
    "conciliacao_dry_run": ["conciliar.py --dry-run"],
    "vinc3_dry_run": ["vinc3.py --headless --dry-run"],
    "vinculacao_semanal": ["limpeza.py", "mr.py", "obs.py", "vinc3.py --headless"],
    "mapa": ["mapa.py"],
    "checkin_whatsapp": ["checkin_whatsapp.py"],
}


def exigir_arquivos(base_dir: Path) -> None:
    obrigatorios = [
        "client_secret.json",
        "token.json",
        "automacao-mapinha-cb0bced39056.json",
    ]
    faltando = [nome for nome in obrigatorios if not (base_dir / nome).exists()]
    if faltando:
        raise SystemExit(f"Arquivos de credencial ausentes: {', '.join(faltando)}")


def exigir_variaveis() -> None:
    faltando = [nome for nome in ("HITS_EMAIL", "HITS_PASSWORD") if not os.environ.get(nome)]
    if faltando:
        raise SystemExit(f"Secrets/variaveis ausentes: {', '.join(faltando)}")


def executar(script: str, base_dir: Path) -> None:
    print(f"\n=== Executando {script} ===", flush=True)
    partes = script.split()
    subprocess.run([sys.executable, *partes], cwd=base_dir, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa os robos de vinculacao HITS.")
    parser.add_argument(
        "rotina",
        choices=sorted(ROTINAS),
        help="Rotina que sera executada.",
    )
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    exigir_variaveis()
    exigir_arquivos(base_dir)

    for script in ROTINAS[args.rotina]:
        executar(script, base_dir)

    print("\nRotina finalizada com sucesso.", flush=True)


if __name__ == "__main__":
    main()
