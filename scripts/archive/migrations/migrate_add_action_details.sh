#!/bin/bash

# Migration script to add action_transformation and action_trigger tables
# and migrate data from scenario_action JSON fields

DB_PATH="../data/database/finmodel.db"

echo "Creating action_transformation and action_trigger tables..."

sqlite3 "$DB_PATH" <<'EOF'
-- Create action_transformation table
CREATE TABLE IF NOT EXISTS action_transformation (
    transformation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_code TEXT NOT NULL,
    line_item TEXT NOT NULL,
    type TEXT NOT NULL,
    new_formula TEXT,
    comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_code) REFERENCES management_action(action_code)
);

CREATE INDEX IF NOT EXISTS idx_action_transformation_action
    ON action_transformation(action_code);

-- Create action_trigger table
CREATE TABLE IF NOT EXISTS action_trigger (
    trigger_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_code TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'UNCONDITIONAL',
    condition_formula TEXT,
    start_period INTEGER,
    end_period INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_code) REFERENCES management_action(action_code),
    CHECK (trigger_type IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED'))
);

CREATE INDEX IF NOT EXISTS idx_action_trigger_action
    ON action_trigger(action_code);

EOF

echo "Tables created successfully!"
echo ""
echo "Migrating data from scenario_action to action definitions..."
echo "This will take the first occurrence of each action's transformations and triggers."
echo ""

# Use Python to parse JSON and migrate data
python3 << 'PYTHON_EOF'
import sqlite3
import json

db_path = "../data/database/finmodel.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all unique actions with their first occurrence of transformations/triggers
cursor.execute("""
    SELECT
        action_code,
        financial_transformations,
        carbon_transformations,
        trigger_type,
        trigger_condition,
        start_period,
        end_period
    FROM scenario_action
    WHERE action_code IN (
        SELECT action_code
        FROM scenario_action
        WHERE financial_transformations IS NOT NULL
           OR carbon_transformations IS NOT NULL
           OR trigger_type != 'UNCONDITIONAL'
        GROUP BY action_code
    )
    GROUP BY action_code
""")

actions_data = cursor.fetchall()

print(f"Found {len(actions_data)} actions with transformations or triggers")
print()

for row in actions_data:
    action_code, fin_trans_json, carb_trans_json, trigger_type, trigger_condition, start_period, end_period = row

    print(f"Migrating {action_code}...")

    # Migrate financial transformations
    if fin_trans_json:
        try:
            fin_trans = json.loads(fin_trans_json)
            for trans in fin_trans:
                cursor.execute("""
                    INSERT INTO action_transformation
                    (action_code, line_item, type, new_formula, comment)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    action_code,
                    trans.get('line_item', ''),
                    trans.get('type', 'formula_override'),
                    trans.get('new_formula', ''),
                    trans.get('comment', '')
                ))
                print(f"  - Added financial transformation for {trans.get('line_item')}")
        except json.JSONDecodeError as e:
            print(f"  ! Error parsing financial transformations: {e}")

    # Migrate carbon transformations
    if carb_trans_json:
        try:
            carb_trans = json.loads(carb_trans_json)
            for trans in carb_trans:
                cursor.execute("""
                    INSERT INTO action_transformation
                    (action_code, line_item, type, new_formula, comment)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    action_code,
                    trans.get('line_item', ''),
                    'carbon_formula_override',
                    trans.get('new_formula', ''),
                    trans.get('comment', '')
                ))
                print(f"  - Added carbon transformation for {trans.get('line_item')}")
        except json.JSONDecodeError as e:
            print(f"  ! Error parsing carbon transformations: {e}")

    # Migrate trigger
    if trigger_type and trigger_type != 'UNCONDITIONAL':
        cursor.execute("""
            INSERT INTO action_trigger
            (action_code, trigger_type, condition_formula, start_period, end_period)
            VALUES (?, ?, ?, ?, ?)
        """, (
            action_code,
            trigger_type,
            trigger_condition,
            start_period,
            end_period
        ))
        print(f"  - Added {trigger_type} trigger")

    print()

conn.commit()
conn.close()

print("Migration completed successfully!")

PYTHON_EOF

echo ""
echo "Migration complete!"
echo "You can now view and edit transformations and triggers in the DefineActions page."
