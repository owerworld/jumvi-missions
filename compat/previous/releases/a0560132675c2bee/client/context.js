export const screens = Object.freeze(['entry','discovery','help','active','interrupted','stopped','report','attribution','record-result','guest','group','availability','recovery','adult','management','returning','new-player']);
export function contextMatches(state, event) { return event.revision === state.revision && event.documentId === state.documentId; }
export function contextKey(s) { return [s.documentId,s.revision,s.mission?.id,s.mission?.mechanicsVersion,s.locale].join(':'); }
