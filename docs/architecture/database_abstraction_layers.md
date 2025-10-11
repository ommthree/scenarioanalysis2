# Database Abstraction Layers

## The Architecture (Layered View)

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
│              (PLEngine, TaxEngine, Tests, etc.)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Uses
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   DatabaseConnection                         │
│            (Convenience wrapper with PreparedStatement)      │
│                                                              │
│  - prepare()    → Create prepared statements                │
│  - execute()    → Run simple SQL                            │
│  - begin/commit → Transaction management                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Wraps
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      IDatabase                               │
│                   (Abstract Interface)                       │
│                                                              │
│  Pure virtual methods:                                       │
│  - connect()        → Establish connection                  │
│  - execute_query()  → Run SELECT                            │
│  - execute_update() → Run INSERT/UPDATE/DELETE              │
│  - begin_transaction() → Start transaction                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Implemented by
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│SQLiteDatabase│  │PostgreSQLDatabase│  │MySQLDatabase │
│              │  │   (future)       │  │  (future)    │
│ - SQLite API │  │ - libpq API      │  │ - MySQL API  │
│ - File-based │  │ - Server-based   │  │ - Server     │
└──────────────┘  └──────────────────┘  └──────────────┘
```

## Why This Works (Abstraction Preserved)

### Layer 1: IDatabase Interface

**Purpose:** Define what a database CAN do, not HOW it does it.

```cpp
class IDatabase {
public:
    virtual void connect(const std::string& connection_string) = 0;
    virtual std::shared_ptr<ResultSet> execute_query(
        const std::string& sql,
        const ParamMap& params
    ) = 0;
    // ... other methods
};
```

**Key:** This is a **contract**. Any database that implements these methods can plug in.

### Layer 2: DatabaseConnection Wrapper

**Purpose:** Simplify common operations (convenience layer).

```cpp
class DatabaseConnection {
private:
    std::shared_ptr<IDatabase> db_;  // ← Holds interface, not concrete type!

public:
    // Flexible constructor - accepts ANY IDatabase
    explicit DatabaseConnection(std::shared_ptr<IDatabase> db);

    // Convenience constructor - defaults to SQLite
    explicit DatabaseConnection(const std::string& db_path);

    PreparedStatement prepare(const std::string& sql) {
        return PreparedStatement(db_, sql);  // ← Uses interface
    }
};
```

**Key:** DatabaseConnection operates on `IDatabase*`, so it works with **any** implementation.

### Layer 3: Factory Pattern

**Purpose:** Create the right database type based on needs.

```cpp
class DatabaseFactory {
public:
    static std::shared_ptr<IDatabase> create_sqlite(const std::string& path) {
        return std::make_shared<SQLiteDatabase>();
    }

    static std::shared_ptr<IDatabase> create_postgresql(
        const std::string& host,
        int port,
        const std::string& dbname
    ) {
        return std::make_shared<PostgreSQLDatabase>();
    }
};
```

**Key:** Application code doesn't `new SQLiteDatabase()` directly. Factory handles instantiation.

## Swapping Databases: Three Scenarios

### Scenario 1: Development (SQLite)

```cpp
// Simple, no setup needed
DatabaseConnection db(":memory:");

// Or from file
DatabaseConnection db("../data/finmodel.db");
```

### Scenario 2: Production (PostgreSQL)

```cpp
// Create PostgreSQL instance
auto pg_db = DatabaseFactory::create_postgresql(
    "db.company.com",
    5432,
    "finmodel_prod"
);

// Same interface from here!
DatabaseConnection db(pg_db);
```

**All application code (PLEngine, TaxEngine, etc.) works identically!**

### Scenario 3: Testing (Mock Database)

```cpp
class MockDatabase : public IDatabase {
public:
    void connect(const std::string& conn_str) override {
        // No-op for testing
    }

    std::shared_ptr<ResultSet> execute_query(
        const std::string& sql,
        const ParamMap& params
    ) override {
        // Return canned test data
        return std::make_shared<MockResultSet>(test_data_);
    }

