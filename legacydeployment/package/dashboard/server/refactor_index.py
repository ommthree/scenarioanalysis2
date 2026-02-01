#!/usr/bin/env python3
"""
Systematic refactoring script to add getUserDatabase middleware to all routes
and convert from dbPath parameter to req.userDb
"""

import re
import sys

def main():
    index_path = '/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js'

    print("Reading index.js...")
    with open(index_path, 'r') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')

    # Stats
    stats = {
        'routes_refactored': 0,
        'getUserDatabase_added': 0,
        'dbPath_removed': 0,
        'validation_removed': 0,
        'db_connections_replaced': 0,
        'db_close_removed': 0
    }

    # Routes to skip
    skip_patterns = ['/api/auth/', '/api/admin/', '/api/health']

    result_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check for route definition
        route_match = re.match(r'^app\.(get|post|put|delete|patch)\s*\([\'"`]([^\'"` ]+)[\'"`]', line)

        if route_match:
            method = route_match.group(1)
            path = route_match.group(2)

            # Check if should skip
            should_skip = any(pattern in path for pattern in skip_patterns)

            if not should_skip and 'getUserDatabase' not in line:
                # Add getUserDatabase middleware
                # Find the position after the path string
                match = re.search(r'(app\.\w+\([\'"`][^\'"` ]+[\'"`]\s*,\s*)', line)
                if match:
                    prefix = match.group(1)
                    suffix = line[len(prefix):]
                    new_line = prefix + 'getUserDatabase, ' + suffix
                    result_lines.append(new_line)
                    stats['getUserDatabase_added'] += 1
                    stats['routes_refactored'] += 1
                    print(f"Added getUserDatabase to {method.upper()} {path}")
                else:
                    result_lines.append(line)
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)

        i += 1

    # Join lines back
    content = '\n'.join(result_lines)

    # Phase 2: Remove dbPath references and convert database connections
    print("\nPhase 2: Removing dbPath and converting database connections...")

    # Remove dbPath from destructuring (with other props)
    pattern = r'const\s+\{([^}]*),\s*dbPath\s*\}\s*=\s*req\.(body|query)'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Removing dbPath from destructuring with other properties: {len(matches)} occurrences")
        content = re.sub(pattern, r'const { \1 } = req.\2', content)
        stats['dbPath_removed'] += len(matches)

    # Remove standalone dbPath destructuring
    pattern = r'const\s+\{\s*dbPath\s*\}\s*=\s*req\.(body|query)[^\n]*\n'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Removing standalone dbPath destructuring: {len(matches)} occurrences")
        content = re.sub(pattern, '    // dbPath handled by getUserDatabase middleware\n', content)
        stats['dbPath_removed'] += len(matches)

    # Remove dbPath validation
    pattern = r'if\s*\(\s*!(?:file|statementType|scenarioName|locationFile|damageCurveFile|peril)\s*\|\|\s*!(?:statementType|scenarioName|locationFile|damageCurveFile|peril)\s*\|\|\s*!dbPath\s*\)\s*\{[^}]*\}'
    matches = re.findall(pattern, content)
    if matches:
        # Replace with version without dbPath check
        content = re.sub(
            r'if\s*\(\s*!file\s*\|\|\s*!statementType\s*\|\|\s*!dbPath\s*\)',
            'if (!file || !statementType)',
            content
        )
        content = re.sub(
            r'if\s*\(\s*!file\s*\|\|\s*!scenarioName\s*\|\|\s*!dbPath\s*\)',
            'if (!file || !scenarioName)',
            content
        )
        stats['validation_removed'] += len(matches)
        print(f"  Updated validation checks to remove dbPath: {len(matches)} occurrences")

    # Remove standalone dbPath validation
    pattern = r'\s*if\s*\(\s*!dbPath\s*\)\s*(?:return\s*)?res\.status\(\d+\)\.json\([^)]*\)[^\n]*\n'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Removing standalone dbPath validation: {len(matches)} occurrences")
        content = re.sub(pattern, '    // dbPath validation handled by getUserDatabase middleware\n', content)
        stats['validation_removed'] += len(matches)

    # Remove dbPath exists check
    pattern = r'\s*if\s*\(\s*!fs\.existsSync\s*\(\s*dbPath\s*\)\s*\)\s*\{[^}]*\}\n'
    matches = re.findall(pattern, content, re.MULTILINE | re.DOTALL)
    if matches:
        print(f"  Removing dbPath existence checks: {len(matches)} occurrences")
        content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)

    # Replace sqlite3 Database connections
    pattern = r'const\s+db\s*=\s*new\s+sqlite3\.Database\s*\(\s*dbPath[^)]*\)(?:\s*,\s*[^)]*\))?'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Replacing sqlite3.Database connections: {len(matches)} occurrences")
        content = re.sub(pattern, 'const db = req.userDb // Connected by getUserDatabase middleware', content)
        stats['db_connections_replaced'] += len(matches)

    # Replace better-sqlite3 Database connections
    pattern = r'const\s+db\s*=\s*new\s+Database\s*\(\s*dbPath\s*\)'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Replacing better-sqlite3 Database connections: {len(matches)} occurrences")
        content = re.sub(pattern, 'const db = req.userDb // Connected by getUserDatabase middleware', content)
        stats['db_connections_replaced'] += len(matches)

    # Remove db.close() calls
    pattern = r'\s*db\.close\(\s*\)[^\n]*'
    matches = re.findall(pattern, content)
    if matches:
        print(f"  Removing db.close() calls: {len(matches)} occurrences")
        content = re.sub(pattern, ' // Database cleanup handled by middleware', content)
        stats['db_close_removed'] += len(matches)

    # Remove dbPath from console.log statements
    content = re.sub(r',\s*dbPath:\s*req\.body\.dbPath', '', content)
    content = re.sub(r'dbPath:\s*req\.body\.dbPath,\s*', '', content)
    content = re.sub(r',\s*dbPath', '', content)
    content = re.sub(r"'dbPath:',\s*dbPath,?\s*", '', content)

    # Update comments that mention dbPath
    content = re.sub(r'Body:([^*]*)dbPath', r'Body:\1', content)
    content = re.sub(r', dbPath in comment', '', content)

    # Write modified content
    print("\nWriting modified index.js...")
    with open(index_path, 'w') as f:
        f.write(content)

    # Print statistics
    print("\n" + "="*50)
    print("REFACTORING SUMMARY")
    print("="*50)
    print(f"Routes refactored: {stats['routes_refactored']}")
    print(f"getUserDatabase middleware added: {stats['getUserDatabase_added']}")
    print(f"dbPath references removed: {stats['dbPath_removed']}")
    print(f"Validation checks updated: {stats['validation_removed']}")
    print(f"Database connections replaced: {stats['db_connections_replaced']}")
    print(f"db.close() calls removed: {stats['db_close_removed']}")
    print("="*50)
    print("\n✓ Refactoring complete!")

    return 0

if __name__ == '__main__':
    sys.exit(main())
