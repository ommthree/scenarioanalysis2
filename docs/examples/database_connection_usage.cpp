/**
 * @file database_connection_usage.cpp
 * @brief Examples showing DatabaseConnection flexibility
 *
 * This demonstrates that DatabaseConnection maintains the abstraction
 * layer while providing convenient syntax.
 */

#include "database/connection.h"
#include "database/database_factory.h"
#include <iostream>

using namespace finmodel::database;

int main() {
    // ========================================================================
    // Method 1: Simple SQLite (convenience constructor)
    // ========================================================================

    std::cout << "Method 1: SQLite convenience constructor\n";
    DatabaseConnection db1(":memory:");

    db1.execute("CREATE TABLE test (id INT, name TEXT)");
    db1.execute("INSERT INTO test VALUES (1, 'Alice')");

    auto stmt = db1.prepare("SELECT * FROM test WHERE id = ?");
    stmt.bind(1, 1);
    if (stmt.step()) {
        std::cout << "  Found: " << stmt.column_text(1) << "\n\n";
    }

    // ========================================================================
    // Method 2: Explicit factory (full flexibility)
    // ========================================================================

    std::cout << "Method 2: Using DatabaseFactory explicitly\n";
    auto sqlite_db = DatabaseFactory::create_sqlite(":memory:");
    DatabaseConnection db2(sqlite_db);

    db2.execute("CREATE TABLE test (id INT, name TEXT)");
    db2.execute("INSERT INTO test VALUES (2, 'Bob')");

    auto stmt2 = db2.prepare("SELECT * FROM test WHERE id = ?");
    stmt2.bind(1, 2);
    if (stmt2.step()) {
        std::cout << "  Found: " << stmt2.column_text(1) << "\n\n";
    }

    // ========================================================================
    // Method 3: When PostgreSQL is implemented (future)
    // ========================================================================

    std::cout << "Method 3: How PostgreSQL would work (future)\n";
    std::cout << "  auto pg_db = DatabaseFactory::create_postgresql(\n"
              << "      \"localhost\", 5432, \"finmodel\", \"user\", \"pass\"\n"
              << "  );\n"
              << "  DatabaseConnection db3(pg_db);\n"
              << "  // Same API from here on!\n\n";

    // ========================================================================
    // Method 4: Dependency injection for testing
    // ========================================================================

    std::cout << "Method 4: Mock database for testing\n";
    std::cout << "  class MockDatabase : public IDatabase { ... };\n"
              << "  auto mock_db = std::make_shared<MockDatabase>();\n"
              << "  DatabaseConnection db4(mock_db);\n"
              << "  // Test without touching real database!\n\n";

    // ========================================================================
    // The Key Point
    // ========================================================================

    std::cout << "KEY INSIGHT:\n";
    std::cout << "  DatabaseConnection wraps IDatabase, not SQLiteDatabase.\n";
    std::cout << "  The abstraction layer is PRESERVED.\n";
    std::cout << "  You can swap database backends by changing the factory call.\n";
    std::cout << "  All your PLEngine, TaxEngine, etc. code stays the same!\n";

    return 0;
}

/**
 * OUTPUT:
 *
 * Method 1: SQLite convenience constructor
 *   Found: Alice
 *
 * Method 2: Using DatabaseFactory explicitly
 *   Found: Bob
 *
 * Method 3: How PostgreSQL would work (future)
 *   auto pg_db = DatabaseFactory::create_postgresql(
 *       "localhost", 5432, "finmodel", "user", "pass"
 *   );
 *   DatabaseConnection db3(pg_db);
 *   // Same API from here on!
 *
 * Method 4: Mock database for testing
 *   class MockDatabase : public IDatabase { ... };
 *   auto mock_db = std::make_shared<MockDatabase>();
 *   DatabaseConnection db4(mock_db);
 *   // Test without touching real database!
 *
 * KEY INSIGHT:
 *   DatabaseConnection wraps IDatabase, not SQLiteDatabase.
 *   The abstraction layer is PRESERVED.
 *   You can swap database backends by changing the factory call.
 *   All your PLEngine, TaxEngine, etc. code stays the same!
 */
