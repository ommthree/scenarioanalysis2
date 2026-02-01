cmake_minimum_required(VERSION 3.20)
project(FinModel)

# Find required packages
find_package(SQLite3 REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(Threads REQUIRED)
find_package(nlohmann_json REQUIRED)

# Collect all source files (exclude main.cpp and archived files)
file(GLOB_RECURSE ENGINE_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp"
)
list(FILTER ENGINE_SOURCES EXCLUDE REGEX ".*main\\.cpp$")
list(FILTER ENGINE_SOURCES EXCLUDE REGEX ".*/archive/.*")

# Collect all header files (for IDE organization)
file(GLOB_RECURSE ENGINE_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/include/*.h"
)

# Create engine library (only if we have sources)
if(ENGINE_SOURCES)
    add_library(engine_lib STATIC ${ENGINE_SOURCES})
else()
    # Create empty library if no sources yet (for early project setup)
    add_library(engine_lib INTERFACE)
    message(STATUS "Creating interface-only engine_lib (no sources found yet)")
endif()

if(ENGINE_SOURCES)
    target_include_directories(engine_lib
        PUBLIC
            $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
            $<INSTALL_INTERFACE:include>
        PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}/src
    )

    target_link_libraries(engine_lib
        PUBLIC
            ${SQLite3_LIBRARIES}
            Eigen3::Eigen
            Threads::Threads
            nlohmann_json::nlohmann_json
        PRIVATE
            $<$<TARGET_EXISTS:crow>:crow>
            $<$<TARGET_EXISTS:spdlog>:spdlog>
    )

    target_include_directories(engine_lib
        PUBLIC
            ${SQLite3_INCLUDE_DIRS}
    )

    # Set properties
    set_target_properties(engine_lib PROPERTIES
        POSITION_INDEPENDENT_CODE ON
        CXX_STANDARD 20
        CXX_STANDARD_REQUIRED ON
    )
else()
    # Interface library setup
    target_include_directories(engine_lib
        INTERFACE
            $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    )
endif()

# Main executables (scenario_engine removed - use run_calculation instead)

# Calculation runner executable
add_executable(run_calculation src/run_calculation.cpp)

target_link_libraries(run_calculation
    PRIVATE
        engine_lib
        nlohmann_json::nlohmann_json
)

set_target_properties(run_calculation PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
)

# Install
install(TARGETS run_calculation engine_lib
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

install(DIRECTORY include/
    DESTINATION include/finmodel
)
