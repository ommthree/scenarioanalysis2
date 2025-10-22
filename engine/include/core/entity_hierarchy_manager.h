/**
 * @file entity_hierarchy_manager.h
 * @brief Manages entity hierarchy for multi-level calculations with automatic rollup
 *
 * This class provides utilities for:
 * - Building entity hierarchy trees from database
 * - Identifying levels in the hierarchy (leaf nodes to root)
 * - Querying parent-child relationships
 * - Supporting bottom-up calculation with automatic aggregation
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <set>
#include <memory>
#include "types/common_types.h"

namespace finmodel {
namespace database {
    class IDatabase;
}
}

namespace finmodel {
namespace core {

/**
 * @brief Represents a node in the entity hierarchy
 */
struct EntityNode {
    std::string entity_id;              ///< Entity identifier
    std::string code;                   ///< Entity code
    std::string name;                   ///< Entity name
    std::string granularity_level;      ///< Level type (group, company, division, etc.)
    std::string parent_entity_id;       ///< Parent entity ID (empty if root)
    int depth;                          ///< Depth in hierarchy (0 = root)
    std::vector<std::string> children;  ///< Child entity IDs
};

/**
 * @brief Manages entity hierarchy for multi-level financial calculations
 *
 * This class loads the entity hierarchy from the database and provides
 * utilities for bottom-up calculation processing with automatic rollup.
 *
 * Example usage:
 * @code
 * auto hierarchy = EntityHierarchyManager::load_from_database(db);
 *
 * // Get entities grouped by level (deepest to shallowest)
 * auto levels = hierarchy->get_levels();
 *
 * // Process each level bottom-up
 * for (const auto& level : levels) {
 *     for (const auto& entity_id : level) {
 *         // Calculate at this entity level
 *         // If calculation fails, try rolling up from children
 *         auto children = hierarchy->get_children(entity_id);
 *         if (!children.empty()) {
 *             // Aggregate child values
 *         }
 *     }
 * }
 * @endcode
 */
class EntityHierarchyManager {
public:
    /**
     * @brief Load entity hierarchy from database
     * @param db Database connection
     * @return EntityHierarchyManager instance
     * @throws std::runtime_error on database errors or circular references
     */
    static std::unique_ptr<EntityHierarchyManager> load_from_database(
        finmodel::database::IDatabase* db
    );

    /**
     * @brief Get all entities grouped by hierarchy level
     * @return Vector of levels, where each level is a vector of entity_ids
     *         Ordered from deepest (leaf nodes) to shallowest (root)
     *
     * Example: [[leaf1, leaf2], [parent1, parent2], [root]]
     */
    std::vector<std::vector<std::string>> get_levels() const;

    /**
     * @brief Get all entity IDs at a specific depth level
     * @param depth Depth level (0 = root)
     * @return Vector of entity IDs at that depth
     */
    std::vector<std::string> get_entities_at_depth(int depth) const;

    /**
     * @brief Get parent entity ID
     * @param entity_id Entity to query
     * @return Parent entity ID, or empty string if root
     */
    std::string get_parent(const std::string& entity_id) const;

    /**
     * @brief Get child entity IDs
     * @param entity_id Parent entity to query
     * @return Vector of child entity IDs (empty if leaf node)
     */
    std::vector<std::string> get_children(const std::string& entity_id) const;

    /**
     * @brief Get entity node details
     * @param entity_id Entity to query
     * @return Pointer to EntityNode, or nullptr if not found
     */
    const EntityNode* get_entity(const std::string& entity_id) const;

    /**
     * @brief Get all entity IDs in the hierarchy
     * @return Vector of all entity IDs
     */
    std::vector<std::string> get_all_entities() const;

    /**
     * @brief Get maximum depth in hierarchy
     * @return Maximum depth (0 if only root exists)
     */
    int get_max_depth() const { return max_depth_; }

    /**
     * @brief Check if entity is a leaf node (no children)
     * @param entity_id Entity to check
     * @return true if leaf node
     */
    bool is_leaf(const std::string& entity_id) const;

    /**
     * @brief Check if entity is root (no parent)
     * @param entity_id Entity to check
     * @return true if root node
     */
    bool is_root(const std::string& entity_id) const;

private:
    // Private constructor - use static factory
    EntityHierarchyManager() = default;

    // Build hierarchy from database results
    void build_hierarchy(const std::vector<EntityNode>& entities);

    // Validate no circular references
    void validate_no_cycles();

    // Entity lookup maps
    std::map<std::string, EntityNode> entities_;           ///< entity_id -> node
    std::map<int, std::vector<std::string>> by_depth_;     ///< depth -> entity_ids
    std::map<std::string, std::string> parent_map_;        ///< child -> parent
    std::map<std::string, std::vector<std::string>> children_map_;  ///< parent -> children

    int max_depth_ = 0;  ///< Maximum depth in hierarchy
};

} // namespace core
} // namespace finmodel
