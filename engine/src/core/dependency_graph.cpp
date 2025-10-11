/**
 * @file dependency_graph.cpp
 * @brief Dependency graph implementation
 */

#include "core/dependency_graph.h"
#include <stdexcept>
#include <algorithm>
#include <queue>
#include <sstream>

namespace finmodel {
namespace core {

// ============================================================================
// Public Interface
// ============================================================================

void DependencyGraph::add_node(const std::string& code) {
    nodes_.insert(code);
    // Initialize adjacency list entry if not exists
    if (adjacency_.find(code) == adjacency_.end()) {
        adjacency_[code] = std::set<std::string>();
    }
}

void DependencyGraph::add_edge(const std::string& from, const std::string& to) {
    // Add both nodes to ensure they exist
    add_node(from);
    add_node(to);

    // Add edge: from depends on to
    adjacency_[from].insert(to);
}

std::vector<std::string> DependencyGraph::get_dependencies(const std::string& code) const {
    auto it = adjacency_.find(code);
    if (it == adjacency_.end()) {
        return {};
    }

    return std::vector<std::string>(it->second.begin(), it->second.end());
}

std::vector<std::string> DependencyGraph::get_all_nodes() const {
    return std::vector<std::string>(nodes_.begin(), nodes_.end());
}

std::vector<std::string> DependencyGraph::topological_sort() const {
    // Check for cycles first
    if (has_cycles()) {
        auto cycle = find_cycle();
        std::ostringstream oss;
        oss << "Circular dependency detected: ";
        for (size_t i = 0; i < cycle.size(); ++i) {
            if (i > 0) oss << " → ";
            oss << cycle[i];
        }
        throw std::runtime_error(oss.str());
    }

    // Kahn's algorithm for topological sort
    std::vector<std::string> result;
    std::map<std::string, int> in_degree;

    // Initialize in-degree for all nodes
    for (const auto& node : nodes_) {
        in_degree[node] = 0;
    }

    // Calculate in-degree (number of dependencies each node has)
    // adjacency_[from] = {to1, to2} means "from depends on to1, to2"
    // So from's in-degree = size of its dependency set
    for (const auto& [node, dependencies] : adjacency_) {
        in_degree[node] = dependencies.size();
    }

    // Queue of nodes with no dependencies (in-degree = 0)
    std::queue<std::string> ready;
    for (const auto& [node, degree] : in_degree) {
        if (degree == 0) {
            ready.push(node);
        }
    }

    // Process nodes in dependency order
    while (!ready.empty()) {
        std::string node = ready.front();
        ready.pop();
        result.push_back(node);

        // For each node that depends on the current node,
        // decrease its in-degree (one dependency satisfied)
        for (const auto& [other_node, dependencies] : adjacency_) {
            // If other_node depends on current node
            if (dependencies.find(node) != dependencies.end()) {
                in_degree[other_node]--;

                // If all dependencies satisfied, add to ready queue
                if (in_degree[other_node] == 0) {
                    ready.push(other_node);
                }
            }
        }
    }

    // If we processed all nodes, we have valid topological order
    if (result.size() != nodes_.size()) {
        throw std::runtime_error("Failed to compute topological sort (internal error)");
    }

    return result;
}

bool DependencyGraph::has_cycles() const {
    std::set<std::string> visiting;  // Nodes in current DFS path (gray)
    std::set<std::string> visited;   // Fully processed nodes (black)
    std::vector<std::string> path;   // Current path (for cycle detection)

    // Try DFS from each unvisited node
    for (const auto& node : nodes_) {
        if (visited.find(node) == visited.end()) {
            if (dfs_has_cycle(node, visiting, visited, path)) {
                return true;
            }
        }
    }

    return false;
}

std::vector<std::string> DependencyGraph::find_cycle() const {
    std::set<std::string> visiting;
    std::set<std::string> visited;
    std::vector<std::string> path;

    // Try DFS from each unvisited node
    for (const auto& node : nodes_) {
        if (visited.find(node) == visited.end()) {
            path.clear();
            if (dfs_has_cycle(node, visiting, visited, path)) {
                // path now contains the cycle
                return path;
            }
        }
    }

    return {};  // No cycle found
}

void DependencyGraph::clear() {
    nodes_.clear();
    adjacency_.clear();
}

// ============================================================================
// Private Methods
// ============================================================================

bool DependencyGraph::dfs_has_cycle(
    const std::string& node,
    std::set<std::string>& visiting,
    std::set<std::string>& visited,
    std::vector<std::string>& path
) const {
    // If already fully processed, no cycle through this node
    if (visited.find(node) != visited.end()) {
        return false;
    }

    // If we're currently visiting this node, we found a cycle!
    if (visiting.find(node) != visiting.end()) {
        // Add node again to show cycle completion
        path.push_back(node);
        return true;
    }

    // Mark as currently visiting (gray)
    visiting.insert(node);
    path.push_back(node);

    // Visit all dependencies
    auto it = adjacency_.find(node);
    if (it != adjacency_.end()) {
        for (const auto& dependency : it->second) {
            if (dfs_has_cycle(dependency, visiting, visited, path)) {
                return true;
            }
        }
    }

    // Done visiting this node - mark as visited (black)
    visiting.erase(node);
    visited.insert(node);
    path.pop_back();

    return false;
}

} // namespace core
} // namespace finmodel
