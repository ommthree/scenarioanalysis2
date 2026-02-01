# Daedalus Documentation

This folder contains the comprehensive user guide for the Daedalus financial modeling platform.

## Files

### Complete Documentation
- **DAEDALUS_USER_GUIDE.pdf** (30 MB) - Complete PDF with embedded images, title page, and clickable table of contents
- **DAEDALUS_USER_GUIDE.html** (64 MB) - Standalone HTML version with embedded images
- **DAEDALUS_USER_GUIDE_COMPLETE.md** (132 KB) - Combined markdown source

### Modular Source Files
- **DAEDALUS_USER_GUIDE_PART1.md** - Executive Summary
- **DAEDALUS_USER_GUIDE_PART2A.md** - Configuration & Data Management
- **DAEDALUS_USER_GUIDE_PART2B.md** - Physical Risk & Execution
- **DAEDALUS_USER_GUIDE_PART2C.md** - Visualizations & Reporting
- **DAEDALUS_USER_GUIDE_PART3A.md** - Engine Architecture
- **DAEDALUS_USER_GUIDE_PART3B.md** - Physical Risk & MAC/ROI Methodology
- **DAEDALUS_USER_GUIDE_PART3C.md** - Monte Carlo & Visualization Algorithms
- **DAEDALUS_USER_GUIDE_APPENDICES.md** - Installation, CSV Formats, Glossary, Troubleshooting

### Images
- **images/** - Folder containing 60+ PNG screenshots

### Build Scripts
- **convert_to_pdf.py** - Python script to convert HTML to PDF using Chrome headless
- **title_page.md** - Title page template

## Features

✅ **Professional PDF** with:
- Title page with Daedalus logo
- Clickable table of contents with hyperlinks
- Section numbering
- All 60+ images embedded
- ~50 pages of comprehensive documentation

✅ **Content Coverage**:
- Complete feature guide
- Technical methodology details
- Installation instructions
- CSV file format specifications
- Formula examples
- Troubleshooting guide

✅ **Web Integration**:
- PDF accessible from splash page "Documentation" button
- Opens in new tab for easy reference

## Regenerating the PDF

If you make changes to the markdown files, regenerate the PDF:

```bash
cd /Users/Owen/ScenarioAnalysis2/docs/docu

# Combine all parts with title page
cat title_page.md DAEDALUS_USER_GUIDE_COMPLETE.md > DAEDALUS_USER_GUIDE_WITH_TITLE.md

# Convert to HTML
pandoc DAEDALUS_USER_GUIDE_WITH_TITLE.md -o DAEDALUS_USER_GUIDE.html --embed-resources --standalone --toc --toc-depth=3 --number-sections

# Convert to PDF
python3 convert_to_pdf.py

# Copy to public folder
cp DAEDALUS_USER_GUIDE.pdf ../../dashboard/public/
```

## Document Structure

### Part I: Executive Summary (7 pages)
- Overview and value proposition
- Core capabilities
- Quick start guide
- Business impact

### Part II: Feature Guide (28 pages)
- Configuration and setup
- Data management
- Physical risk configuration
- Calculation execution
- Visualizations and reporting

### Part III: Methodology & Technical Reference (12 pages)
- Engine architecture
- Physical risk methodology
- MAC/ROI framework
- Monte Carlo simulation
- Visualization algorithms

### Appendices (5 pages)
- Installation instructions
- CSV file formats
- Formula examples
- Glossary
- Troubleshooting

## Author

Owen Matthews
November 2024
Version 1.0
