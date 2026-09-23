export function initialMedia() { return {preference:false, playback:'idle', generation:0}; }
export function invalidateMedia(media, reset=false) { return {...media, generation:media.generation+1, playback:'interrupted', preference:reset?false:media.preference}; }
