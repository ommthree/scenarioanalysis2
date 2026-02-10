/**
 * @file test_dependency_graph.cpp
 * @brief Comprehensive unit tests for DependencyGraph
 */

#include <catch2/catch_test_macros.hpp>
#include "core/dependency_graph.h"
#include <algorithm>

using namespace finmodel::core;

// ============================================================================
// Basic Graph Operations
// ============================================================================

TEST_CASE("DependencyGraph - Basic operations", "[dependency][basic]") {
    DependencyGraph graph;

    SECTION("Empty graph") {
        REQUIRE(graph.empty());
        REQUIRE(graph.size() == 0);
        REQUIRE(graph.get_all_nodes().empty());
    }

    SECTION("Add single node") {
        graph.add_node("A");
        REQUIRE(!graph.empty());
        REQUIRE(graph.size() == 1);

        auto nodes = graph.get_all_nodes();
        REQUIRE(nodes.size() == 1);
        REQUIRE(nodes[0] == "A");
    }

    SECTION("Add multiple nodes") {
        graph.add_node("A");
        graph.add_node("B");
        graph.add_node("C");

        REQUIRE(graph.size() == 3);
        auto nodes = graph.get_all_nodes();
        REQUIRE(nodes.size() == 3);
    }

    SECTION("Add duplicate nodes") {
        graph.add_node("A");
        graph.add_node("A");

        REQUIRE(graph.size() == 1);  // Should not duplicate
    }

    SECTION("Clear graph") {
        graph.add_node("A");
        graph.add_node("B");
        graph.clear();

        REQUIRE(graph.empty());
        REQUIRE(graph.size() == 0);
    }
}

TEST_CASE("DependencyGraph - Edge operations", "[dependency][edges]") {
    DependencyGraph graph;

    SECTION("Add edge creates nodes") {
        graph.add_edge("A", "B");  // A depends on B

        REQUIRE(graph.size() == 2);
        auto nodes = graph.get_all_nodes();
        REQUIRE(std::find(nodes.begin(), nodes.end(), "A") != nodes.end());
        REQUIRE(std::find(nodes.begin(), nodes.end(), "B") != nodes.end());
    }

    SECTION("Get dependencies") {
        graph.add_edge("A", "B");
        graph.add_edge("A", "C");

        auto deps = graph.get_dependencies("A");
        REQUIRE(deps.size() == 2);
        REQUIRE(std::find(deps.begin(), deps.end(), "B") != deps.end());
        REQUIRE(std::find(deps.begin(), deps.end(), "C") != deps.end());
    }

    SECTION("Get dependencies for node with no deps") {
        graph.add_node("A");
        auto deps = graph.get_dependencies("A");
        REQUIRE(deps.empty());
    }

    SECTION("Get dependencies for unknown node") {
        auto deps = graph.get_dependencies("UNKNOWN");
        REQUIRE(deps.empty());
    }
}

// ============================================================================
// Topological Sort Tests
// ============================================================================

TEST_CASE("DependencyGraph - Simple topological sort", "[dependency][topsort]") {
    DependencyGraph graph;

    SECTION("Single node") {
        graph.add_node("A");
        auto order = graph.topological_sort();

        REQUIRE(order.size() == 1);
        REQUIRE(order[0] == "A");
    }

    SECTION("Two nodes - no dependencies") {
        graph.add_node("A");
        graph.add_node("B");
        auto order = graph.topological_sort();

        REQUIRE(order.size() == 2);
        // Order doesn't matter - both are valid
    }

    SECTION("Two nodes - linear dependency") {
        graph.add_edge("A", "B");  // A depends on B
        auto order = graph.topological_sort();

        REQUIRE(order.size() == 2);

        // B must come before A
        auto pos_a = std::find(order.begin(), order.end(), "A");
        auto pos_b = std::find(order.begin(), order.end(), "B");
        REQUIRE(pos_b < pos_a);
    }

    SECTION("Three nodes - linear chain") {
        // C depends on B depends on A
        graph.add_edge("C", "B");
        graph.add_edge("B", "A");
        auto order = graph.topological_sort();

        REQUIRE(order.size() == 3);

        // A must come before B, B must come before C
        auto pos_a = std::find(order.begin(), order.end(), "A");
        auto pos_b = std::find(order.begin(), order.end(), "B");
        auto pos_c = std::find(order.begin(), order.end(), "C");

        REQUIRE(pos_a < pos_b);
        REQUIRE(pos_b < pos_c);
    }
}

