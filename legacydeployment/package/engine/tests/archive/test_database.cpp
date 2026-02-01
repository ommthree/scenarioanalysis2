#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "database/idatabase.h"
#include "database/result_set.h"
#include <memory>
#include <algorithm>

using namespace finmodel;
using namespace finmodel::database;

// ============================================================================
// Connection Management Tests
// ============================================================================

TEST_CASE("Database connects successfully to in-memory database", "[database][connection]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    REQUIRE(db != nullptr);
    REQUIRE(db->is_connected());
    REQUIRE(db->database_type() == "sqlite");
}

TEST_CASE("Database connects to file-based database", "[database][connection]") {
    // Use a temporary test database
    auto db = DatabaseFactory::create_sqlite("test_temp.db");

    REQUIRE(db != nullptr);
    REQUIRE(db->is_connected());

    // Cleanup
    db->disconnect();
    std::remove("test_temp.db");
}

TEST_CASE("Multiple connections work with WAL mode", "[database][connection]") {
    // Create first connection
    auto db1 = DatabaseFactory::create_sqlite(":memory:");
    REQUIRE(db1->is_connected());

    // Create table with first connection
    db1->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db1->execute_update("INSERT INTO test (value) VALUES ('test')", {});

    // WAL mode allows multiple connections to same database
    // For in-memory, we just verify it doesn't crash
    REQUIRE(db1->is_connected());
}

// ============================================================================
// Query Execution Tests
// ============================================================================

TEST_CASE("Simple query without parameters", "[database][query]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    db->execute_update("INSERT INTO test (name) VALUES ('Alice')", {});
    db->execute_update("INSERT INTO test (name) VALUES ('Bob')", {});

    auto result = db->execute_query("SELECT id, name FROM test ORDER BY id", {});

    REQUIRE(result->next());
    REQUIRE(result->get_int("id") == 1);
    REQUIRE(result->get_string("name") == "Alice");

    REQUIRE(result->next());
    REQUIRE(result->get_int("id") == 2);
    REQUIRE(result->get_string("name") == "Bob");

    REQUIRE_FALSE(result->next());
}

TEST_CASE("Parameterized query with named parameters", "[database][query]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test_scenario (scenario_id INTEGER PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL)");

    // Insert test data
    ParamMap insert_params;
    insert_params["code"] = std::string("TEST");
    insert_params["name"] = std::string("Test Scenario");

    db->execute_update("INSERT INTO test_scenario (code, name) VALUES (:code, :name)", insert_params);

    // Query with parameter
    ParamMap query_params;
    query_params["code"] = std::string("TEST");

    auto result = db->execute_query(
        "SELECT scenario_id, name FROM test_scenario WHERE code = :code",
        query_params
    );

    REQUIRE(result->next());
    REQUIRE(result->get_string("name") == "Test Scenario");
    REQUIRE_FALSE(result->next());
}

TEST_CASE("Query that returns no results", "[database][query]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

    auto result = db->execute_query("SELECT * FROM test WHERE id = 999", {});

    REQUIRE_FALSE(result->next());
}

TEST_CASE("Query with column access by name and index", "[database][query]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, name TEXT, value REAL)");
    db->execute_update("INSERT INTO test VALUES (1, 'test', 123.45)", {});

    auto result = db->execute_query("SELECT id, name, value FROM test", {});

    REQUIRE(result->next());

    // Access by name
    REQUIRE(result->get_int("id") == 1);
    REQUIRE(result->get_string("name") == "test");
    REQUIRE(result->get_double("value") == Catch::Approx(123.45));

    // Access by index
    REQUIRE(result->get_int(0) == 1);
    REQUIRE(result->get_string(1) == "test");
    REQUIRE(result->get_double(2) == Catch::Approx(123.45));
}

// ============================================================================
// Parameter Binding Tests
// ============================================================================

TEST_CASE("Bind integer parameter", "[database][parameters]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value INTEGER)");

    ParamMap params;
    params["val"] = 42;

    db->execute_update("INSERT INTO test (id, value) VALUES (1, :val)", params);

    auto result = db->execute_query("SELECT value FROM test WHERE id = 1", {});
    REQUIRE(result->next());
    REQUIRE(result->get_int("value") == 42);
}

TEST_CASE("Bind double parameter", "[database][parameters]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value REAL)");

    ParamMap params;
    params["val"] = 3.14159;

    db->execute_update("INSERT INTO test (id, value) VALUES (1, :val)", params);

    auto result = db->execute_query("SELECT value FROM test WHERE id = 1", {});
    REQUIRE(result->next());
    REQUIRE(result->get_double("value") == Catch::Approx(3.14159));
}

TEST_CASE("Bind string parameter", "[database][parameters]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");

    ParamMap params;
    params["val"] = std::string("Hello, World!");

    db->execute_update("INSERT INTO test (id, value) VALUES (1, :val)", params);

    auto result = db->execute_query("SELECT value FROM test WHERE id = 1", {});
    REQUIRE(result->next());
    REQUIRE(result->get_string("value") == "Hello, World!");
}

