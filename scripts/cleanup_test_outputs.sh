#!/bin/bash

# Cleanup and organize test output files
# Consolidates test outputs into a single canonical location

echo "================================================"
echo "Test Output Cleanup and Organization"
echo "================================================"
echo ""

# Define canonical test output location
CANONICAL_DIR="/Users/Owen/ScenarioAnalysis2/build/test_output"

# Create canonical directory if it doesn't exist
mkdir -p "$CANONICAL_DIR"

echo "1. Moving test output files to canonical location: build/test_output/"
echo ""

# Move files from scripts/test_output to build/test_output
if [ -d "/Users/Owen/ScenarioAnalysis2/scripts/test_output" ]; then
    echo "   → Moving files from scripts/test_output/..."
    for file in /Users/Owen/ScenarioAnalysis2/scripts/test_output/*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            echo "     • $filename"
            mv "$file" "$CANONICAL_DIR/"
        fi
    done
    rmdir "/Users/Owen/ScenarioAnalysis2/scripts/test_output" 2>/dev/null
    echo "   ✓ Removed scripts/test_output/"
    echo ""
fi

# Remove empty root test_output directory
if [ -d "/Users/Owen/ScenarioAnalysis2/test_output" ]; then
    if [ -z "$(ls -A /Users/Owen/ScenarioAnalysis2/test_output)" ]; then
        echo "   → Removing empty root test_output/"
        rmdir "/Users/Owen/ScenarioAnalysis2/test_output"
        echo "   ✓ Removed test_output/"
        echo ""
    fi
fi

echo "2. Organizing test reports by category..."
echo ""

# Move old carbon/MAC reports to archive
mkdir -p "$CANONICAL_DIR/archive"
if [ -f "$CANONICAL_DIR/LEVEL9_CARBON_ACCOUNTING_REPORT.md" ]; then
    echo "   → Archiving old LEVEL9_CARBON_ACCOUNTING_REPORT.md (superseded)"
    mv "$CANONICAL_DIR/LEVEL9_CARBON_ACCOUNTING_REPORT.md" "$CANONICAL_DIR/archive/"
fi

if [ -f "$CANONICAL_DIR/LEVEL10_MAC_CURVES_REPORT.md" ]; then
    echo "   → Archiving old LEVEL10_MAC_CURVES_REPORT.md (superseded)"
    mv "$CANONICAL_DIR/LEVEL10_MAC_CURVES_REPORT.md" "$CANONICAL_DIR/archive/"
fi

echo ""
echo "3. Summary of test output files:"
echo ""
echo "   CSV Files (Level 1-9):"
ls -1 "$CANONICAL_DIR"/*.csv 2>/dev/null | while read file; do
    filename=$(basename "$file")
    size=$(ls -lh "$file" | awk '{print $5}')
    echo "     • $filename ($size)"
done

echo ""
echo "   Archived Reports:"
ls -1 "$CANONICAL_DIR/archive"/*.md 2>/dev/null | while read file; do
    filename=$(basename "$file")
    echo "     • $filename"
done

echo ""
echo "================================================"
echo "✓ Cleanup Complete"
echo "================================================"
echo ""
echo "Canonical test output location:"
echo "  $CANONICAL_DIR"
echo ""
echo "Test reports location:"
echo "  /Users/Owen/ScenarioAnalysis2/docs/test_results/"
echo ""
