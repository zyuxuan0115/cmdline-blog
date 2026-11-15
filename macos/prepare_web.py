#!/usr/bin/env python3
"""Build the app's web resources from shared sources, without network access."""
import hashlib
import json
from pathlib import Path
import re
import shutil

MACOS = Path(__file__).resolve().parent
REPO = MACOS.parent
OUTPUT = MACOS / "Sources/CmdLineBlog/Resources/Web"


def prepare(output=OUTPUT):
    manifest = json.loads((MACOS / "vendor/manifest.json").read_text())
    replacements = {}
    for asset in manifest:
        source = MACOS / "vendor" / asset["file"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != asset["sha256"]:
            raise ValueError(f"Vendor checksum mismatch: {source}")
        if "original" in asset:
            replacements[asset["original"]] = "vendor/" + asset["file"]

    html = (REPO / "index.html").read_text()
    for original, local in replacements.items():
        html = html.replace(original, local)
    remote = re.findall(r'(?:src|href)=[\'"](https?://[^\'"]+)', html)
    if remote:
        raise ValueError(f"Unbundled dependency in index.html: {remote}")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    (output / "index.html").write_text(html)
    shutil.copy2(REPO / "style.css", output / "style.css")
    for name in ("js", "fonts", "pic"):
        shutil.copytree(REPO / name, output / name, ignore=shutil.ignore_patterns(".*"))
    for asset in manifest:
        target = output / "vendor" / asset["file"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MACOS / "vendor" / asset["file"], target)
    print(f"Prepared bundled UI: {output}")


if __name__ == "__main__":
    prepare()
