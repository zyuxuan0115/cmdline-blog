import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest

MACOS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_web", MACOS / "prepare_web.py")
prepare_web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare_web)


class WebBundleTests(unittest.TestCase):
    def test_frontend_and_every_dependency_are_local(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "Web"
            prepare_web.prepare(output)
            html = (output / "index.html").read_text()
            for reference in re.findall(r'(?:src|href)=[\'"]([^\'"]+)', html):
                self.assertNotRegex(reference, r"^https?://")
                self.assertTrue((output / reference.split("?")[0]).is_file(), reference)
            for relative in ["style.css", "js/terminal.js", "js/vim-editor.js", "pic/girl.png"]:
                self.assertEqual((output / relative).read_bytes(), (MACOS.parent / relative).read_bytes())
            self.assertFalse((output / "blog.html").exists())

    def test_vendor_hashes_and_licenses_are_complete(self):
        manifest = json.loads((MACOS / "vendor/manifest.json").read_text())
        self.assertEqual(len([x for x in manifest if "original" in x]), 12)
        for asset in manifest:
            data = (MACOS / "vendor" / asset["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), asset["sha256"])
        self.assertEqual(len([x for x in manifest if "LICENSE" in x["file"]]), 3)
