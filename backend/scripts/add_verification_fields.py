#!/usr/bin/env python3
"""
One-time migration: adds "verified" and "last_checked" fields to every
chunk in the knowledge base that doesn't already have them.

Why this exists: the current knowledge base was written from general
legal knowledge, not copied from checked official texts. Marking every
existing chunk verified=false is the honest starting point. As you (or
a law student / advocate) check a chunk against the actual Act, Revenue
Standing Order, or government circular, flip its "verified" field to
true and set "last_checked" to today's date.

Usage:
    python scripts/add_verification_fields.py
"""
import json
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings

settings = get_settings()
KB_PATH = settings.knowledge_base_path


def main():
    with open(KB_PATH, encoding="utf-8") as f:
        chunks = json.load(f)

    added = 0
    for chunk in chunks:
        if "verified" not in chunk:
            chunk["verified"] = False
            chunk["last_checked"] = None
            added += 1

    with open(KB_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    print(f"Knowledge base: {KB_PATH}")
    print(f"Total chunks: {len(chunks)}")
    print(f"Fields added to: {added} chunk(s)")
    print(f"Already had fields: {len(chunks) - added} chunk(s)")
    print()
    print("All chunks now default to verified=false.")
    print("To mark a chunk as checked against its real source, edit its")
    print('entry in tn_legal_kb.json and set: "verified": true, "last_checked": "%s"' % date.today().isoformat())
    print()
    print("Remember to rebuild the FAISS index after editing the knowledge base:")
    print("  python scripts/build_index.py --force")


if __name__ == "__main__":
    main()
