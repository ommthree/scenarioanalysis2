/**
 * @file test_tax_strategies.cpp
 * @brief Tax strategy tests
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

#include "pl/tax_engine.h"
#include "pl/tax_strategies/flat_rate_strategy.h"
#include "pl/tax_strategies/progressive_strategy.h"
#include "pl/tax_strategies/minimum_tax_strategy.h"
#include "database/connection.h"

using namespace finmodel;
using namespace finmodel::pl;
using namespace finmodel::core;
using Catch::Matchers::WithinAbs;

// ============================================================================
// FlatRateTaxStrategy Tests
// ============================================================================

TEST_CASE("FlatRateTaxStrategy - Basic calculation", "[tax][flat_rate]") {
    FlatRateTaxStrategy strategy(0.21);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Positive income") {
        REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(21000.0, 1e-9));
        REQUIRE_THAT(strategy.calculate_tax(50000.0, ctx, params), WithinAbs(10500.0, 1e-9));
        REQUIRE_THAT(strategy.calculate_tax(1.0, ctx, params), WithinAbs(0.21, 1e-9));
    }

    SECTION("Zero income") {
        REQUIRE_THAT(strategy.calculate_tax(0.0, ctx, params), WithinAbs(0.0, 1e-9));
    }

    SECTION("Negative income - no tax") {
        REQUIRE_THAT(strategy.calculate_tax(-10000.0, ctx, params), WithinAbs(0.0, 1e-9));
        REQUIRE_THAT(strategy.calculate_tax(-1.0, ctx, params), WithinAbs(0.0, 1e-9));
    }
}

TEST_CASE("FlatRateTaxStrategy - Different rates", "[tax][flat_rate]") {
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("No tax (0%)") {
        FlatRateTaxStrategy strategy(0.0);
        REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(0.0, 1e-9));
    }

    SECTION("Low tax (10%)") {
        FlatRateTaxStrategy strategy(0.10);
        REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(10000.0, 1e-9));
    }

    SECTION("High tax (35%)") {
        FlatRateTaxStrategy strategy(0.35);
        REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(35000.0, 1e-9));
    }

    SECTION("Very high tax (50%)") {
        FlatRateTaxStrategy strategy(0.50);
        REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(50000.0, 1e-9));
    }
}

TEST_CASE("FlatRateTaxStrategy - Metadata", "[tax][flat_rate]") {
    FlatRateTaxStrategy strategy(0.21);

    REQUIRE(strategy.name() == "FLAT_RATE");
    REQUIRE(strategy.description() == "Flat rate tax at 21%");
}

// ============================================================================
// ProgressiveTaxStrategy Tests
// ============================================================================

TEST_CASE("ProgressiveTaxStrategy - Single bracket", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0, 0.10}  // All income: 10%
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    REQUIRE_THAT(strategy.calculate_tax(50000.0, ctx, params), WithinAbs(5000.0, 1e-9));
    REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(10000.0, 1e-9));
}

TEST_CASE("ProgressiveTaxStrategy - Two brackets", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,     0.10},  // 0-50k: 10%
        {50000, 0.20}   // 50k+: 20%
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Income below first threshold") {
        // Income = 30k, all in first bracket
        // Tax = 30k * 0.10 = 3k
        REQUIRE_THAT(strategy.calculate_tax(30000.0, ctx, params), WithinAbs(3000.0, 1e-9));
    }

    SECTION("Income exactly at threshold") {
        // Income = 50k, all in first bracket
        // Tax = 50k * 0.10 = 5k
        REQUIRE_THAT(strategy.calculate_tax(50000.0, ctx, params), WithinAbs(5000.0, 1e-9));
    }

    SECTION("Income above threshold") {
        // Income = 75k
        // Tax = 50k * 0.10 + 25k * 0.20 = 5k + 5k = 10k
        REQUIRE_THAT(strategy.calculate_tax(75000.0, ctx, params), WithinAbs(10000.0, 1e-9));
    }

    SECTION("High income") {
        // Income = 150k
        // Tax = 50k * 0.10 + 100k * 0.20 = 5k + 20k = 25k
        REQUIRE_THAT(strategy.calculate_tax(150000.0, ctx, params), WithinAbs(25000.0, 1e-9));
    }
}

TEST_CASE("ProgressiveTaxStrategy - Three brackets", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,      0.10},  // 0-50k: 10%
        {50000,  0.20},  // 50k-100k: 20%
        {100000, 0.30}   // 100k+: 30%
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Income in third bracket") {
        // Income = 125k
        // Tax = 50k * 0.10 + 50k * 0.20 + 25k * 0.30
        //     = 5k + 10k + 7.5k = 22.5k
        REQUIRE_THAT(strategy.calculate_tax(125000.0, ctx, params), WithinAbs(22500.0, 1e-9));
    }

    SECTION("High income") {
        // Income = 200k
        // Tax = 50k * 0.10 + 50k * 0.20 + 100k * 0.30
        //     = 5k + 10k + 30k = 45k
        REQUIRE_THAT(strategy.calculate_tax(200000.0, ctx, params), WithinAbs(45000.0, 1e-9));
    }
}

TEST_CASE("ProgressiveTaxStrategy - US-style brackets", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,       0.10},  // 0-50k: 10%
        {50000,   0.12},  // 50k-100k: 12%
        {100000,  0.22},  // 100k-200k: 22%
        {200000,  0.24},  // 200k-500k: 24%
        {500000,  0.32},  // 500k-1M: 32%
        {1000000, 0.35}   // 1M+: 35%
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Middle income") {
        // Income = 150k
        // Tax = 50k*0.10 + 50k*0.12 + 50k*0.22
        //     = 5k + 6k + 11k = 22k
        REQUIRE_THAT(strategy.calculate_tax(150000.0, ctx, params), WithinAbs(22000.0, 1e-9));
    }

    SECTION("High income") {
        // Income = 2M
        double tax = 50000 * 0.10 +      // 5k
                     50000 * 0.12 +      // 6k
                     100000 * 0.22 +     // 22k
                     300000 * 0.24 +     // 72k
                     500000 * 0.32 +     // 160k
                     1000000 * 0.35;     // 350k
        // Total = 615k
        REQUIRE_THAT(strategy.calculate_tax(2000000.0, ctx, params), WithinAbs(615000.0, 1e-6));
    }
}

TEST_CASE("ProgressiveTaxStrategy - Edge cases", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,     0.10},
        {50000, 0.20}
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Zero income") {
        REQUIRE_THAT(strategy.calculate_tax(0.0, ctx, params), WithinAbs(0.0, 1e-9));
    }

    SECTION("Negative income") {
        REQUIRE_THAT(strategy.calculate_tax(-10000.0, ctx, params), WithinAbs(0.0, 1e-9));
    }

    SECTION("Very small income") {
        REQUIRE_THAT(strategy.calculate_tax(0.01, ctx, params), WithinAbs(0.001, 1e-9));
    }
}

TEST_CASE("ProgressiveTaxStrategy - Empty brackets", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets;
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(0.0, 1e-9));
}

TEST_CASE("ProgressiveTaxStrategy - Metadata", "[tax][progressive]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,     0.10},
        {50000, 0.20}
    };
    ProgressiveTaxStrategy strategy(brackets);

    REQUIRE(strategy.name() == "PROGRESSIVE");
    REQUIRE(strategy.description() == "Progressive tax with 2 brackets");
}

// ============================================================================
// MinimumTaxStrategy Tests
// ============================================================================

TEST_CASE("MinimumTaxStrategy - Regular tax higher", "[tax][minimum]") {
    auto regular = std::make_unique<FlatRateTaxStrategy>(0.21);
    auto alternative = std::make_unique<FlatRateTaxStrategy>(0.15);

    MinimumTaxStrategy strategy(std::move(regular), std::move(alternative));
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    // Regular: 21k, Alternative: 15k -> Choose 21k
    REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(21000.0, 1e-9));
}

TEST_CASE("MinimumTaxStrategy - Alternative tax higher", "[tax][minimum]") {
    auto regular = std::make_unique<FlatRateTaxStrategy>(0.15);
    auto alternative = std::make_unique<FlatRateTaxStrategy>(0.21);

    MinimumTaxStrategy strategy(std::move(regular), std::move(alternative));
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    // Regular: 15k, Alternative: 21k -> Choose 21k
    REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(21000.0, 1e-9));
}

TEST_CASE("MinimumTaxStrategy - Equal taxes", "[tax][minimum]") {
    auto regular = std::make_unique<FlatRateTaxStrategy>(0.20);
    auto alternative = std::make_unique<FlatRateTaxStrategy>(0.20);

    MinimumTaxStrategy strategy(std::move(regular), std::move(alternative));
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    REQUIRE_THAT(strategy.calculate_tax(100000.0, ctx, params), WithinAbs(20000.0, 1e-9));
}

TEST_CASE("MinimumTaxStrategy - With progressive strategies", "[tax][minimum]") {
    std::vector<ProgressiveTaxStrategy::Bracket> regular_brackets = {
        {0, 0.21}  // Flat 21%
    };
    auto regular = std::make_unique<ProgressiveTaxStrategy>(regular_brackets);

    std::vector<ProgressiveTaxStrategy::Bracket> alt_brackets = {
        {0,      0.10},
        {100000, 0.30}  // Lower base, higher top rate
    };
    auto alternative = std::make_unique<ProgressiveTaxStrategy>(alt_brackets);

    MinimumTaxStrategy strategy(std::move(regular), std::move(alternative));
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    SECTION("Low income - regular higher") {
        // Income = 50k
        // Regular: 50k * 0.21 = 10.5k
        // Alternative: 50k * 0.10 = 5k
        // Choose: 10.5k
        REQUIRE_THAT(strategy.calculate_tax(50000.0, ctx, params), WithinAbs(10500.0, 1e-9));
    }

    SECTION("High income - alternative higher") {
        // Income = 200k
        // Regular: 200k * 0.21 = 42k
        // Alternative: 100k*0.10 + 100k*0.30 = 10k + 30k = 40k
        // Choose: 42k (regular still higher)
        REQUIRE_THAT(strategy.calculate_tax(200000.0, ctx, params), WithinAbs(42000.0, 1e-9));
    }
}

TEST_CASE("MinimumTaxStrategy - Metadata", "[tax][minimum]") {
    auto regular = std::make_unique<FlatRateTaxStrategy>(0.21);
    auto alternative = std::make_unique<FlatRateTaxStrategy>(0.15);

    MinimumTaxStrategy strategy(std::move(regular), std::move(alternative));

    REQUIRE(strategy.name() == "MINIMUM_TAX");
    REQUIRE(strategy.description() == "Minimum tax (max of regular and alternative)");
}

// ============================================================================
// TaxEngine Tests
// ============================================================================

TEST_CASE("TaxEngine - Load default strategies", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);

    REQUIRE(engine.has_strategy("US_FEDERAL"));
    REQUIRE(engine.has_strategy("NO_TAX"));
    REQUIRE(engine.has_strategy("HIGH_TAX"));
    REQUIRE(engine.has_strategy("US_PROGRESSIVE"));
}

TEST_CASE("TaxEngine - Compute with US_FEDERAL", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    // US_FEDERAL is 21% flat rate
    REQUIRE_THAT(engine.compute_tax(100000.0, ctx, "US_FEDERAL"), WithinAbs(21000.0, 1e-9));
    REQUIRE_THAT(engine.compute_tax(50000.0, ctx, "US_FEDERAL"), WithinAbs(10500.0, 1e-9));
}

TEST_CASE("TaxEngine - Compute with NO_TAX", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    REQUIRE_THAT(engine.compute_tax(100000.0, ctx, "NO_TAX"), WithinAbs(0.0, 1e-9));
}

TEST_CASE("TaxEngine - Compute with HIGH_TAX", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    // HIGH_TAX is 35% flat rate
    REQUIRE_THAT(engine.compute_tax(100000.0, ctx, "HIGH_TAX"), WithinAbs(35000.0, 1e-9));
}

TEST_CASE("TaxEngine - Compute with US_PROGRESSIVE", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    // Income = 150k
    // Tax = 50k*0.10 + 50k*0.12 + 50k*0.22 = 22k
    REQUIRE_THAT(engine.compute_tax(150000.0, ctx, "US_PROGRESSIVE"), WithinAbs(22000.0, 1e-9));
}

TEST_CASE("TaxEngine - Unknown strategy throws", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    REQUIRE_THROWS_AS(
        engine.compute_tax(100000.0, ctx, "NONEXISTENT"),
        std::runtime_error
    );
}

TEST_CASE("TaxEngine - Register custom strategy", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);

    auto custom = std::make_unique<FlatRateTaxStrategy>(0.50);
    engine.register_strategy("CUSTOM_50", std::move(custom));

    REQUIRE(engine.has_strategy("CUSTOM_50"));

    Context ctx(1, 1, 1);
    REQUIRE_THAT(engine.compute_tax(100000.0, ctx, "CUSTOM_50"), WithinAbs(50000.0, 1e-9));
}

TEST_CASE("TaxEngine - Effective rate", "[tax][engine]") {
    database::DatabaseConnection db(":memory:");
    TaxEngine engine(db);
    Context ctx(1, 1, 1);

    SECTION("Flat rate - effective equals nominal") {
        double rate = engine.get_effective_rate(100000.0, ctx, "US_FEDERAL");
        REQUIRE_THAT(rate, WithinAbs(0.21, 1e-9));
    }

    SECTION("Progressive - effective below top rate") {
        // Income = 150k, Tax = 22k
        // Effective rate = 22k / 150k = 14.67%
        double rate = engine.get_effective_rate(150000.0, ctx, "US_PROGRESSIVE");
        REQUIRE_THAT(rate, WithinAbs(0.14666666, 1e-6));
    }

    SECTION("Zero income - zero rate") {
        double rate = engine.get_effective_rate(0.0, ctx, "US_FEDERAL");
        REQUIRE_THAT(rate, WithinAbs(0.0, 1e-9));
    }
}
