"""Delete all locally stored preview login accounts."""
from pathlib import Path
import sqlite3

DB_PATH = Path(__file__).parent / "preview.sqlite3"


def main():
    if not DB_PATH.exists():
        print("No hay datos locales de cuentas para borrar.")
        return
    removed = 0
    with sqlite3.connect(DB_PATH, timeout=10) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in ("accounts", "users"):
            if table in tables:
                cursor = conn.execute(f'DELETE FROM "{table}"')
                removed += cursor.rowcount
    print(f"Se borraron {removed} registros de acceso locales.")


if __name__ == "__main__":
    main()
