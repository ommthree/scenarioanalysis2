#!/bin/bash
#
# Development Environment Setup Script
# Sets up all dependencies for the Dynamic Financial Statement Modelling Framework
# Works on: macOS (local dev) and Ubuntu 22.04+ (AWS Lightsail)
#

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}ScenarioAnalysis2 Setup${NC}"
echo -e "${GREEN}================================${NC}"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo -e "${YELLOW}Detected: macOS${NC}"
elif [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "$ID" == "ubuntu" ]]; then
        OS="ubuntu"
        echo -e "${YELLOW}Detected: Ubuntu $VERSION_ID${NC}"
    else
        echo -e "${RED}Unsupported Linux distribution: $ID${NC}"
        exit 1
    fi
else
    echo -e "${RED}Unsupported operating system${NC}"
    exit 1
fi

# Function: Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function: Check version requirement
check_version() {
    local cmd=$1
    local required=$2
    local current=$($cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)

    if [[ $(echo -e "$current\n$required" | sort -V | head -1) == "$required" ]]; then
        echo -e "${GREEN}✓ $cmd $current (>= $required required)${NC}"
        return 0
    else
        echo -e "${RED}✗ $cmd $current (>= $required required)${NC}"
        return 1
    fi
}

echo ""
echo -e "${GREEN}[1/5] Checking system dependencies...${NC}"

# Check CMake
if command_exists cmake; then
    check_version cmake 3.20 || NEED_CMAKE=1
else
    NEED_CMAKE=1
fi

# Check SQLite3
if command_exists sqlite3; then
    SQLITE_VERSION=$(sqlite3 --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [[ $(echo -e "$SQLITE_VERSION\n3.35" | sort -V | head -1) == "3.35" ]]; then
        echo -e "${GREEN}✓ SQLite3 $SQLITE_VERSION (>= 3.35 required)${NC}"
    else
        NEED_SQLITE=1
    fi
else
    NEED_SQLITE=1
fi

# Check C++ compiler
if [[ "$OS" == "macos" ]]; then
    if command_exists clang++; then
        echo -e "${GREEN}✓ clang++ available${NC}"
    else
        echo -e "${RED}✗ clang++ not found. Install Xcode Command Line Tools:${NC}"
        echo "  xcode-select --install"
        exit 1
    fi
elif [[ "$OS" == "ubuntu" ]]; then
    if command_exists g++; then
        check_version g++ 11.0 || NEED_GCC=1
    else
        NEED_GCC=1
    fi
fi

# Check Git
if ! command_exists git; then
    echo -e "${RED}✗ Git not found${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Git available${NC}"
fi

# Install missing dependencies
if [[ -n "$NEED_CMAKE" || -n "$NEED_SQLITE" || -n "$NEED_GCC" ]]; then
    echo ""
    echo -e "${YELLOW}[2/5] Installing missing dependencies...${NC}"

    if [[ "$OS" == "macos" ]]; then
        if ! command_exists brew; then
            echo -e "${RED}Homebrew not found. Install from https://brew.sh${NC}"
            exit 1
        fi

        [[ -n "$NEED_CMAKE" ]] && brew install cmake
        [[ -n "$NEED_SQLITE" ]] && brew install sqlite3

    elif [[ "$OS" == "ubuntu" ]]; then
        echo "Updating package list..."
        sudo apt-get update -qq

        [[ -n "$NEED_CMAKE" ]] && sudo apt-get install -y cmake
        [[ -n "$NEED_SQLITE" ]] && sudo apt-get install -y sqlite3 libsqlite3-dev
        [[ -n "$NEED_GCC" ]] && sudo apt-get install -y g++-11 gcc-11

        # Additional Ubuntu dependencies
        sudo apt-get install -y \
            build-essential \
            pkg-config \
            libssl-dev \
            ninja-build
    fi
else
    echo -e "${GREEN}All system dependencies installed${NC}"
fi

echo ""
echo -e "${GREEN}[3/5] Cloning git submodules...${NC}"

# Initialize submodules if not already done
if [[ ! -d "external/crow/.git" ]]; then
    echo "Initializing submodules..."
    git submodule update --init --recursive
    echo -e "${GREEN}✓ Submodules initialized${NC}"
else
    echo "Updating submodules..."
    git submodule update --recursive
    echo -e "${GREEN}✓ Submodules updated${NC}"
fi

# Verify external libraries
echo ""
echo -e "${GREEN}[4/5] Verifying external libraries...${NC}"

LIBS=("crow" "eigen" "nlohmann_json" "spdlog" "catch2")
for lib in "${LIBS[@]}"; do
    if [[ -d "external/$lib" ]]; then
        echo -e "${GREEN}✓ $lib${NC}"
    else
        echo -e "${RED}✗ $lib not found in external/$lib${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}[5/5] Creating build directory...${NC}"

# Create build directory
if [[ ! -d "build" ]]; then
    mkdir build
    echo -e "${GREEN}✓ Created build/${NC}"
else
    echo -e "${YELLOW}build/ already exists${NC}"
fi

# Create data directories
mkdir -p data/database
mkdir -p data/config/templates
mkdir -p data/sample
mkdir -p data/results
echo -e "${GREEN}✓ Created data directories${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Build the project:"
echo "     cd build"
echo "     cmake -DCMAKE_BUILD_TYPE=Debug .."
echo "     make -j\$(nproc)"
echo ""
echo "  2. Run tests:"
echo "     ctest --output-on-failure"
echo ""
echo "  3. Initialize database:"
echo "     ./engine/scenario_engine --init-db"
echo ""
echo "  4. Start web server:"
echo "     ./engine/scenario_engine --mode server --port 8080"
echo ""

# Print system info
echo -e "${YELLOW}System Information:${NC}"
echo "  OS: $OS"
cmake --version | head -1
sqlite3 --version | head -1
if [[ "$OS" == "macos" ]]; then
    clang++ --version | head -1
else
    g++ --version | head -1
fi

echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
