/**
 * @file entity_hierarchy_manager.cpp
 * @brief Implementation of entity hierarchy management
 */

#include "core/entity_hierarchy_manager.h"
#include "database/idatabase.h"
#include "database/result_set.h"
#include <stdexcept>
#include <algorithm>
#include <sstream>
#include <queue>
#include <functional>

namespace finmodel {
namespace core {

std::unique_ptr<EntityHierarchyManager> EntityHierarchyManager::load_from_database(
    finmodel::database::IDatabase* db
) {
    if (!db) {
        throw std::runtime_error("EntityHierarchyManager: null database pointer");
    }

    // Query all entities with their parent relationships
    auto result = db->execute_query(
        "SELECT entity_id, code, name, granularity_level, parent_entity_id "
        "FROM entity "
        "WHERE is_active = 1 "
        "ORDER BY entity_id",
        {}
    );

    std::vector<EntityNode> entities;
    while (result->next()) {
        EntityNode node;
        node.entity_id = std::to_string(result->get_int("entity_id"));
        node.code = result->get_string("code");
        node.name = result->get_string("name");
        node.granularity_level = result->is_null("granularity_level") ? "" : result->get_string("granularity_level");

        // Handle null parent_entity_id (root nodes)
        if (result->is_null("parent_entity_id")) {
            node.parent_entity_id = "";
        } else {
            node.parent_entity_id = std::to_string(result->get_int("parent_entity_id"));
        }

        node.depth = 0;  // Will be calculated in build_hierarchy
        entities.push_back(node);
    }

    if (entities.empty()) {
        throw std::runtime_error("EntityHierarchyManager: No active entities found in database");
    }

    // Build hierarchy
    std::unique_ptr<EntityHierarchyManager> manager(new EntityHierarchyManager());
    manager->build_hierarchy(entities);
    manager->validate_no_cycles();

    return manager;
}

void EntityHierarchyManager::build_hierarchy(const std::vector<EntityNode>& entities) {
    // First pass: store all entities and build parent/children maps
    for (const auto& entity : entities) {
        entities_[entity.entity_id] = entity;

        if (!entity.parent_entity_id.empty()) {
            parent_map_[entity.entity_id] = entity.parent_entity_id;
            children_map_[entity.parent_entity_id].push_back(entity.entity_id);
        }
    }

    // Second pass: calculate depth for each entity using BFS from roots
    std::queue<std::pair<std::string, int>> queue;  // (entity_id, depth)

    // Find all root nodes (no parent)
    for (const auto& [entity_id, entity] : entities_) {
        if (entity.parent_entity_id.empty()) {
            queue.push({entity_id, 0});
            entities_[entity_id].depth = 0;
        }
    }

    // BFS to assign depths
    while (!queue.empty()) {
        auto [current_id, depth] = queue.front();
        queue.pop();

        // Update max depth
        max_depth_ = std::max(max_depth_, depth);

        // Add to depth index
        by_depth_[depth].push_back(current_id);

        // Store children for current entity
        if (children_map_.find(current_id) != children_map_.end()) {
            entities_[current_id].children = children_map_[current_id];
        }

        // Enqueue children
        if (children_map_.find(current_id) != children_map_.end()) {
            for (const auto& child_id : children_map_[current_id]) {
                entities_[child_id].depth = depth + 1;
                queue.push({child_id, depth + 1});
            }
        }
    }

    // Verify all entities were assigned a depth
    for (const auto& [entity_id, entity] : entities_) {
        if (entity.depth == 0 && !entity.parent_entity_id.empty()) {
            // Non-root entity with depth 0 indicates disconnected node
            throw std::runtime_error("EntityHierarchyManager: Entity '" + entity_id +
                                   "' is disconnected from hierarchy (parent '" +
                                   entity.parent_entity_id + "' not found)");
        }
    }
}

void EntityHierarchyManager::validate_no_cycles() {
    // Use DFS to detect cycles
    std::set<std::string> visited;
    std::set<std::string> rec_stack;  // Recursion stack for cycle detection

    std::function<bool(const std::string&)> has_cycle = [&](const std::string& entity_id) -> bool {
        visited.insert(entity_id);
        rec_stack.insert(entity_id);

        // Visit all children
        if (children_map_.find(entity_id) != children_map_.end()) {
            for (const auto& child_id : children_map_[entity_id]) {
                if (rec_stack.find(child_id) != rec_stack.end()) {
                    // Found cycle
                    return true;
                }
                if (visited.find(child_id) == visited.end()) {
                    if (has_cycle(child_id)) {
                        return true;
                    }
                }
            }
        }

        rec_stack.erase(entity_id);
        return false;
    };

    // Check from all root nodes
    for (const auto& [entity_id, entity] : entities_) {
        if (entity.parent_entity_id.empty()) {
            if (has_cycle(entity_id)) {
                throw std::runtime_error("EntityHierarchyManager: Circular reference detected in entity hierarchy");
            }
        }
    }
}

std::vector<std::vector<std::string>> EntityHierarchyManager::get_levels() const {
    std::vector<std::vector<std::string>> levels;

    // Return levels from deepest to shallowest (reverse order)
    for (int depth = max_depth_; depth >= 0; --depth) {
        auto it = by_depth_.find(depth);
        if (it != by_depth_.end()) {
            levels.push_back(it->second);
        }
    }

    return levels;
}

std::vector<std::string> EntityHierarchyManager::get_entities_at_depth(int depth) const {
    auto it = by_depth_.find(depth);
    if (it != by_depth_.end()) {
        return it->second;
    }
    return {};
}

std::string EntityHierarchyManager::get_parent(const std::string& entity_id) const {
    auto it = parent_map_.find(entity_id);
    if (it != parent_map_.end()) {
        return it->second;
    }
    return "";  // Root node or not found
}

std::vector<std::string> EntityHierarchyManager::get_children(const std::string& entity_id) const {
    auto it = children_map_.find(entity_id);
    if (it != children_map_.end()) {
        return it->second;
    }
    return {};  // Leaf node or not found
}

const EntityNode* EntityHierarchyManager::get_entity(const std::string& entity_id) const {
    auto it = entities_.find(entity_id);
    if (it != entities_.end()) {
        return &it->second;
    }
    return nullptr;
}

std::vector<std::string> EntityHierarchyManager::get_all_entities() const {
    std::vector<std::string> result;
    result.reserve(entities_.size());
    for (const auto& [entity_id, _] : entities_) {
        result.push_back(entity_id);
    }
    return result;
}

bool EntityHierarchyManager::is_leaf(const std::string& entity_id) const {
    return children_map_.find(entity_id) == children_map_.end() ||
           children_map_.at(entity_id).empty();
}

bool EntityHierarchyManager::is_root(const std::string& entity_id) const {
    return parent_map_.find(entity_id) == parent_map_.end();
}

} // namespace core
} // namespace finmodel
