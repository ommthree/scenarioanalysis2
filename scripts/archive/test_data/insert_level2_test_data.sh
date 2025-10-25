#!/bin/bash

# Insert Level 2 test data into the database

DB_PATH="${1:-data/database/finmodel.db}"

echo "Inserting Level 2 test data into $DB_PATH..."

sqlite3 "$DB_PATH" <<SQL
-- Clean up any existing Level 2 test data
DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L2' AND scenario_id = 1;

-- Insert 5 periods of test data
-- Period 1: NI = 40,000
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 1, 'REVENUE', 100000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 1, 'EXPENSES', -60000);

-- Period 2: NI = 45,000
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 2, 'REVENUE', 110000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 2, 'EXPENSES', -65000);

-- Period 3: NI = 50,000
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 3, 'REVENUE', 120000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 3, 'EXPENSES', -70000);

-- Period 4: NI = 55,000
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 4, 'REVENUE', 130000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 4, 'EXPENSES', -75000);

-- Period 5: NI = 60,000
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 5, 'REVENUE', 140000);
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('TEST_L2', 1, 5, 'EXPENSES', -80000);

-- Verify data was inserted
SELECT COUNT(*) as row_count FROM scenario_drivers WHERE entity_id = 'TEST_L2' AND scenario_id = 1;
SQL

echo "✓ Level 2 test data inserted successfully!"
echo ""
echo "Test details:"
echo "  - Entity: TEST_L2"
echo "  - Scenario: 1"
echo "  - Periods: 5"
echo "  - Key formula: RETAINED_EARNINGS = RE[t-1] + NET_INCOME"
echo "  - Opening BS: CASH=1M, RE=1M"
echo ""
echo "To run the test from project root:"
echo "  ./build/bin/run_tests \"[level2]\""