TEST_CASE("DependencyGraph - Complex topological sort", "[dependency][topsort]") {
    DependencyGraph graph;

    SECTION("Diamond dependency") {
        // D depends on B and C
        // B and C both depend on A
        //     A
        //    / \
        //   B   C
        //    \ /
        //     D
        graph.add_edge("B", "A");
        graph.add_edge("C", "A");
        graph.add_edge("D", "B");
        graph.add_edge("D", "C");

        auto order = graph.topological_sort();
        REQUIRE(order.size() == 4);

        // A must come first
        REQUIRE(order[0] == "A");

        // D must come last
        REQUIRE(order[3] == "D");

        // B and C must come after A and before D
        auto pos_b = std::find(order.begin(), order.end(), "B");
        auto pos_c = std::find(order.begin(), order.end(), "C");
        REQUIRE(pos_b != order.end());
        REQUIRE(pos_c != order.end());
    }

    SECTION("Multiple roots") {
        // A and B are independent roots
        // C depends on both A and B
        graph.add_edge("C", "A");
        graph.add_edge("C", "B");

        auto order = graph.topological_sort();
        REQUIRE(order.size() == 3);

        // C must come last
        REQUIRE(order[2] == "C");

        // A and B must come before C
        auto pos_a = std::find(order.begin(), order.end(), "A");
        auto pos_b = std::find(order.begin(), order.end(), "B");
        auto pos_c = std::find(order.begin(), order.end(), "C");

        REQUIRE(pos_a < pos_c);
        REQUIRE(pos_b < pos_c);
    }

    SECTION("Multiple leaves") {
        // A depends on nothing
        // B and C both depend on A
        graph.add_edge("B", "A");
        graph.add_edge("C", "A");

        auto order = graph.topological_sort();
        REQUIRE(order.size() == 3);

        // A must come first
        REQUIRE(order[0] == "A");

        // B and C can be in any order after A
        auto pos_b = std::find(order.begin(), order.end(), "B");
        auto pos_c = std::find(order.begin(), order.end(), "C");
        REQUIRE(pos_b != order.end());
        REQUIRE(pos_c != order.end());
    }
}

