# Legacy Engines - ARCHIVED

## Status: DEPRECATED

These engines are from the old three-engine architecture that has been superseded by the **UnifiedEngine**.

## Old Architecture (Deprecated)

```
PLEngine → BSEngine → CFEngine
   ↓          ↓          ↓
 P&L    Balance Sheet  Cash Flow
```

**Problems:**
- Manual ordering required (P&L must run before BS, BS before CF)
- Limited working capital support
- Simplified formulas to avoid circular dependencies
- Three separate templates

## New Architecture (Production)

```
UnifiedEngine
    ↓
Single Mega-DAG → All statements in one pass
```

**Benefits:**
- Automatic ordering via topological sort
- Full working capital integration (AR, Inventory, AP)
- Real indirect method cash flow
- Time-shifted references break circular dependencies
- Single unified template

## Migration Guide

**Don't use these engines for new code!**

Use **UnifiedEngine** instead:

```cpp
// OLD (deprecated)
PLEngine pl_engine(db);
auto pl_result = pl_engine.calculate(...);

BSEngine bs_engine(db);
auto bs_result = bs_engine.calculate(..., pl_result, ...);

CFEngine cf_engine(db);
auto cf_result = cf_engine.calculate(..., pl_result, bs_result, ...);

// NEW (production)
UnifiedEngine engine(db);
auto result = engine.calculate(entity_id, scenario_id, period_id, opening_bs, "UNIFIED_TEMPLATE");

// Extract individual statements if needed
auto pl = result.extract_pl_result();
auto bs = result.extract_balance_sheet();
auto cf = result.extract_cash_flow();
```

## Why Archived?

These engines are kept for:
1. **Historical reference** - understand how we solved problems before
2. **Backward compatibility** - old code might still reference them
3. **Documentation** - shows evolution of the architecture

**For all new development, use UnifiedEngine!**

See: `docs/LEVEL4_TEST.md` for full UnifiedEngine documentation.
