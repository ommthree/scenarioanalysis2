/**
 * What-If Analysis Service
 *
 * Generates all possible action on/off combinations (2^n where n = number of actions)
 */

class WhatIfService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate all what-if combinations for all actions
   *
   * @returns {Promise<Array>} Array of combination objects with action_codes and labels
   */
  async generateCombinations() {
    // Get all actions
    const actions = await new Promise((resolve, reject) => {
      this.db.all(
        `SELECT action_code, action_name FROM management_action ORDER BY action_code`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (actions.length === 0) {
      // No actions = only base case
      return [{
        combination: 'BASE',
        action_codes: [],
        label: 'Base'
      }];
    }

    // Generate all 2^n combinations
    const numActions = actions.length;
    const numCombinations = Math.pow(2, numActions);
    const combinations = [];

    for (let i = 0; i < numCombinations; i++) {
      const activeActions = [];

      // Check each bit to determine which actions are "on"
      for (let j = 0; j < numActions; j++) {
        if (i & (1 << j)) {
          activeActions.push(actions[j].action_code);
        }
      }

      // Generate label
      let label;
      let combination;
      if (activeActions.length === 0) {
        label = 'Base';
        combination = 'BASE';
      } else {
        label = activeActions.join('+');
        combination = activeActions.join('+');
      }

      combinations.push({
        combination,
        action_codes: activeActions,
        label,
        index: i
      });
    }

    return combinations;
  }
}

export default WhatIfService;