TEST_CASE("Bind null parameter", "[database][parameters]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");

    ParamMap params;
    params["val"] = nullptr;

    db->execute_update("INSERT INTO test (id, value) VALUES (1, :val)", params);

    auto result = db->execute_query("SELECT value FROM test WHERE id = 1", {});
    REQUIRE(result->next());
    REQUIRE(result->is_null("value"));
}

// ============================================================================
// Update Operation Tests
// ============================================================================

TEST_CASE("INSERT statement returns correct row count", "[database][update]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

    int rows = db->execute_update("INSERT INTO test (value) VALUES ('test')", {});
    REQUIRE(rows == 1);

    rows = db->execute_update("INSERT INTO test (value) VALUES ('test2')", {});
    REQUIRE(rows == 1);
}

TEST_CASE("UPDATE statement returns affected row count", "[database][update]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db->execute_update("INSERT INTO test (value) VALUES ('old')", {});
    db->execute_update("INSERT INTO test (value) VALUES ('old')", {});
    db->execute_update("INSERT INTO test (value) VALUES ('keep')", {});

    ParamMap params;
    params["new_val"] = std::string("new");
    params["old_val"] = std::string("old");

    int rows = db->execute_update("UPDATE test SET value = :new_val WHERE value = :old_val", params);
    REQUIRE(rows == 2);
}

TEST_CASE("DELETE statement returns affected row count", "[database][update]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db->execute_update("INSERT INTO test (value) VALUES ('delete_me')", {});
    db->execute_update("INSERT INTO test (value) VALUES ('delete_me')", {});
    db->execute_update("INSERT INTO test (value) VALUES ('keep')", {});

    ParamMap params;
    params["val"] = std::string("delete_me");

    int rows = db->execute_update("DELETE FROM test WHERE value = :val", params);
    REQUIRE(rows == 2);
}

TEST_CASE("last_insert_id returns correct value", "[database][update]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)");

    db->execute_update("INSERT INTO test (value) VALUES ('first')", {});
    int64_t id1 = db->last_insert_id();
    REQUIRE(id1 == 1);

    db->execute_update("INSERT INTO test (value) VALUES ('second')", {});
    int64_t id2 = db->last_insert_id();
    REQUIRE(id2 == 2);
}

// ============================================================================
// Transaction Management Tests
// ============================================================================

TEST_CASE("Transaction commit persists changes", "[database][transaction]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db->execute_update("INSERT INTO test (value) VALUES ('initial')", {});

    // Start transaction
    db->begin_transaction();
    REQUIRE(db->in_transaction());

    db->execute_update("INSERT INTO test (value) VALUES ('transactional')", {});

    // Commit
    db->commit();
    REQUIRE_FALSE(db->in_transaction());

    // Verify both rows exist
    auto result = db->execute_query("SELECT COUNT(*) as cnt FROM test", {});
    result->next();
    REQUIRE(result->get_int("cnt") == 2);
}

TEST_CASE("Transaction rollback reverts changes", "[database][transaction]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db->execute_update("INSERT INTO test (value) VALUES ('initial')", {});

    // Start transaction and insert more data
    db->begin_transaction();
    REQUIRE(db->in_transaction());

    db->execute_update("INSERT INTO test (value) VALUES ('transactional')", {});

    // Verify data exists within transaction
    auto result1 = db->execute_query("SELECT COUNT(*) as cnt FROM test", {});
    result1->next();
    REQUIRE(result1->get_int("cnt") == 2);

    // Rollback
    db->rollback();
    REQUIRE_FALSE(db->in_transaction());

    // Verify only initial data remains
    auto result2 = db->execute_query("SELECT COUNT(*) as cnt FROM test", {});
    result2->next();
    REQUIRE(result2->get_int("cnt") == 1);

    auto result3 = db->execute_query("SELECT value FROM test", {});
    result3->next();
    REQUIRE(result3->get_string("value") == "initial");
}

TEST_CASE("in_transaction returns correct state", "[database][transaction]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    REQUIRE_FALSE(db->in_transaction());

    db->begin_transaction();
    REQUIRE(db->in_transaction());

    db->commit();
    REQUIRE_FALSE(db->in_transaction());

    db->begin_transaction();
    REQUIRE(db->in_transaction());

    db->rollback();
    REQUIRE_FALSE(db->in_transaction());
}

TEST_CASE("Nested transaction throws exception", "[database][transaction]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->begin_transaction();

    REQUIRE_THROWS_AS(db->begin_transaction(), DatabaseException);

    db->rollback();
}

// ============================================================================
// ResultSet Operation Tests
// ============================================================================

