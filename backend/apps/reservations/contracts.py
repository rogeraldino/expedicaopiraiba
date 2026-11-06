import hashlib
from pathlib import Path

CONTRACT_VERSION = "1.0"
CONTRACT_PATH = Path(__file__).parent / "contracts" / "contrato-servico-v1.md"


def current_contract():
    content = CONTRACT_PATH.read_text(encoding="utf-8")
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return CONTRACT_VERSION, digest, content