TEST_CASE("DependencyGraph - Real-world P&L example", "[dependency][realworld]") {
    DependencyGraph graph;

    // Build realistic P&L dependencies
    // GROSS_PROFIT = REVENUE - COGS
    graph.add_edge("GROSS_PROFIT", "REVENUE");
    graph.add_edge("GROSS_PROFIT", "COGS");

    // EBITDA = GROSS_PROFIT - OPEX
    graph.add_edge("EBITDA", "GROSS_PROFIT");
    graph.add_edge("EBITDA", "OPEX");

    // EBIT = EBITDA - DEPRECIATION
    graph.add_edge("EBIT", "EBITDA");
    graph.add_edge("EBIT", "DEPRECIATION");

    // EBT = EBIT - INTEREST
    graph.add_edge("EBT", "EBIT");
    graph.add_edge("EBT", "INTEREST");

    // TAX = EBT * TAX_RATE
    graph.add_edge("TAX", "EBT");
    graph.add_edge("TAX", "TAX_RATE");

    // NET_INCOME = EBT - TAX
    graph.add_edge("NET_INCOME", "EBT");
    graph.add_edge("NET_INCOME", "TAX");

    auto order = graph.topological_sort();
    REQUIRE(order.size() == 12);

    // Find positions
    auto find_pos = [&](const std::string& node) {
        return std::find(order.begin(), order.end(), node) - order.begin();
    };

    // Base values come first
    REQUIRE(find_pos("REVENUE") < find_pos("GROSS_PROFIT"));
    REQUIRE(find_pos("COGS") < find_pos("GROSS_PROFIT"));

    // GROSS_PROFIT before EBITDA
    REQUIRE(find_pos("GROSS_PROFIT") < find_pos("EBITDA"));

    // EBITDA before EBIT
    REQUIRE(find_pos("EBITDA") < find_pos("EBIT"));

    // EBIT before EBT
    REQUIRE(find_pos("EBIT") < find_pos("EBT"));

    // EBT before TAX and NET_INCOME
    REQUIRE(find_pos("EBT") < find_pos("TAX"));
    REQUIRE(find_pos("EBT") < find_pos("NET_INCOME"));

    // TAX before NET_INCOME
    REQUIRE(find_pos("TAX") < find_pos("NET_INCOME"));

    // NET_INCOME comes last
    REQUIRE(find_pos("NET_INCOME") == order.size() - 1);
}

// ============================================================================
// Cycle Detection Tests
// ============================================================================

TEST_CASE("DependencyGraph - Cycle detection", "[dependency][cycles]") {
    DependencyGraph graph;

    SECTION("No cycle - empty graph") {
        REQUIRE(!graph.has_cycles());
        REQUIRE(graph.find_cycle().empty());
    }

    SECTION("No cycle - single node") {
        graph.add_node("A");
        REQUIRE(!graph.has_cycles());
        REQUIRE(graph.find_cycle().empty());
    }

    SECTION("No cycle - linear chain") {
        graph.add_edge("C", "B");
        graph.add_edge("B", "A");
        REQUIRE(!graph.has_cycles());
        REQUIRE(graph.find_cycle().empty());
    }

    SECTION("No cycle - diamond") {
        graph.add_edge("D", "B");
        graph.add_edge("D", "C");
        graph.add_edge("B", "A");
        graph.add_edge("C", "A");
        REQUIRE(!graph.has_cycles());
    }

    SECTION("Simple cycle - two nodes") {
        graph.add_edge("A", "B");
        graph.add_edge("B", "A");  // Creates cycle!

        REQUIRE(graph.has_cycles());
        auto cycle = graph.find_cycle();
        REQUIRE(!cycle.empty());
    }

    SECTION("Simple cycle - three nodes") {
        graph.add_edge("A", "B");
        graph.add_edge("B", "C");
        graph.add_edge("C", "A");  // Creates cycle!

        REQUIRE(graph.has_cycles());
        auto cycle = graph.find_cycle();
        REQUIRE(!cycle.empty());

        // Cycle should start and end with same node
        REQUIRE(cycle.front() == cycle.back());
    }

    SECTION("Self-loop") {
        graph.add_edge("A", "A");  // A depends on itself!

        REQUIRE(graph.has_cycles());
        auto cycle = graph.find_cycle();
        REQUIRE(!cycle.empty());
    }

    SECTION("Cycle in complex graph") {
        // Valid chain
        graph.add_edge("D", "C");
        graph.add_edge("C", "B");
        graph.add_edge("B", "A");

        // Add cycle: A -> D (closes loop)
        graph.add_edge("A", "D");

        REQUIRE(graph.has_cycles());
        auto cycle = graph.find_cycle();
        REQUIRE(!cycle.empty());
    }

    SECTION("Cycle in subgraph") {
        // No cycle path: F -> E
        graph.add_edge("F", "E");

        // Cycle in subgraph: A -> B -> C -> A
        graph.add_edge("A", "B");
        graph.add_edge("B", "C");
        graph.add_edge("C", "A");

        REQUIRE(graph.has_cycles());
    }
}

