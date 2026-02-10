#!/usr/bin/env python3
"""
Phase 3: Remove leftover callback artifacts and fs.existsSync(userDb) checks
"""

import re

def main():
    index_path = '/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js'

    print("Reading index.js...")
    with open(index_path, 'r') as f:
        content = f.read()

    stats = {
        'fs_exists_removed': 0,
        'orphan_braces_removed': 0,
        'trailing_closures_fixed': 0
    }

    # Remove fs.existsSync(userDb) checks (this doesn't make sense with req.userDb)
    print("\nRemoving fs.existsSync(userDb) checks...")
    pattern = r'// Check if database exists\s*\n\s*if\s*\(\s*!fs\.existsSync\s*\(\s*userDb\s*\)\s*\)\s*\{[^}]*\n\s*\}\s*\n'
    matches = list(re.finditer(pattern, content, re.MULTILINE | re.DOTALL))
    for match in reversed(matches):
        content = content[:match.start()] + '\n' + content[match.end():]
    stats['fs_exists_removed'] += len(matches)
    print(f"  Removed {len(matches)} fs.existsSync(userDb) blocks")

    # Simpler version
    pattern = r'if\s*\(\s*!fs\.existsSync\s*\(\s*userDb\s*\)\s*\)\s*\{\s*\n(?:.*?\n)*?\s*\}\s*\n'
    matches = list(re.finditer(pattern, content, re.MULTILINE | re.DOTALL))
    for match in reversed(matches):
        content = content[:match.start()] + '\n' + content[match.end():]
    stats['fs_exists_removed'] += len(matches)
    print(f"  Removed {len(matches)} more fs.existsSync(userDb) blocks")

    # Fix orphaned closing braces after const db = req.userDb
    print("\nFixing orphaned braces after db assignment...")
    # Pattern: const db = req.userDb // Connected by getUserDatabase middleware
    #          }
    #      })
    pattern = r'(const db = req\.userDb // Connected by getUserDatabase middleware)\s*\n\s*\}\s*\n\s*\}\)'
    matches = list(re.finditer(pattern, content))
    content = re.sub(pattern, r'\1', content)
    stats['orphan_braces_removed'] += len(matches)
    print(f"  Removed {len(matches)} orphaned brace blocks")

    # Remove standalone trailing closures
    pattern = r'^\s*\}\s*\n\s*\}\)\s*$'
    matches = list(re.finditer(pattern, content, re.MULTILINE))
    content = re.sub(pattern, '', content, flags=re.MULTILINE)
    stats['trailing_closures_fixed'] += len(matches)
    print(f"  Removed {len(matches)} trailing closures")

    # Write the fixed content
    print("\nWriting fixed index.js...")
    with open(index_path, 'w') as f:
        f.write(content)

    print("\n" + "="*50)
    print("PHASE 3 CLEANUP SUMMARY")
    print("="*50)
    print(f"fs.existsSync(userDb) checks removed: {stats['fs_exists_removed']}")
    print(f"Orphaned braces removed: {stats['orphan_braces_removed']}")
    print(f"Trailing closures fixed: {stats['trailing_closures_fixed']}")
    print("="*50)
    print("\n✓ Phase 3 cleanup complete!")

    return 0

if __name__ == '__main__':
    main()
