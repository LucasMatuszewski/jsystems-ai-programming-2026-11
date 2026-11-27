#!/usr/bin/env python3
"""Check relative Markdown links and #anchors in the given files.

Usage: python3 check_links.py <file.md> [<file.md> ...]
Exit code 1 if any link target or anchor is missing. External (http/https/mailto) links are skipped.
Anchors use GitHub-style slugs: lower-case, punctuation removed, spaces -> '-'.
"""
import os
import re
import sys

LINK = re.compile(r"\]\(([^)#\s]+)?(#[^)\s]+)?\)")
HEADING = re.compile(r"^#{1,6}\s+(.*)")


def slug(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE)
    return text.replace(" ", "-")


def anchors(path: str) -> set:
    found = set()
    in_code = False
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if line.lstrip().startswith("```"):
                in_code = not in_code
                continue
            match = HEADING.match(line)
            if match and not in_code:
                found.add(slug(match.group(1)))
    return found


def main(files):
    broken = 0
    for source in files:
        base = os.path.dirname(source)
        text = open(source, encoding="utf-8").read()
        # Links inside fenced code blocks are examples (e.g. templates), not real links.
        text = re.sub(r"^(`{3,}|~{3,}).*?^\1", "", text, flags=re.MULTILINE | re.DOTALL)
        for match in LINK.finditer(text):
            target, anchor = match.groups()
            if target and re.match(r"^(https?|mailto):", target):
                continue
            path = os.path.normpath(os.path.join(base, target)) if target else source
            if not os.path.exists(path):
                print(f"MISSING  {source}: {target}")
                broken += 1
                continue
            if anchor and path.endswith(".md") and anchor[1:] not in anchors(path):
                print(f"ANCHOR   {source}: {target or ''}{anchor}")
                broken += 1
    print(f"broken: {broken}")
    return 1 if broken else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
