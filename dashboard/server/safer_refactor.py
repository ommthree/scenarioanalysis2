#!/usr/bin/env python3
"""
Safer bulk refactor - only targets specific patterns in getUserDatabase routes.
"""
import re

def refactor_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    output = []
    changes = 0
    i = 0

    while i < len(lines):
        line = lines[i]

        # Skip lines that extract dbPath
        if re.match(r'\s*const\s*\{\s*dbPath\s*\}\s*=\s*req\.(query|body)', line):
            changes += 1
            i += 1
            continue

        # Skip dbPath validation blocks
        if re.match(r'\s*if\s*\(\s*!dbPath', line):
            # Skip until we find the closing brace
            depth = 0
            while i < len(lines):
                if '{' in lines[i]:
                    depth += lines[i].count('{')
                if '}' in lines[i]:
                    depth -= lines[i].count('}')
                i += 1
                changes += 1
                if depth == 0:
                    break
            continue

        # Replace database connection creation - more precise
        if 'const db = new sqlite3.Database(dbPath' in line:
            # Find the end of this statement (could be multiline)
            full_statement = line
            while i < len(lines) - 1 and not (')' in line and (';' in line or '{' in line or 'const' in lines[i+1])):
                i += 1
                full_statement += lines[i]

            output.append('  const db = req.userDb\n')
            changes += 1
            i += 1
            continue

        # Remove db.close() calls
        if re.match(r'\s*db\.close\(\s*\)', line):
            changes += 1
            i += 1
            continue

        output.append(line)
        i += 1

    if changes > 0:
        with open(filepath, 'w') as f:
            f.writelines(output)
        print(f"✅ Made {changes} changes")
        return True
    return False

if __name__ == '__main__':
    refactor_file('index.js')
