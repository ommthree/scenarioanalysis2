cmake_minimum_required(VERSION 3.20)

# Find Catch2 - v3 uses src/catch2 instead of single_include
if(EXISTS "${CMAKE_SOURCE_DIR}/external/catch2/src/catch2")
    add_subdirectory(${CMAKE_SOURCE_DIR}/external/catch2 ${CMAKE_BINARY_DIR}/catch2)
    message(STATUS "Found Catch2 v3 at external/catch2")
elseif(EXISTS "${CMAKE_SOURCE_DIR}/external/catch2/single_include")
    add_library(Catch2::Catch2 INTERFACE IMPORTED)
    target_include_directories(Catch2::Catch2 INTERFACE ${CMAKE_SOURCE_DIR}/external/catch2/single_include)
    message(STATUS "Found Catch2 v2 at external/catch2")
else()
    message(WARNING "Catch2 not found - tests will not build")
    return()
endif()

# Test sources
set(TEST_SOURCES
    test_database.cpp
    test_statement_template.cpp
    test_formula_evaluator.cpp
    test_dependency_graph.cpp
    test_pl_engine.cpp
    test_bs_engine.cpp
    test_cf_engine.cpp
    test_tax_strategies.cpp
    test_period_runner.cpp
    test_integration.cpp
)

# Create test executable
add_executable(run_tests ${TEST_SOURCES})

target_link_libraries(run_tests
    PRIVATE
        engine_lib
        Catch2::Catch2WithMain
)

target_include_directories(run_tests
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

# Register tests with CTest
include(CTest)

# Set working directory to build/ for all tests so database paths work
add_test(NAME AllTests COMMAND run_tests WORKING_DIRECTORY ${CMAKE_BINARY_DIR})

# Individual test registration (optional)
add_test(NAME DatabaseTests COMMAND run_tests "[database]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME TemplateTests COMMAND run_tests "[template]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME FormulaTests COMMAND run_tests "[formula]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME DependencyTests COMMAND run_tests "[dependency]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME PLEngineTests COMMAND run_tests "[pl_engine]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME BSEngineTests COMMAND run_tests "[bs]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME CFEngineTests COMMAND run_tests "[cf_engine]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME TaxStrategyTests COMMAND run_tests "[tax]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME OrchestrationTests COMMAND run_tests "[orchestration]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_test(NAME IntegrationTests COMMAND run_tests "[integration]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})

# Coverage (optional)
option(ENABLE_COVERAGE "Enable code coverage" OFF)
if(ENABLE_COVERAGE AND CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(run_tests PRIVATE --coverage)
    target_link_options(run_tests PRIVATE --coverage)

    add_custom_target(coverage
        COMMAND ${CMAKE_CTEST_COMMAND}
        COMMAND lcov --capture --directory . --output-file coverage.info
        COMMAND lcov --remove coverage.info '/usr/*' --output-file coverage.info
        COMMAND lcov --list coverage.info
        COMMAND genhtml coverage.info --output-directory htmlcov
        WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
        COMMENT "Generating code coverage report"
    )
endif()
