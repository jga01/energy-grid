// Using a simple factory function for now, could be a Class too
function createPlayer(id) {
  return {
    id: id,
    stabilizeCooldownEnd: 0, // Timestamp when their stabilize cooldown ends
    stealGridCooldownEnd: 0, // Timestamp when their steal cooldown ends
    personalStash: 0, // Current amount of stolen energy
    // Add cooldown for emergency adjust +++
    emergencyAdjustCooldownEnd: 0, // Timestamp when emergency adjust cooldown ends
  };
}

module.exports = { createPlayer };
