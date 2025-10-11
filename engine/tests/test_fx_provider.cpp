/**
 * @file test_fx_provider.cpp
 * @brief Tests for FX value provider
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "core/providers/fx_value_provider.h"
#include "core/context.h"
#include "database/database_factory.h"
#include "database/result_set.h"

using namespace finmodel;
using namespace finmodel::core;
using namespace finmodel::database;
using Catch::Approx;

// ============================================================================
// Test Fixtures
// ============================================================================

struct FXProviderFixture {
    std::shared_ptr<IDatabase> db;
    std::unique_ptr<FXValueProvider> fx_provider;

    FXProviderFixture() {
        db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");
        fx_provider = std::make_unique<FXValueProvider>(db);
    }
};

// ============================================================================
// FX Key Parsing Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: has_value recognizes FX keys", "[fx][parsing]") {
    SECTION("Valid FX keys") {
        CHECK(fx_provider->has_value("FX_USD_EUR"));
        CHECK(fx_provider->has_value("FX_GBP_USD"));
        CHECK(fx_provider->has_value("FX_EUR_JPY"));
        CHECK(fx_provider->has_value("FX_USD_EUR_AVERAGE"));
        CHECK(fx_provider->has_value("FX_USD_EUR_CLOSING"));
        CHECK(fx_provider->has_value("FX_USD_EUR_OPENING"));
    }

    SECTION("Invalid FX keys") {
        CHECK_FALSE(fx_provider->has_value("USD_EUR"));  // Missing FX_ prefix
        CHECK_FALSE(fx_provider->has_value("FX_USD"));   // Missing second currency
        CHECK_FALSE(fx_provider->has_value("REVENUE"));  // Not an FX key
        CHECK_FALSE(fx_provider->has_value("FX_"));      // Incomplete
    }
}

// ============================================================================
// FX Rate Retrieval Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Retrieve average rates", "[fx][rates]") {
    // Set context to scenario 1, period 1 (has sample data from migration)
    fx_provider->set_context(1, 1);

    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    SECTION("Direct rates (USD base)") {
        // Sample data from migration: USD → EUR = 0.85 (average)
        double usd_eur = fx_provider->get_value("FX_USD_EUR", ctx);
        CHECK(usd_eur == Approx(0.85).epsilon(0.001));

        double usd_gbp = fx_provider->get_value("FX_USD_GBP", ctx);
        CHECK(usd_gbp == Approx(0.73).epsilon(0.001));

        double usd_jpy = fx_provider->get_value("FX_USD_JPY", ctx);
        CHECK(usd_jpy == Approx(110.0).epsilon(0.01));
    }

    SECTION("Direct rates (EUR base)") {
        double eur_usd = fx_provider->get_value("FX_EUR_USD", ctx);
        CHECK(eur_usd == Approx(1.18).epsilon(0.001));

        double eur_gbp = fx_provider->get_value("FX_EUR_GBP", ctx);
        CHECK(eur_gbp == Approx(0.86).epsilon(0.001));
    }

    SECTION("Explicit average rate") {
        double usd_eur_avg = fx_provider->get_value("FX_USD_EUR_AVERAGE", ctx);
        CHECK(usd_eur_avg == Approx(0.85).epsilon(0.001));
    }
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Retrieve closing rates", "[fx][rates]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // Sample data: USD → EUR closing = 0.84
    double usd_eur_closing = fx_provider->get_value("FX_USD_EUR_CLOSING", ctx);
    CHECK(usd_eur_closing == Approx(0.84).epsilon(0.001));

    double usd_gbp_closing = fx_provider->get_value("FX_USD_GBP_CLOSING", ctx);
    CHECK(usd_gbp_closing == Approx(0.72).epsilon(0.001));
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Inverse rate calculation", "[fx][inverse]") {
    // If we don't have GBP → JPY stored, but have JPY → GBP,
    // the provider should calculate the inverse

    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // Sample data has GBP → JPY = 150.7 (average)
    // So JPY → GBP should be 1/150.7 ≈ 0.00664

    // First verify direct rate exists
    double gbp_jpy = fx_provider->get_value("FX_GBP_JPY", ctx);
    CHECK(gbp_jpy == Approx(150.7).epsilon(0.01));

    // Now check inverse (not stored, should be calculated)
    // Note: The view v_fx_rates provides this automatically in the database,
    // but the provider also handles it programmatically
    double jpy_gbp = fx_provider->get_value("FX_JPY_GBP", ctx);
    CHECK(jpy_gbp == Approx(1.0 / 150.7).epsilon(0.00001));
}

// ============================================================================
// Caching Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Rate caching", "[fx][cache]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // First call - loads from database
    double rate1 = fx_provider->get_value("FX_USD_EUR", ctx);

    // Second call - should use cache (verify by checking same value)
    double rate2 = fx_provider->get_value("FX_USD_EUR", ctx);

    CHECK(rate1 == rate2);
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Cache cleared on context change", "[fx][cache]") {
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // Set context to period 1
    fx_provider->set_context(1, 1);
    double rate_p1 = fx_provider->get_value("FX_USD_EUR", ctx);

    // Change context to period 2 (might have different rate)
    fx_provider->set_context(1, 2);

    // This should reload from database (cache cleared)
    // For this test, we just verify no crash - actual rate comparison
    // would require period 2 data
}

// ============================================================================
// Error Handling Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Error - context not set", "[fx][errors]") {
    // Don't call set_context()
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    REQUIRE_THROWS_AS(
        fx_provider->get_value("FX_USD_EUR", ctx),
        std::runtime_error
    );
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Error - invalid format", "[fx][errors]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    SECTION("Invalid key format") {
        REQUIRE_THROWS_AS(
            fx_provider->get_value("FX_USD", ctx),  // Missing second currency
            std::runtime_error
        );
    }

    SECTION("Invalid rate type") {
        REQUIRE_THROWS_AS(
            fx_provider->get_value("FX_USD_EUR_INVALID", ctx),
            std::runtime_error
        );
    }
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Error - rate not found", "[fx][errors]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // Try to get rate for currencies not in database
    REQUIRE_THROWS_AS(
        fx_provider->get_value("FX_USD_XXX", ctx),  // XXX doesn't exist
        std::runtime_error
    );
}

// ============================================================================
// Case Sensitivity Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Case insensitive currency codes", "[fx][case]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    // Provider should handle lowercase currency codes
    double rate_upper = fx_provider->get_value("FX_USD_EUR", ctx);
    double rate_lower = fx_provider->get_value("FX_usd_eur", ctx);
    double rate_mixed = fx_provider->get_value("FX_Usd_Eur", ctx);

    CHECK(rate_upper == rate_lower);
    CHECK(rate_upper == rate_mixed);
}

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Case insensitive rate type", "[fx][case]") {
    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    double rate_lower = fx_provider->get_value("FX_USD_EUR_closing", ctx);
    double rate_upper = fx_provider->get_value("FX_USD_EUR_CLOSING", ctx);
    double rate_mixed = fx_provider->get_value("FX_USD_EUR_Closing", ctx);

    CHECK(rate_lower == rate_upper);
    CHECK(rate_lower == rate_mixed);
}

// ============================================================================
// Integration Tests
// ============================================================================

TEST_CASE_METHOD(FXProviderFixture, "FXProvider: Multi-currency conversion chain", "[fx][integration]") {
    // Verify rate consistency: USD → EUR → GBP should equal USD → GBP

    fx_provider->set_context(1, 1);
    Context ctx(1, 1, 1);  // scenario_id=1, period_id=1, entity_id=1

    double usd_eur = fx_provider->get_value("FX_USD_EUR", ctx);
    double eur_gbp = fx_provider->get_value("FX_EUR_GBP", ctx);
    double usd_gbp_calc = usd_eur * eur_gbp;

    double usd_gbp_direct = fx_provider->get_value("FX_USD_GBP", ctx);

    // Should be approximately equal (allowing for rounding in sample data)
    CHECK(usd_gbp_calc == Approx(usd_gbp_direct).epsilon(0.01));
}
