#!/usr/bin/env python3
"""
Bulk refactor index.js to use req.userDb instead of creating database connections.
This script handles the conversion from sqlite3 callback style to better-sqlite3 synchronous style.
"""
import re
import sys

def refactor_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    changes_made = 0

    # Pattern 1: Remove dbPath extraction from query/body
    patterns_to_remove = [
        r'\s*const\s*\{\s*dbPath\s*\}\s*=\s*req\.query\s*\n',
        r'\s*const\s*\{\s*dbPath\s*\}\s*=\s*req\.body\s*\n',
        r'\s*const\s+dbPath\s*=\s*req\.query\.dbPath\s*\n',
        r'\s*const\s+dbPath\s*=\s*req\.body\.dbPath\s*\n',
    ]

    for pattern in patterns_to_remove:
        before_count = len(re.findall(pattern, content))
        content = re.sub(pattern, '', content)
        changes_made += before_count

    # Pattern 2: Remove dbPath validation blocks
    # Match: if (!dbPath) { return res.status(400).json({ error: '...' }) }
    validation_pattern = r'\s*if\s*\(\s*!dbPath\s*\)\s*\{\s*return\s+res\.status\(\d+\)\.json\([^}]+\}\s*\)\s*\}\s*\n'
    before_count = len(re.findall(validation_pattern, content))
    content = re.sub(validation_pattern, '', content)
    changes_made += before_count

    # Pattern 3: Replace database connection creation
    # FROM: const db = new sqlite3.Database(dbPath, ...)
    # TO: const db = req.userDb
    db_create_pattern = r'const\s+db\s*=\s*new\s+sqlite3\.Database\([^)]+\)\s*,?\s*(?:sqlite3\.OPEN_\w+\s*,?\s*)?\s*(?:\([^)]*\)\s*=>\s*\{[^}]*\}\s*)?'

    def replace_db_creation(match):
        nonlocal changes_made
        changes_made += 1
        return 'const db = req.userDb'

    content = re.sub(db_create_pattern, replace_db_creation, content)

    # Pattern 4: Remove db.close() calls
    close_pattern = r'\s*db\.close\(\)\s*\n'
    before_count = len(re.findall(close_pattern, content))
    content = re.sub(close_pattern, '', content)
    changes_made += before_count

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"✅ Refactored {filepath}")
        print(f"   Made {changes_made} changes")
        return True
    else:
        print(f"ℹ️  No changes needed in {filepath}")
        return False

if __name__ == '__main__':
    filepath = 'index.js'
    if len(sys.argv) > 1:
        filepath = sys.argv[1]

    try:
        refactored = refactor_file(filepath)
        sys.exit(0 if refactored else 1)
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(2)
