// Only key presence is inspected. Never parse/import legacy identities or success claims.
const suffixes=new Set(['missions_done_v3','streak_count_v1','streak_best_v1','streak_last_v1','badges_unlocked_v1','streak_freeze_v1','daily_challenge_v1','daily_date_v1','daily_id_v1','daily_n_v1','age_v2','attempts_v1','skips_v1','avatar_v1','cert_id_v1','cert_name_v1','high_scores_v1','mission_coach_runs_v1','teams_v1','active_team_v1','today_done_ids_v1']);
const exact=new Set(['jumvi_profiles_v1','jumvi_active_profile_v1','jumvi_profile_seq_v1','jumvi_family_daily_star_v1','jumvi_hub_stars','jumvi_profile']);
export function personalLegacyKey(k){if(exact.has(k))return true;const m=/^jumvi_(?:(?:p\d+_team_t\d+_|team_s_p\d+_p\d+_|p\d+_))?(.+)$/.exec(k);return !!m&&suffixes.has(m[1]);}
export function legacyPresence(){try{return {available:true,count:Object.keys(localStorage).filter(personalLegacyKey).length};}catch{return {available:false,count:0};}}
export function deleteLegacy(){
 // Explicit all-local deletion only; preferences and unrelated origin data are preserved.
 for(const k of Object.keys(localStorage))if(personalLegacyKey(k))localStorage.removeItem(k);
 sessionStorage.removeItem('jumvi_team_setup_resume_v1');
 if(legacyPresence().count)throw Error('legacy-delete-incomplete');
}
