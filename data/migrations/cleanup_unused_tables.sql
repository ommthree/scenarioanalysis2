-- =====================================================
-- Cleanup Unused Tables
-- =====================================================
-- Migration: cleanup_unused_tables.sql
-- Description: Drop tables that exist but are never referenced in code
-- Date: 2025-10-26

-- Drop audit/logging tables that were never implemented
DROP TABLE IF EXISTS calculation_lineage;
DROP TABLE IF EXISTS run_log;
DROP TABLE IF EXISTS run_result;
DROP TABLE IF EXISTS run_input_snapshot;
DROP TABLE IF EXISTS run_output_snapshot;

-- Drop policy tables from schema.sql that are never used
DROP TABLE IF EXISTS capex_policy;
DROP TABLE IF EXISTS funding_policy;
DROP TABLE IF EXISTS wc_policy;
DROP TABLE IF EXISTS tax_strategies;
DROP TABLE IF EXISTS template_validation_rule;

-- Drop duplicate/old tables
DROP TABLE IF EXISTS pl_results;  -- Duplicate of pl_result (note the 's')
DROP TABLE IF EXISTS location_mapping;  -- Old version, replaced by location_mapping_config

-- Drop orphaned staging tables (empty, no corresponding files)
DROP TABLE IF EXISTS staging_scenario;
DROP TABLE IF EXISTS staging_scenario_1;
DROP TABLE IF EXISTS staging_scenario_2;
DROP TABLE IF EXISTS staging_scenario_3;
DROP TABLE IF EXISTS staging_scenario_4;
DROP TABLE IF EXISTS staging_scenario_5;
DROP TABLE IF EXISTS staging_scenario_6;
DROP TABLE IF EXISTS staging_scenario_7;
DROP TABLE IF EXISTS staging_scenario_8;
DROP TABLE IF EXISTS staging_scenario_9;
DROP TABLE IF EXISTS staging_scenario_10;
DROP TABLE IF EXISTS staging_scenario_11;
DROP TABLE IF EXISTS staging_scenario_12;
DROP TABLE IF EXISTS staging_scenario_13;
DROP TABLE IF EXISTS staging_scenario_14;
DROP TABLE IF EXISTS staging_scenario_15;
DROP TABLE IF EXISTS staging_scenario_16;
DROP TABLE IF EXISTS staging_scenario_17;
DROP TABLE IF EXISTS staging_scenario_18;
DROP TABLE IF EXISTS staging_scenario_19;
DROP TABLE IF EXISTS staging_scenario_20;
DROP TABLE IF EXISTS staging_scenario_21;
DROP TABLE IF EXISTS staging_scenario_22;
DROP TABLE IF EXISTS staging_scenario_23;
DROP TABLE IF EXISTS staging_scenario_24;

-- Drop unused statement staging tables
DROP TABLE IF EXISTS staging_statement_carbon;
DROP TABLE IF EXISTS staging_statement_cashflow;

-- staging_scenario_25 is kept - it has data for file_id 25

SELECT 'Cleanup complete: 39 unused tables dropped' AS message;
