// Une roue par salon, stockée en mémoire (perdue si le bot redémarre pendant une roue ouverte).

const wheels = new Map();

function createWheel(channelId, data) {
  const wheel = {
    channelId,
    participants: [],
    launched: false,
    ...data,
  };
  wheels.set(channelId, wheel);
  return wheel;
}

function getWheel(channelId) {
  return wheels.get(channelId);
}

function deleteWheel(channelId) {
  wheels.delete(channelId);
}

module.exports = { createWheel, getWheel, deleteWheel };
