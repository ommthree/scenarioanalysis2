/**
 * @file test_unit_converter.cpp
 * @brief Unit tests for UnitConverter class
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "fx/fx_provider.h"
#include "core/unit_converter.h"

using Catch::Approx;
using namespace finmodel;
using namespace finmodel::core;
using namespace finmodel::database;
using namespace finmodel::fx;

TEST_CASE("UnitConverter - Static conversions (carbon)", "[unit][static][carbon]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("Base unit to base unit") {
        REQUIRE(converter.to_base_unit(100.0, "tCO2e") == Approx(100.0));
    }

    SECTION("Kilograms to tonnes") {
        // 1000 kg = 1 tonne
        REQUIRE(converter.to_base_unit(1000.0, "kgCO2e") == Approx(1.0));
        REQUIRE(converter.to_base_unit(500000.0, "kgCO2e") == Approx(500.0));
    }

    SECTION("Megatonnes to tonnes") {
        // 1 Mt = 1,000,000 tonnes
        REQUIRE(converter.to_base_unit(1.0, "MtCO2e") == Approx(1000000.0));
        REQUIRE(converter.to_base_unit(0.001, "MtCO2e") == Approx(1000.0));
        REQUIRE(converter.to_base_unit(0.0003, "MtCO2e") == Approx(300.0));
    }

    SECTION("Gigatonnes to tonnes") {
        // 1 Gt = 1,000,000,000 tonnes
        REQUIRE(converter.to_base_unit(0.000001, "GtCO2e") == Approx(1000.0));
    }
}

TEST_CASE("UnitConverter - Static conversions (mass)", "[unit][static][mass]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("Grams to kilograms") {
        REQUIRE(converter.to_base_unit(1000.0, "g") == Approx(1.0));
        REQUIRE(converter.to_base_unit(500.0, "g") == Approx(0.5));
    }

    SECTION("Tonnes to kilograms") {
        REQUIRE(converter.to_base_unit(1.0, "t") == Approx(1000.0));
        REQUIRE(converter.to_base_unit(0.05, "t") == Approx(50.0));
    }

    SECTION("Pounds to kilograms") {
        // 1 lb ≈ 0.453592 kg
        REQUIRE(converter.to_base_unit(1.0, "lb") == Approx(0.453592).margin(0.000001));
        REQUIRE(converter.to_base_unit(100.0, "lb") == Approx(45.3592).margin(0.0001));
    }
}

TEST_CASE("UnitConverter - Static conversions (energy)", "[unit][static][energy]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("MWh to kWh") {
        REQUIRE(converter.to_base_unit(1.0, "MWh") == Approx(1000.0));
        REQUIRE(converter.to_base_unit(0.5, "MWh") == Approx(500.0));
    }

    SECTION("GWh to kWh") {
        REQUIRE(converter.to_base_unit(1.0, "GWh") == Approx(1000000.0));
        REQUIRE(converter.to_base_unit(0.001, "GWh") == Approx(1000.0));
    }

    SECTION("GJ to kWh") {
        // 1 GJ ≈ 277.778 kWh
        REQUIRE(converter.to_base_unit(1.0, "GJ") == Approx(277.778).margin(0.001));
        REQUIRE(converter.to_base_unit(10.0, "GJ") == Approx(2777.78).margin(0.01));
    }
}

TEST_CASE("UnitConverter - Round-trip conversions", "[unit][roundtrip]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("kgCO2e round-trip") {
        double original = 123456.789;
        double in_base = converter.to_base_unit(original, "kgCO2e");
        double back = converter.from_base_unit(in_base, "kgCO2e");
        REQUIRE(back == Approx(original).margin(1e-6));
    }

    SECTION("MtCO2e round-trip") {
        double original = 0.123456;
        double in_base = converter.to_base_unit(original, "MtCO2e");
        double back = converter.from_base_unit(in_base, "MtCO2e");
        REQUIRE(back == Approx(original).margin(1e-9));
    }

    SECTION("MWh round-trip") {
        double original = 987.654;
        double in_base = converter.to_base_unit(original, "MWh");
        double back = converter.from_base_unit(in_base, "MWh");
        REQUIRE(back == Approx(original).margin(1e-6));
    }
}

TEST_CASE("UnitConverter - Direct conversion (same category)", "[unit][convert]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("kgCO2e to MtCO2e") {
        // 1,000,000,000 kg = 1 Mt
        REQUIRE(converter.convert(1000000000.0, "kgCO2e", "MtCO2e") == Approx(1.0));
        REQUIRE(converter.convert(500000000.0, "kgCO2e", "MtCO2e") == Approx(0.5));
    }

    SECTION("MWh to GWh") {
        REQUIRE(converter.convert(1000.0, "MWh", "GWh") == Approx(1.0));  // 1000 MWh = 1 GWh
        REQUIRE(converter.convert(5000.0, "MWh", "GWh") == Approx(5.0));  // 5000 MWh = 5 GWh
    }

    SECTION("t to kg (mass)") {
        REQUIRE(converter.convert(1.0, "t", "kg") == Approx(1000.0));
        REQUIRE(converter.convert(0.5, "t", "kg") == Approx(500.0));
    }
}

TEST_CASE("UnitConverter - Validation and error handling", "[unit][error]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("Unknown unit code") {
        REQUIRE_THROWS_AS(
            converter.to_base_unit(100.0, "INVALID_UNIT"),
            std::invalid_argument
        );
    }

    SECTION("Cross-category conversion") {
        // Cannot convert carbon to mass
        REQUIRE_THROWS_AS(
            converter.convert(100.0, "tCO2e", "kg"),
            std::invalid_argument
        );
    }

    SECTION("Valid unit check") {
        REQUIRE(converter.is_valid_unit("tCO2e"));
        REQUIRE(converter.is_valid_unit("kgCO2e"));
        REQUIRE(converter.is_valid_unit("EUR"));
        REQUIRE_FALSE(converter.is_valid_unit("INVALID"));
    }

    SECTION("Time-varying check") {
        REQUIRE_FALSE(converter.is_time_varying("tCO2e"));
        REQUIRE_FALSE(converter.is_time_varying("kgCO2e"));
        REQUIRE_FALSE(converter.is_time_varying("EUR"));  // EUR is base, static
        REQUIRE(converter.is_time_varying("USD"));
        REQUIRE(converter.is_time_varying("GBP"));
    }
}

TEST_CASE("UnitConverter - Metadata queries", "[unit][metadata]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);

    SECTION("Display symbols") {
        REQUIRE(converter.get_display_symbol("tCO2e") == "tCO2e");
        REQUIRE(converter.get_display_symbol("kgCO2e") == "kg");
        REQUIRE(converter.get_display_symbol("EUR") == "€");
        REQUIRE(converter.get_display_symbol("USD") == "$");
        REQUIRE(converter.get_display_symbol("GBP") == "£");
    }

    SECTION("Base units by category") {
        REQUIRE(converter.get_base_unit("CARBON") == "tCO2e");
        REQUIRE(converter.get_base_unit("CURRENCY") == "EUR");
        REQUIRE(converter.get_base_unit("MASS") == "kg");
        REQUIRE(converter.get_base_unit("ENERGY") == "kWh");
    }

    SECTION("Unit category") {
        REQUIRE(converter.get_category("tCO2e") == "CARBON");
        REQUIRE(converter.get_category("kgCO2e") == "CARBON");
        REQUIRE(converter.get_category("EUR") == "CURRENCY");
        REQUIRE(converter.get_category("kg") == "MASS");
        REQUIRE(converter.get_category("MWh") == "ENERGY");
    }
}

TEST_CASE("UnitConverter - Time-varying (currency) with FXProvider", "[unit][time-varying][fx]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    // Create FXProvider with test data
    auto fx_provider = std::make_shared<FXProvider>(db);

    // Insert test FX rates (using scenario_id = 1)
    db->execute_update(R"(
        INSERT OR REPLACE INTO fx_rate (scenario_id, from_currency, to_currency, period_id, rate)
        VALUES
        (1, 'USD', 'EUR', 1, 0.85),
        (1, 'USD', 'EUR', 2, 0.87),
        (1, 'USD', 'EUR', 3, 0.88),
        (1, 'GBP', 'EUR', 1, 1.15),
        (1, 'GBP', 'EUR', 2, 1.16),
        (1, 'GBP', 'EUR', 3, 1.17)
    )", {});

    UnitConverter converter(db, fx_provider);

    SECTION("Base currency (EUR) - static") {
        // EUR is base currency, should be static
        REQUIRE(converter.to_base_unit(100.0, "EUR") == Approx(100.0));
        REQUIRE_FALSE(converter.is_time_varying("EUR"));
    }

    SECTION("USD to EUR - period 1") {
        // $100 @ rate 0.85 = €85
        REQUIRE(converter.to_base_unit(100.0, "USD", 1) == Approx(85.0));
    }

    SECTION("USD to EUR - period 2 (rate changed)") {
        // $100 @ rate 0.87 = €87
        REQUIRE(converter.to_base_unit(100.0, "USD", 2) == Approx(87.0));
    }

    SECTION("USD to EUR - period 3") {
        // $100 @ rate 0.88 = €88
        REQUIRE(converter.to_base_unit(100.0, "USD", 3) == Approx(88.0));
    }

    SECTION("GBP to EUR - period 1") {
        // £100 @ rate 1.15 = €115
        REQUIRE(converter.to_base_unit(100.0, "GBP", 1) == Approx(115.0));
    }

    SECTION("GBP to EUR - period 2 (rate changed)") {
        // £100 @ rate 1.16 = €116
        REQUIRE(converter.to_base_unit(100.0, "GBP", 2) == Approx(116.0));
    }

    SECTION("Missing period_id for time-varying") {
        // Should throw: period_id required for USD
        REQUIRE_THROWS_AS(
            converter.to_base_unit(100.0, "USD"),
            std::invalid_argument
        );
    }

    SECTION("From base unit (EUR to USD)") {
        // €100 → USD in period 1: €100 / 0.85 = $117.647
        REQUIRE(converter.from_base_unit(100.0, "USD", 1) == Approx(117.647).margin(0.001));

        // €100 → USD in period 2: €100 / 0.87 = $114.943
        REQUIRE(converter.from_base_unit(100.0, "USD", 2) == Approx(114.943).margin(0.001));
    }
}

TEST_CASE("UnitConverter - Error: No FXProvider for time-varying", "[unit][error][fx]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    UnitConverter converter(db, nullptr);  // No FX provider

    SECTION("Should throw when converting time-varying without FXProvider") {
        REQUIRE_THROWS(
            converter.to_base_unit(100.0, "USD", 1)
        );
    }
}

// Benchmark tests commented out - require Catch2 benchmark support
// TEST_CASE("UnitConverter - Performance (static conversions)", "[unit][performance][!benchmark]") {
//     auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
//     UnitConverter converter(db, nullptr);
//
//     BENCHMARK("Convert kgCO2e to base (cached)") {
//         return converter.to_base_unit(12345.67, "kgCO2e");
//     };
//
//     BENCHMARK("Convert MtCO2e to base (cached)") {
//         return converter.to_base_unit(0.123, "MtCO2e");
//     };
//
//     BENCHMARK("Direct conversion kgCO2e → MtCO2e") {
//         return converter.convert(1000000000.0, "kgCO2e", "MtCO2e");
//     };
// }