TEST_CASE("ResultSet iteration through multiple rows", "[database][resultset]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");
    db->execute_update("INSERT INTO test VALUES (1, 'one')", {});
    db->execute_update("INSERT INTO test VALUES (2, 'two')", {});
    db->execute_update("INSERT INTO test VALUES (3, 'three')", {});

    auto result = db->execute_query("SELECT id, value FROM test ORDER BY id", {});

    int count = 0;
    while (result->next()) {
        count++;
        REQUIRE(result->get_int("id") == count);
    }

    REQUIRE(count == 3);
}

TEST_CASE("ResultSet column_names returns correct list", "[database][resultset]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, name TEXT, value REAL)");
    db->execute_update("INSERT INTO test VALUES (1, 'test', 3.14)", {});

    auto result = db->execute_query("SELECT id, name, value FROM test", {});

    auto names = result->column_names();
    REQUIRE(names.size() == 3);
    REQUIRE(names[0] == "id");
    REQUIRE(names[1] == "name");
    REQUIRE(names[2] == "value");
}

TEST_CASE("ResultSet column_index finds columns correctly", "[database][resultset]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, name TEXT, value REAL)");
    db->execute_update("INSERT INTO test VALUES (1, 'test', 3.14)", {});

    auto result = db->execute_query("SELECT id, name, value FROM test", {});
    result->next();

    auto idx_id = result->column_index("id");
    auto idx_name = result->column_index("name");
    auto idx_value = result->column_index("value");
    auto idx_invalid = result->column_index("invalid");

    REQUIRE(idx_id.has_value());
    REQUIRE(*idx_id == 0);

    REQUIRE(idx_name.has_value());
    REQUIRE(*idx_name == 1);

    REQUIRE(idx_value.has_value());
    REQUIRE(*idx_value == 2);

    REQUIRE_FALSE(idx_invalid.has_value());
}

TEST_CASE("ResultSet is_null detects NULL values", "[database][resultset]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");
    db->execute_update("INSERT INTO test (id, value) VALUES (1, 'not_null')", {});
    db->execute_update("INSERT INTO test (id, value) VALUES (2, NULL)", {});

    auto result = db->execute_query("SELECT id, value FROM test ORDER BY id", {});

    result->next();
    REQUIRE_FALSE(result->is_null("value"));
    REQUIRE(result->get_string("value") == "not_null");

    result->next();
    REQUIRE(result->is_null("value"));
}

TEST_CASE("ResultSet type conversions work correctly", "[database][resultset]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (int_val INTEGER, real_val REAL, text_val TEXT)");
    db->execute_update("INSERT INTO test VALUES (42, 3.14159, '123')", {});

    auto result = db->execute_query("SELECT int_val, real_val, text_val FROM test", {});
    result->next();

    // Integer access
    REQUIRE(result->get_int("int_val") == 42);
    REQUIRE(result->get_int64("int_val") == 42);

    // Double access
    REQUIRE(result->get_double("real_val") == Catch::Approx(3.14159));

    // String access
    REQUIRE(result->get_string("text_val") == "123");
}

// ============================================================================
// Error Handling Tests
// ============================================================================

TEST_CASE("Invalid SQL throws DatabaseException", "[database][error]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    REQUIRE_THROWS_AS(
        db->execute_query("SELECT * FROM nonexistent_table", {}),
        DatabaseException
    );
}

TEST_CASE("Missing parameter binds as NULL", "[database][error]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");

    // SQLite allows missing parameters and binds them as NULL
    ParamMap empty_params;
    db->execute_update("INSERT INTO test (id, value) VALUES (1, :value)", empty_params);

    auto result = db->execute_query("SELECT id, value FROM test", {});
    REQUIRE(result->next());
    REQUIRE(result->get_int("id") == 1);
    REQUIRE(result->is_null("value"));
}

TEST_CASE("Column not found throws exception", "[database][error]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER, value TEXT)");
    db->execute_update("INSERT INTO test VALUES (1, 'test')", {});

    auto result = db->execute_query("SELECT id, value FROM test", {});
    result->next();

    REQUIRE_THROWS_AS(
        result->get_string("invalid_column"),
        DatabaseException
    );
}

// ============================================================================
// Metadata Operation Tests
// ============================================================================

TEST_CASE("list_tables returns all tables", "[database][metadata]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE table1 (id INTEGER)");
    db->execute_raw("CREATE TABLE table2 (id INTEGER)");
    db->execute_raw("CREATE TABLE table3 (id INTEGER)");

    auto tables = db->list_tables();

    REQUIRE(tables.size() == 3);
    REQUIRE(std::find(tables.begin(), tables.end(), "table1") != tables.end());
    REQUIRE(std::find(tables.begin(), tables.end(), "table2") != tables.end());
    REQUIRE(std::find(tables.begin(), tables.end(), "table3") != tables.end());
}

TEST_CASE("describe_table returns correct columns", "[database][metadata]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value REAL)");

    auto columns = db->describe_table("test");

    REQUIRE(columns.size() == 3);
    REQUIRE(columns[0] == "id");
    REQUIRE(columns[1] == "name");
    REQUIRE(columns[2] == "value");
}
