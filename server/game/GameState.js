// Central repository for the game's current state
const gameState = {
  energyLevel: 50, // Start at 50%
  players: {}, // Object to store player data, keyed by socket.id
  cumulativeStableTimeMs: 0,
  continuousTimeInDangerLowMs: 0,
  continuousTimeInDangerHighMs: 0,
  gameIsRunning: true, // Master flag for active gameplay
  finalGameOutcome: { reason: null, winnerId: null }, // Stores the reason the game ended
  stabilizeEffectEndTime: 0, // Timestamp when the current stabilize effect ends
  activeEvent: { type: null, endTime: 0 }, // Tracks current event { type: 'surge'/'efficiency', endTime: timestamp }

  // --- Methods to modify state (optional but good practice) ---
  reset: function () {
    console.log("GameState reset initiated...");
    this.energyLevel = 50;
    this.cumulativeStableTimeMs = 0;
    this.continuousTimeInDangerLowMs = 0;
    this.continuousTimeInDangerHighMs = 0;
    this.gameIsRunning = true;
    this.finalGameOutcome = { reason: null, winnerId: null };
    this.stabilizeEffectEndTime = 0;
    this.activeEvent = { type: null, endTime: 0 };

    // Iterate and reset player stats instead of clearing the players object
    console.log(
      `Resetting stats for ${Object.keys(this.players).length} players.`
    );
    for (const playerId in this.players) {
      const player = this.players[playerId];
      if (player) {
        player.stabilizeCooldownEnd = 0;
        player.stealGridCooldownEnd = 0;
        player.personalStash = 0;
        player.emergencyAdjustCooldownEnd = 0;
        // Reset any other player-specific stats here
      }
    }

    console.log("GameState reset complete.");
  },

  addPlayer: function (player) {
    if (player && player.id) {
      this.players[player.id] = player;
      console.log(
        `Player ${player.id} added to GameState. Total: ${
          Object.keys(this.players).length
        }`
      );
    }
  },

  removePlayer: function (playerId) {
    if (this.players[playerId]) {
      delete this.players[playerId];
      console.log(
        `Player ${playerId} removed from GameState. Total: ${
          Object.keys(this.players).length
        }`
      );
    }
  },

  getPlayer: function (playerId) {
    return this.players[playerId];
  },

  setGameOver: function (reason, winnerId = null) {
    if (!this.gameIsRunning) return false; // Already over
    this.gameIsRunning = false;
    this.finalGameOutcome = { reason: reason, winnerId: winnerId };
    console.log(
      `GameState set to Game Over. Reason: ${reason}, Winner: ${winnerId}`
    );
    return true; // Indicate game was successfully ended
  },

  getCurrentSnapshot: function (configRef) {
    // Renamed config to configRef to avoid conflict if config is ever added to gameState itself
    return {
      energyLevel: this.energyLevel,
      playerCount: Object.keys(this.players).length,
      coopWinTargetSeconds: configRef.COOP_WIN_DURATION_SECONDS,
      coopWinProgressSeconds: Math.floor(this.cumulativeStableTimeMs / 1000),
      gameIsRunning: this.gameIsRunning,
      finalOutcomeReason: this.finalGameOutcome.reason,
      finalOutcomeWinner: this.finalGameOutcome.winnerId,
      activeEventType: this.activeEvent.type,
      activeEventEndTime: this.activeEvent.endTime,
      // Send necessary config values the client needs (like stash target)
      stashWinTarget: configRef.STASH_WIN_TARGET,
    };
  },
};

module.exports = gameState; // Export the single gameState object