TEST_CASE("DependencyGraph - Topological sort with cycles", "[dependency][cycles]") {
    DependencyGraph graph;

    SECTION("Two-node cycle throws") {
        graph.add_edge("A", "B");
        graph.add_edge("B", "A");

        REQUIRE_THROWS_AS(graph.topological_sort(), std::runtime_error);
    }

    SECTION("Three-node cycle throws") {
        graph.add_edge("A", "B");
        graph.add_edge("B", "C");
        graph.add_edge("C", "A");

        REQUIRE_THROWS_AS(graph.topological_sort(), std::runtime_error);
    }

    SECTION("Self-loop throws") {
        graph.add_edge("A", "A");

        REQUIRE_THROWS_AS(graph.topological_sort(), std::runtime_error);
    }

    SECTION("Error message contains cycle info") {
        graph.add_edge("REVENUE", "COGS");
        graph.add_edge("COGS", "GROSS_PROFIT");
        graph.add_edge("GROSS_PROFIT", "REVENUE");  // Circular!

        try {
            graph.topological_sort();
            FAIL("Expected exception");
        } catch (const std::runtime_error& e) {
            std::string msg = e.what();
            REQUIRE(msg.find("Circular dependency") != std::string::npos);
        }
    }
}

// ============================================================================
// Balance Sheet Examples (with time references)
// ============================================================================

TEST_CASE("DependencyGraph - Balance sheet dependencies", "[dependency][realworld]") {
    DependencyGraph graph;

    SECTION("Cash flow statement") {
        // Within a single period, only formulas with same-period deps matter

        // CF_FROM_OPS depends on same-period values
        graph.add_edge("CF_FROM_OPS", "NET_INCOME");
        graph.add_edge("CF_FROM_OPS", "DEPRECIATION");
        graph.add_edge("CF_FROM_OPS", "CHANGE_WC");

        // CHANGE_WC depends on working capital items
        graph.add_edge("CHANGE_WC", "AR");
        graph.add_edge("CHANGE_WC", "INVENTORY");
        graph.add_edge("CHANGE_WC", "AP");

        // NET_CF = CF_FROM_OPS + CF_FROM_INV + CF_FROM_FIN
        graph.add_edge("NET_CF", "CF_FROM_OPS");
        graph.add_edge("NET_CF", "CF_FROM_INV");
        graph.add_edge("NET_CF", "CF_FROM_FIN");

        auto order = graph.topological_sort();

        auto find_pos = [&](const std::string& node) {
            return std::find(order.begin(), order.end(), node) - order.begin();
        };

        // NET_INCOME comes before CF_FROM_OPS
        REQUIRE(find_pos("NET_INCOME") < find_pos("CF_FROM_OPS"));

        // Working capital items before CHANGE_WC
        REQUIRE(find_pos("AR") < find_pos("CHANGE_WC"));
        REQUIRE(find_pos("INVENTORY") < find_pos("CHANGE_WC"));
        REQUIRE(find_pos("AP") < find_pos("CHANGE_WC"));

        // CHANGE_WC before CF_FROM_OPS
        REQUIRE(find_pos("CHANGE_WC") < find_pos("CF_FROM_OPS"));

        // CF_FROM_OPS before NET_CF
        REQUIRE(find_pos("CF_FROM_OPS") < find_pos("NET_CF"));

        // NET_CF is last
        REQUIRE(order.back() == "NET_CF");
    }
}

// ============================================================================
// Edge Cases
// ============================================================================

