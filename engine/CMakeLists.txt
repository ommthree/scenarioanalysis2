cmake_minimum_required(VERSION 3.20)

# Engine library sources
set(ENGINE_SOURCES
    # Database
    src/database/sqlite_database.cpp
    src/database/result_set.cpp
    src/database/database_factory.cpp

    # Core
    src/core/statement_template.cpp
    src/core/formula_evaluator.cpp
    src/core/pl_engine.cpp
    src/core/bs_engine.cpp
    src/core/cf_engine.cpp
    src/core/scenario_runner.cpp

    # Policy
    src/policy/funding_policy_solver.cpp
    src/policy/wc_policy.cpp

    # Tax
    src/tax/simple_tax_strategy.cpp
    src/tax/progressive_tax_strategy.cpp
    src/tax/loss_carryforward_tax_strategy.cpp

    # Web server
    src/web/server.cpp
)

# Engine library headers
set(ENGINE_HEADERS
    include/database/idatabase.h
    include/database/result_set.h
    include/database/database_factory.h
    include/core/statement_template.h
    include/core/formula_evaluator.h
    include/core/pl_engine.h
    include/core/bs_engine.h
    include/core/cf_engine.h
    include/core/scenario_runner.h
    include/policy/funding_policy.h
    include/policy/capex_policy.h
    include/policy/wc_policy.h
    include/tax/tax_strategy.h
    include/types/common_types.h
)

# Create engine library
add_library(engine_lib STATIC ${ENGINE_SOURCES} ${ENGINE_HEADERS})

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
