export function explicitReport(id, mission, round, value, previous) {
  if (!['complete','early'].includes(value)) return null;
  return {id: previous?.id || id, missionId:mission.id, mechanicsVersion:mission.mechanicsVersion, roundId:round?.id || null, value, revision:(previous?.revision || 0)+1};
}
