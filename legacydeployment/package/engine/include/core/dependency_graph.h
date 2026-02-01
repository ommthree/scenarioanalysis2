/**
 * @file dependency_graph.h
 * @brief Builds and analyzes dependency graphs for calculation ordering
 */

#pragma once
#include <string>
#include <vector>
#include <map>
#include <set>

namespace finmodel {
namespace core {

/**
 * @brief Represents a directed acyclic graph (DAG) of dependencies
 *
 * The dependency graph tracks which line items depend on which other line items.
 * This is used to:
 * 1. Determine calculation order (topological sort)
 * 2. Detect circular dependencies
 * 3. Validate formula dependencies
 *
 * Example:
 * @code
 * DependencyGraph graph;
 *
 * // Add nodes
 * graph.add_node("REVENUE");
 * graph.add_node("COGS");
 * graph.add_node("GROSS_PROFIT");
 *
 * // Add dependencies (from depends on to)
 * graph.add_edge("GROSS_PROFIT", "REVENUE");  // GP depends on REVENUE
 * graph.add_edge("GROSS_PROFIT", "COGS");     // GP depends on COGS
 *
 * // Get calculation order
 * auto order = graph.topological_sort();
 * // Result: ["REVENUE", "COGS", "GROSS_PROFIT"]
 * @endcode
 *
 * Circular Dependency Detection:
 * @code
 * graph.add_edge("A", "B");
 * graph.add_edge("B", "C");
 * graph.add_edge("C", "A");  // Creates cycle!
 *
 * auto cycle = graph.find_cycle();
 * // Result: ["A", "B", "C", "A"]
 *
 * graph.topological_sort();  // Throws with cycle description
 * @endcode
 */
class DependencyGraph {
public:
    /**
     * @brief Constructor
     */
    DependencyGraph() = default;

    /**
     * @brief Add a node to the graph
     * @param code Node identifier (line item code)
     */
    void add_node(const std::string& code);

    /**
     * @brief Add a dependency edge
     * @param from The dependent node (e.g., "GROSS_PROFIT")
     * @param to The dependency (e.g., "REVENUE")
     *
     * Interpretation: "from depends on to" or "to must be calculated before from"
     */
    void add_edge(const std::string& from, const std::string& to);

    /**
     * @brief Get all direct dependencies of a node
     * @param code Node identifier
     * @return Vector of codes that this node depends on
     */
    std::vector<std::string> get_dependencies(const std::string& code) const;

    /**
     * @brief Get all nodes in the graph
     * @return Vector of all node codes
     */
    std::vector<std::string> get_all_nodes() const;

    /**
     * @brief Compute topological sort (calculation order)
     * @return Ordered list of codes (dependencies first)
     * @throws std::runtime_error if circular dependency detected
     *
     * Uses Kahn's algorithm:
     * 1. Find all nodes with no dependencies
     * 2. Remove them and add to result
     * 3. Remove their edges and repeat
     * 4. If we can't remove all nodes, there's a cycle
     *
     * Example: Given dependencies:
     *   GROSS_PROFIT → [REVENUE, COGS]
     *   NET_INCOME → [GROSS_PROFIT, TAX]
     *
     * Result: [REVENUE, COGS, TAX, GROSS_PROFIT, NET_INCOME]
     * (or any valid ordering where dependencies come first)
     */
    std::vector<std::string> topological_sort() const;

    /**
     * @brief Check for circular dependencies
     * @return true if graph has cycles
     */
    bool has_cycles() const;

    /**
     * @brief Find a cycle in the graph
     * @return Vector representing the cycle path, or empty if no cycle
     *
     * Example: If A→B→C→A, returns ["A", "B", "C", "A"]
     */
    std::vector<std::string> find_cycle() const;

    /**
     * @brief Clear all nodes and edges
     */
    void clear();

    /**
     * @brief Get number of nodes in graph
     */
    size_t size() const { return nodes_.size(); }

    /**
     * @brief Check if graph is empty
     */
    bool empty() const { return nodes_.empty(); }

private:
    /**
     * @brief Helper for cycle detection using DFS
     * @param node Current node being visited
     * @param visiting Nodes currently in the DFS path (gray nodes)
     * @param visited Nodes completely processed (black nodes)
     * @param path Current DFS path
     * @return true if cycle found
     */
    bool dfs_has_cycle(
        const std::string& node,
        std::set<std::string>& visiting,
        std::set<std::string>& visited,
        std::vector<std::string>& path
    ) const;

    // Adjacency list: node → set of nodes it depends on
    std::map<std::string, std::set<std::string>> adjacency_;

    // All nodes in graph (for nodes with no dependencies)
    std::set<std::string> nodes_;
};

} // namespace core
} // namespace finmodel
