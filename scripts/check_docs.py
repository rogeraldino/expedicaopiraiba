from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "docs/sdd/NORMATIVE_INDEX.json"
LINK = re.compile(r"\[[^\]]+\]\((?!https?://|#)([^)#]+)(?:#[^)]+)?\)")


def main() -> int:
    errors: list[str] = []
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    owners: dict[str, str] = {}
    for entry in data.get("entries", []):
        owner = entry["owner"]
        if owner in owners:
            errors.append(f"owner duplicado: {owner} ({owners[owner]} e {entry['id']})")
        owners[owner] = entry["id"]
        if not (ROOT / owner.split(":", 1)[0]).exists():
            errors.append(f"owner ausente: {entry['id']} -> {owner}")

    for path in [ROOT / "AGENTS.md", *(ROOT / "docs").rglob("*.md"), *(ROOT / "specs").rglob("*.md")]:
        text = path.read_text(encoding="utf-8")
        for target in LINK.findall(text):
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                errors.append(f"link quebrado: {path.relative_to(ROOT)} -> {target}")

    if errors:
        print("\n".join(errors))
        return 1
    print(f"documentação válida: {len(owners)} owners normativos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
