<?php
/**
 * Business Intelligence thresholds.
 *
 * Every rule used by the Decision Insights panel reads from here so the
 * Manager can tune the module without touching query code.
 */
return [
    // Receivables
    'overdue_days' => 60,          // an invoice older than this is "overdue"
    'large_debt_min' => 50000.0,   // MWK; anything above is worth a phone call

    // Stock
    'dead_stock_days' => 90,       // no sales in this window = dead stock
    'slow_stock_days' => 30,       // few sales in this window = slow moving
    'slow_moving_max_units' => 2,  // sold units at or below this = slow
    'fast_moving_min_units' => 5,  // sold units at or above this = fast
    'low_margin_pct' => 15.0,      // flag products selling below this margin

    // Customers
    'inactive_days' => 90,         // no activity in this window = follow up
    'repeat_min_activity' => 2,    // >= this many jobs/orders = repeat customer

    // Comparison
    'revenue_drop_pct' => 10.0,    // flag a period fall bigger than this

    // Funnels
    'low_conversion_pct' => 50.0,  // flag order conversion below this
];
