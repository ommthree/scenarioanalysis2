#!/bin/bash
# Cross-compile Daedalus C++ engine for Windows
# Requires: mingw-w64 toolchain

set -e

echo "================================================"
echo "Cross-Compiling for Windows"
echo "================================================"
echo ""

# Check for mingw-w64
if ! command -v x86_64-w64-mingw32-g++ &> /dev/null; then
    echo "ERROR: mingw-w64 not found"
    echo ""
    echo "To install on macOS:"
    echo "  brew install mingw-w64"
    echo ""
    echo "To install on Ubuntu/Debian:"
    echo "  sudo apt-get install mingw-w64"
    echo ""
    echo "Alternative: Compile on Windows using Visual Studio"
    echo "See deployment/WINDOWS_DEPLOYMENT.md Method A"
    exit 1
fi

echo "Found mingw-w64 toolchain"
echo ""

# Create build directory
BUILD_DIR="build-windows"
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning previous Windows build..."
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "Configuring CMake for Windows..."
cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../cmake/mingw-w64-toolchain.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -G "Unix Makefiles"

echo ""
echo "Building for Windows..."
cmake --build . --config Release -j4

if [ -f "bin/run_calculation.exe" ]; then
    echo ""
    echo "================================================"
    echo "Build successful!"
    echo "================================================"
    echo ""
    echo "Executable: $BUILD_DIR/bin/run_calculation.exe"
    echo "Size: $(du -h bin/run_calculation.exe | cut -f1)"
    echo ""
    echo "Next steps:"
    echo "1. Copy to portable package:"
    echo "   cp $BUILD_DIR/bin/run_calculation.exe deployment/Daedalus-Portable/bin/"
    echo "2. Test on Windows machine"
    echo ""
else
    echo ""
    echo "ERROR: Build completed but executable not found"
    exit 1
fi

cd ..
