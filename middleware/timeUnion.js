function getOverlappingTimes(...availabilities) {
  if (availabilities.length === 0) return {};

  const overlap = (intervals1, intervals2) => {
    const result = [];
    for (const i1 of intervals1) {
      for (const i2 of intervals2) {
        const start = Math.max(i1.start, i2.start);
        const end = Math.min(i1.end, i2.end);
        if (start < end) {
          result.push({ start, end });
        }
      }
    }
    return result;
  };

  const intersectAvailabilities = (avail1, avail2) => {
    const overlappingAvailability = {};
    for (const day of Object.keys(avail1)) {
      if (avail2[day]) {
        overlappingAvailability[day] = overlap(avail1[day], avail2[day]);
      }
    }
    return overlappingAvailability;
  };

  let combinedAvailability = availabilities[0];

  for (let i = 1; i < availabilities.length; i++) {
    combinedAvailability = intersectAvailabilities(
      combinedAvailability,
      availabilities[i]
    );
  }

  return combinedAvailability;
}

module.exports = getOverlappingTimes;
