cmake_minimum_required(VERSION 3.20)

# Collect all source files (exclude main.cpp which is only for executable)
file(GLOB_RECURSE ENGINE_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp"
)
list(FILTER ENGINE_SOURCES EXCLUDE REGEX ".*main\\.cpp$")

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
            SQLite::SQLite3
            Eigen3::Eigen
            Threads::Threads
        PRIVATE
            $<$<TARGET_EXISTS:crow>:crow>
            $<$<TARGET_EXISTS:nlohmann_json>:nlohmann_json>
            $<$<TARGET_EXISTS:spdlog>:spdlog>
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

# Main executable
add_executable(scenario_engine src/main.cpp)

target_link_libraries(scenario_engine
    PRIVATE
        engine_lib
)

# Install
install(TARGETS scenario_engine engine_lib
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

install(DIRECTORY include/
    DESTINATION include/finmodel
)