TEST_CASE("DependencyGraph - Edge cases", "[dependency][edge]") {
    DependencyGraph graph;

    SECTION("Many independent nodes") {
        for (int i = 0; i < 100; ++i) {
            graph.add_node("NODE_" + std::to_string(i));
        }

        REQUIRE(graph.size() == 100);
        REQUIRE(!graph.has_cycles());

        auto order = graph.topological_sort();
        REQUIRE(order.size() == 100);
    }

    SECTION("Long linear chain") {
        // Create chain: N0 -> N1 -> N2 -> ... -> N99
        for (int i = 1; i < 100; ++i) {
            graph.add_edge("NODE_" + std::to_string(i),
                          "NODE_" + std::to_string(i - 1));
        }

        REQUIRE(graph.size() == 100);
        REQUIRE(!graph.has_cycles());

        auto order = graph.topological_sort();
        REQUIRE(order.size() == 100);

        // NODE_0 must be first, NODE_99 must be last
        REQUIRE(order.front() == "NODE_0");
        REQUIRE(order.back() == "NODE_99");
    }

    SECTION("Fully connected DAG") {
        // Each node depends on all nodes with smaller index
        for (int i = 0; i < 10; ++i) {
            for (int j = 0; j < i; ++j) {
                graph.add_edge("NODE_" + std::to_string(i),
                              "NODE_" + std::to_string(j));
            }
        }

        REQUIRE(!graph.has_cycles());
        auto order = graph.topological_sort();
        REQUIRE(order.size() == 10);

        // Order should be NODE_0, NODE_1, ..., NODE_9
        for (size_t i = 0; i < order.size(); ++i) {
            REQUIRE(order[i] == "NODE_" + std::to_string(i));
        }
    }

    SECTION("Duplicate edges ignored") {
        graph.add_edge("A", "B");
        graph.add_edge("A", "B");  // Duplicate
        graph.add_edge("A", "B");  // Duplicate

        auto deps = graph.get_dependencies("A");
        REQUIRE(deps.size() == 1);
        REQUIRE(deps[0] == "B");
    }
}

// ============================================================================
// Real-World Circular Dependency Examples
// ============================================================================

TEST_CASE("DependencyGraph - Real-world circular dependency detection", "[dependency][errors]") {
    DependencyGraph graph;

    SECTION("Circular balance sheet items") {
        // ASSETS = LIABILITIES + EQUITY (always balanced)
        // But if we have:
        // EQUITY = ASSETS - LIABILITIES
        // ASSETS = CASH + AR + INVENTORY
        // CASH = some formula depending on EQUITY
        // This creates a cycle!

        graph.add_edge("EQUITY", "ASSETS");
        graph.add_edge("EQUITY", "LIABILITIES");
        graph.add_edge("ASSETS", "CASH");
        graph.add_edge("CASH", "EQUITY");  // Circular!

        REQUIRE(graph.has_cycles());
        REQUIRE_THROWS_AS(graph.topological_sort(), std::runtime_error);
    }

    SECTION("Circular revenue-cost relationship") {
        // REVENUE = VOLUME * PRICE
        // COGS = REVENUE * COGS_PCT
        // VOLUME = BASE_VOLUME * (1 + GROWTH)
        // GROWTH = f(COGS)  ← Circular!

        graph.add_edge("REVENUE", "VOLUME");
        graph.add_edge("REVENUE", "PRICE");
        graph.add_edge("COGS", "REVENUE");
        graph.add_edge("COGS", "COGS_PCT");
        graph.add_edge("VOLUME", "BASE_VOLUME");
        graph.add_edge("VOLUME", "GROWTH");
        graph.add_edge("GROWTH", "COGS");  // Circular!

        REQUIRE(graph.has_cycles());
    }

    SECTION("Mutual dependencies") {
        // Variable A depends on B
        // Variable B depends on A
        // Classic mutual dependency

        graph.add_edge("A", "B");
        graph.add_edge("B", "A");

        REQUIRE(graph.has_cycles());

        auto cycle = graph.find_cycle();
        REQUIRE(!cycle.empty());

        // Should contain both A and B
        REQUIRE(std::find(cycle.begin(), cycle.end(), "A") != cycle.end());
        REQUIRE(std::find(cycle.begin(), cycle.end(), "B") != cycle.end());
    }
}
