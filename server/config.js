// Exporting constants for easy import elsewhere
module.exports = {
  // Core Game Params
  MAX_ENERGY: 100,
  MIN_ENERGY: 0,
  BASE_ENERGY_DECAY_RATE: 0.5, // Energy points lost per second
  BASE_ENERGY_GAIN_PER_CLICK: 1, // Energy points gained per click

  // Zones & Win/Loss Timings
  SAFE_ZONE_MIN: 40, // Lower bound of the stable energy range
  SAFE_ZONE_MAX: 70, // Upper bound of the stable energy range
  COOP_WIN_DURATION_SECONDS: 60, // e.g., 1 minute total in safe zone to win
  DANGER_LOW_THRESHOLD: 20, // Below this is danger zone
  DANGER_HIGH_THRESHOLD: 85, // Above this is danger zone
  DANGER_TIME_LIMIT_SECONDS: 10, // Max continuous seconds allowed in danger zone

  // Game Loop
  GAME_LOOP_INTERVAL_MS: 500, // How often the game loop runs

  // Stabilize Action
  STABILIZE_DURATION_MS: 5000, // How long the effect lasts (5 seconds)
  STABILIZE_COOLDOWN_MS: 15000, // How long before player can use again (15 seconds)
  STABILIZE_DECAY_MULTIPLIER: 0.2, // Decay is slower during stabilize (e.g., 20% of normal)
  STABILIZE_GAIN_MULTIPLIER: 0.5, // Gain is less effective during stabilize (e.g., 50% of normal)

  // Steal Action
  STEAL_GRID_COST: 5, // How much energy is removed from the grid
  STEAL_STASH_GAIN: 2, // How much energy the player gains (less than cost)
  STEAL_COOLDOWN_MS: 10000, // Cooldown for stealing (10 seconds)
  STASH_WIN_TARGET: 25, // Energy needed in personal stash to win

  // Emergency Adjustment Action
  EMERGENCY_ADJUST_COOLDOWN_MS: 20000, // Cooldown for this action (20 seconds)
  EMERGENCY_BOOST_AMOUNT: 15, // Energy gained if used when < DANGER_LOW_THRESHOLD
  EMERGENCY_COOLANT_AMOUNT: 20, // Energy lost if used when > DANGER_HIGH_THRESHOLD
  // Penalty if used when NOT in danger zones (e.g., between 20 and 85)
  EMERGENCY_PENALTY_WRONG_ZONE: 5, // Small energy shift in the wrong direction (e.g., adds 5 if used below 85 but above 20)

  // Random Events
  EVENT_CHECK_INTERVAL_MS: 15000, // How often to check if a new event should start (15s)
  EVENT_CHANCE_PERCENT: 50, // Chance (0-100) of an event triggering on check
  EVENT_DURATION_MS: 10000, // How long events last (10s)
  EVENT_SURGE_DECAY_MULTIPLIER: 2.5, // Decay is much faster during surge
  EVENT_EFFICIENCY_GAIN_MULTIPLIER: 2.0, // Gain is doubled during efficiency drive
  EVENT_TYPES: ["surge", "efficiency"], // Available event types
};
