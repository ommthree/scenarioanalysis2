#!/usr/bin/env python3
"""
Phase 2: Clean up remaining dbPath references and fix broken replacements
"""

import re

def main():
    index_path = '/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js'

    print("Reading index.js...")
    with open(index_path, 'r') as f:
        content = f.read()

    original_length = len(content)

    # Fix broken db = req.userDb replacement that left callback code
    print("\nFixing broken db connection replacements...")

    # Pattern: const db = req.userDb // Connected by getUserDatabase middleware => { ... })
    # This happens when the original had a callback
    pattern = r'const db = req\.userDb // Connected by getUserDatabase middleware[^}]*\}\)'
    content = re.sub(pattern, 'const db = req.userDb // Connected by getUserDatabase middleware', content, flags=re.DOTALL)

    # Remove all remaining dbPath references from console.log
    print("Removing dbPath from console.log statements...")
    content = re.sub(r"'dbPath:',\s*dbPath,?\s*", '', content)
    content = re.sub(r",\s*'dbPath:',?\s*", '', content)
    content = re.sub(r"dbPath:\s*req\.body\.dbPath,?\s*", '', content)
    content = re.sub(r",\s*dbPath:\s*[^,}]+", '', content)

    # Remove dbPath from console.log within objects
    content = re.sub(r",\s*\n\s*dbPath:\s*[^,\n}]+", '', content)
    content = re.sub(r"dbPath:\s*[^,\n}]+,\s*", '', content)

    # Remove fs.existsSync(dbPath) checks
    print("Removing fs.existsSync(dbPath) checks...")
    # Multi-line pattern for if (!fs.existsSync(dbPath)) { ... }
    pattern = r'// Check if database exists\s*\n\s*if\s*\(\s*!fs\.existsSync\s*\(\s*dbPath\s*\)\s*\)\s*\{[^}]*\n\s*\}\)\s*\n\s*\}'
    content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)

    # Simpler version
    pattern = r'if\s*\(\s*!fs\.existsSync\s*\(\s*dbPath\s*\)\s*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    matches = list(re.finditer(pattern, content, re.MULTILINE | re.DOTALL))
    for match in reversed(matches):
        content = content[:match.start()] + '// Database path handled by getUserDatabase middleware' + content[match.end():]
    print(f"  Removed {len(matches)} fs.existsSync checks")

    # Fix console.log statements that reference dbPath
    content = re.sub(r"'dbPath:', dbPath", '', content)
    content = re.sub(r", 'dbPath:'", '', content)

    # Replace any remaining standalone dbPath usage in error messages
    content = re.sub(r'Database not found at \$\{dbPath\}', 'Database connection issue', content)
    content = re.sub(r'dbPath', 'userDb', content)

    # Write the fixed content
    print("\nWriting fixed index.js...")
    with open(index_path, 'w') as f:
        f.write(content)

    print(f"\nOriginal size: {original_length} bytes")
    print(f"New size: {len(content)} bytes")
    print(f"Difference: {original_length - len(content)} bytes removed")
    print("\n✓ Phase 2 cleanup complete!")

    return 0

if __name__ == '__main__':
    main()
