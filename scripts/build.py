import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
VALID_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
VALID_PERMS = {
    "ui:decks",
    "ui:reviewer",
    "events:cards",
    "events:app",
    "stats:read",
    "storage",
    "app:read",
}


def validate_plugin(entry: dict) -> Path:
    pid = entry.get("id", "")
    if not isinstance(pid, str) or not VALID_ID_RE.match(pid):
        raise ValueError(f"Invalid plugin id in registry.json: {pid!r}")

    plugin_dir = ROOT / "plugins" / pid
    manifest_path = plugin_dir / "manifest.json"
    code_path = plugin_dir / "index.js"
    if not manifest_path.is_file() or not code_path.is_file():
        raise ValueError(f"Plugin '{pid}' must have manifest.json and index.js in plugins/{pid}/")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("id") != pid:
        raise ValueError(f"manifest.json id mismatch for '{pid}': {manifest.get('id')!r}")

    for field in ("name", "version"):
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            raise ValueError(f"Plugin '{pid}' manifest.json missing '{field}'")

    perms = manifest.get("permissions", [])
    if not isinstance(perms, list) or any(p not in VALID_PERMS for p in perms):
        raise ValueError(f"Plugin '{pid}' has invalid permissions: {perms!r}")

    reg_perms = entry.get("permissions", [])
    if set(reg_perms) != set(perms):
        raise ValueError(
            f"Plugin '{pid}' registry permissions {reg_perms!r} do not match manifest permissions {perms!r}"
        )

    code = code_path.read_text(encoding="utf-8")
    if "onLoad" not in code:
        raise ValueError(f"Plugin '{pid}' index.js must export onLoad(sdk)")

    # Syntax check via Node if available
    if shutil.which("node"):
        res = subprocess.run(
            ["node", "--check", str(code_path)],
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            raise ValueError(f"JS syntax check failed for '{pid}':\n{res.stderr}")

    return plugin_dir


def package_plugin(plugin_dir: Path, pid: str, packages_dir: Path) -> None:
    manifest_path = plugin_dir / "manifest.json"
    code_path = plugin_dir / "index.js"

    for ext in ("cardlyaddon", "zip"):
        out_path = packages_dir / f"{pid}.{ext}"
        with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(manifest_path, arcname="manifest.json")
            zf.write(code_path, arcname="index.js")


def main() -> int:
    registry_path = ROOT / "registry.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    plugins = registry.get("plugins")
    if not isinstance(plugins, list):
        raise ValueError("registry.json must contain a 'plugins' array")

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # Copy static site files
    site_dir = ROOT / "site"
    for item in site_dir.iterdir():
        dest = DIST / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Copy registry.json and plugins directory (code + screenshots)
    shutil.copy2(registry_path, DIST / "registry.json")
    if (ROOT / "plugins").exists():
        shutil.copytree(ROOT / "plugins", DIST / "plugins")

    packages_dir = DIST / "packages"
    packages_dir.mkdir(parents=True, exist_ok=True)

    seen_ids = set()
    for entry in plugins:
        pid = entry.get("id")
        if pid in seen_ids:
            raise ValueError(f"Duplicate plugin id in registry.json: {pid!r}")
        seen_ids.add(pid)
        plugin_dir = validate_plugin(entry)
        package_plugin(plugin_dir, pid, packages_dir)
        print(f"✓ Validated & packaged {pid} v{entry.get('version')}")

    print(f"✓ Built {len(plugins)} plugin(s) into {DIST}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"✗ Build failed: {exc}", file=sys.stderr)
        sys.exit(1)
