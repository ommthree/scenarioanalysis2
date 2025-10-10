cmake_minimum_required(VERSION 3.20)
project(FinancialModelFramework VERSION 1.0.0 LANGUAGES CXX)

# C++20 Standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Compiler flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra -Wpedantic -Werror=return-type)
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        add_compile_options(-g -O0)
    elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
        add_compile_options(-O3 -DNDEBUG -march=native)
    endif()
elseif(MSVC)
    add_compile_options(/W4 /WX)
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        add_compile_options(/Od /Zi)
    elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
        add_compile_options(/O2 /DNDEBUG)
    endif()
endif()

# Output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Find packages
find_package(SQLite3 REQUIRED)
find_package(Threads REQUIRED)

# Eigen3 - try system package first, fall back to submodule
find_package(Eigen3 3.4 QUIET)
if(NOT Eigen3_FOUND)
    if(EXISTS "${CMAKE_SOURCE_DIR}/external/eigen/Eigen")
        add_library(Eigen3::Eigen INTERFACE IMPORTED)
        target_include_directories(Eigen3::Eigen INTERFACE ${CMAKE_SOURCE_DIR}/external/eigen)
        set(Eigen3_FOUND TRUE)
        message(STATUS "Using Eigen3 from external/eigen submodule")
    else()
        message(FATAL_ERROR "Eigen3 not found. Run: git submodule update --init --recursive")
    endif()
endif()

# External libraries (header-only or to be added as submodules)
# Crow - Web framework
if(EXISTS "${CMAKE_SOURCE_DIR}/external/crow/include")
    add_library(crow INTERFACE)
    target_include_directories(crow INTERFACE ${CMAKE_SOURCE_DIR}/external/crow/include)
    message(STATUS "Found Crow at external/crow")
else()
    message(WARNING "Crow not found at external/crow - will need to be added")
endif()

# nlohmann/json
if(EXISTS "${CMAKE_SOURCE_DIR}/external/nlohmann_json/include")
    add_library(nlohmann_json INTERFACE)
    target_include_directories(nlohmann_json INTERFACE ${CMAKE_SOURCE_DIR}/external/nlohmann_json/include)
    message(STATUS "Found nlohmann/json at external/nlohmann_json")
else()
    message(WARNING "nlohmann/json not found - will need to be added")
endif()

# spdlog
if(EXISTS "${CMAKE_SOURCE_DIR}/external/spdlog/include")
    add_library(spdlog INTERFACE)
    target_include_directories(spdlog INTERFACE ${CMAKE_SOURCE_DIR}/external/spdlog/include)
    message(STATUS "Found spdlog at external/spdlog")
else()
    message(WARNING "spdlog not found - will need to be added")
endif()

# Build engine
add_subdirectory(engine)

# Build tests
enable_testing()
add_subdirectory(engine/tests)

# Install targets
install(TARGETS scenario_engine
    RUNTIME DESTINATION bin
)

# Install web assets
install(DIRECTORY web/
    DESTINATION share/finmodel/web
    PATTERN "*.md" EXCLUDE
)

# Install configuration
install(DIRECTORY data/config/
    DESTINATION etc/finmodel
)

# Print summary
message(STATUS "")
message(STATUS "===== Financial Model Framework Configuration =====")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "C++ standard: C++${CMAKE_CXX_STANDARD}")
message(STATUS "SQLite3 found: ${SQLite3_FOUND}")
message(STATUS "Eigen3 found: ${Eigen3_FOUND}")
message(STATUS "Install prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "================================================")
message(STATUS "")
