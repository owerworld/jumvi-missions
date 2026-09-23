export function createRound(id, mission) { return {id, missionId:mission.id, mechanicsVersion:mission.mechanicsVersion, state:'active'}; }
export function changeRound(round, state) { return round ? {...round, state} : null; }
