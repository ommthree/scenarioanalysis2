#!/bin/bash

# Insert Level 1 test data into the database

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Inserting Level 1 test data into $DB_PATH..."

sqlite3 "$DB_PATH" <<SQL
-- Clean up any existing Level 1 test data
DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L1' AND scenario_id = 1;

-- Insert 5 periods of test data
-- Period 1
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 1, 'REVENUE', 100000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 1, 'EXPENSES', -60000);

-- Period 2
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 2, 'REVENUE', 110000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 2, 'EXPENSES', -65000);

-- Period 3
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 3, 'REVENUE', 120000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 3, 'EXPENSES', -70000);

-- Period 4
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 4, 'REVENUE', 130000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 4, 'EXPENSES', -75000);

-- Period 5
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 5, 'REVENUE', 140000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L1', 1, 5, 'EXPENSES', -80000);

-- Verify data was inserted
SELECT COUNT(*) as row_count FROM scenario_drivers WHERE entity_id = 'TEST_L1' AND scenario_id = 1;
SQL

echo "Level 1 test data inserted successfully!"
echo ""
echo "To run the test:"
echo "  ./build/bin/run_tests \"[level1]\""