    // ... other methods return test data
};

// In tests:
auto mock_db = std::make_shared<MockDatabase>();
DatabaseConnection db(mock_db);

PLEngine engine(db);
// Test PLEngine without touching real database!
```

## What Changed vs Original Design?

### Before (Hardcoded SQLite)

```cpp
class DatabaseConnection {
public:
    explicit DatabaseConnection(const std::string& db_path)
        : db_(DatabaseFactory::create_sqlite(db_path))  // ← Hardcoded!
    { }
};
```

**Problem:** Can only use SQLite. To use PostgreSQL, you'd need to modify this class.

### After (Flexible)

```cpp
class DatabaseConnection {
public:
    // Primary constructor - accepts any IDatabase
    explicit DatabaseConnection(std::shared_ptr<IDatabase> db)
        : db_(db)  // ← Works with ANY implementation!
    { }

    // Convenience constructor - still supports old code
    explicit DatabaseConnection(const std::string& db_path)
        : DatabaseConnection(DatabaseFactory::create_sqlite(db_path))
    { }
};
```

**Solution:**
- New code can inject any database type
- Old code (using string constructor) still works
- Both preserve abstraction

## The Dependency Chain

```
Application Code
    ↓ depends on
DatabaseConnection
    ↓ depends on
IDatabase (interface)
    ↑ implemented by
SQLiteDatabase / PostgreSQLDatabase / MockDatabase

Direction of dependency: ← Always points UP to abstractions, not DOWN to concrete types
```

This is the **Dependency Inversion Principle**:
- High-level modules (PLEngine) don't depend on low-level modules (SQLiteDatabase)
- Both depend on abstractions (IDatabase)

## Real-World Example: Switching Databases

### Step 1: Current State (SQLite)

```cpp
// In main.cpp or initialization
DatabaseConnection db("../data/finmodel.db");

PLEngine pl_engine(db);
TaxEngine tax_engine(db);
ConsolidationEngine consol_engine(db);

// Everything works with SQLite
```

### Step 2: Moving to PostgreSQL

```cpp
// ONLY CHANGE: How we create the database
auto pg_db = DatabaseFactory::create_postgresql(
    config.get("db.host"),
    config.get("db.port"),
    config.get("db.name")
);
DatabaseConnection db(pg_db);  // ← Changed this line

// UNCHANGED: All this code stays the same!
PLEngine pl_engine(db);
TaxEngine tax_engine(db);
ConsolidationEngine consol_engine(db);
```

**That's it!** One line change, and you're on PostgreSQL.

## Why This Matters

### Without Abstraction

If we didn't have IDatabase and just used SQLiteDatabase directly:

```cpp
// BAD: Direct coupling
class PLEngine {
    SQLiteDatabase db_;  // ← Hardcoded to SQLite!

    void calculate(...) {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db_.get_handle(), sql, ...);  // ← SQLite-specific API
        // ...
    }
};
```

**Problems:**
- Can't switch to PostgreSQL without rewriting PLEngine
- Can't test without real database
- Tight coupling makes code fragile

### With Abstraction (What We Have)

```cpp
// GOOD: Coupled to interface
class PLEngine {
    DatabaseConnection db_;  // ← Interface wrapper

    void calculate(...) {
        auto stmt = db_.prepare(sql);  // ← Generic API
        // ...
    }
};
```

**Benefits:**
- ✅ Switch databases by changing one line in main()
- ✅ Test with mock databases
- ✅ PLEngine code never needs to change
- ✅ Can support multiple databases simultaneously (multi-tenant)

## Summary

**Q: Does DatabaseConnection break the abstraction?**

**A: No! It enhances it.**

- DatabaseConnection wraps `IDatabase*`, not `SQLiteDatabase*`
- All operations go through the interface
- The convenience constructor just calls the factory
- You can inject any IDatabase implementation
- Application code (PLEngine, etc.) depends on DatabaseConnection, which depends on IDatabase
- No application code depends on SQLiteDatabase directly

**The abstraction is preserved, and we get convenient syntax too!** 🎉
