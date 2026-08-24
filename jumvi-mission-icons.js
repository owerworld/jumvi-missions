/* ============================================================
 * jumvi-mission-icons.js  —  36 motion-diagram icons (English)
 *
 * Each value is ready-to-inject markup (mostly inline <svg>, a few
 * multi-panel HTML blocks). Pair with jumvi-icons.css.
 *
 * USAGE
 *   import { MISSION_ICONS, MISSION_NAMES } from './jumvi-mission-icons.js';
 *   const el = document.querySelector('#mission-icon');
 *   el.classList.add('jmv');
 *   el.innerHTML = MISSION_ICONS[missionId];   // missionId = 1..36
 *
 * REQUIREMENTS
 *   1. Include jumvi-icons.css (defines colors + .jmv wrapper).
 *   2. Render INSIDE an element with class "jmv".
 *   3. Panel missions (13,19,20,22,23,27,28) use Tabler outline icons —
 *      load @tabler/icons-webfont once (see jumvi-icons.css header).
 * ============================================================ */

// FIX: project uses classic scripts (no type=module) — expose as globals on window
const MISSION_NAMES = {
  "1": "Speed Demon",
  "2": "Red Light Green Light",
  "3": "Quick Hit",
  "4": "Switch Hands",
  "5": "Statue Mode",
  "6": "Number Echo",
  "7": "Rainbow Throws",
  "8": "Landing Strip",
  "9": "Distance Ladder",
  "10": "Power Step",
  "11": "Sky Glide",
  "12": "Chest Target",
  "13": "Silent Mode",
  "14": "Tempo Master",
  "15": "Spotlight Eyes",
  "16": "1-2-3 Throw!",
  "17": "Mirror Mode",
  "18": "Count to 10",
  "19": "Circle Round",
  "20": "Crab Relay",
  "21": "Captain Says",
  "22": "Spinning Team",
  "23": "Switch Partners",
  "24": "2v2 Shared Score",
  "25": "Easy Catch",
  "26": "Tiny Space",
  "27": "Secret Signal",
  "28": "Mind Reader",
  "29": "Stuck-Foot Catch",
  "30": "Left or Right!",
  "31": "Cloud Chaser",
  "32": "Home Base",
  "33": "How Far Can You Throw?",
  "34": "Chase the Ball!",
  "35": "Sky High Jump",
  "36": "Marathon Rally"
};

const MISSION_PACKS = {
  "1": "Lightning Hands",
  "2": "Lightning Hands",
  "3": "Lightning Hands",
  "4": "Lightning Hands",
  "5": "Lightning Hands",
  "6": "Lightning Hands",
  "7": "Bullseye",
  "8": "Bullseye",
  "9": "Bullseye",
  "10": "Bullseye",
  "11": "Bullseye",
  "12": "Bullseye",
  "13": "Zen Mode",
  "14": "Zen Mode",
  "15": "Zen Mode",
  "16": "Zen Mode",
  "17": "Zen Mode",
  "18": "Zen Mode",
  "19": "Team Up",
  "20": "Team Up",
  "21": "Team Up",
  "22": "Team Up",
  "23": "Team Up",
  "24": "Team Up",
  "25": "Indoor Fun",
  "26": "Indoor Fun",
  "27": "Indoor Fun",
  "28": "Indoor Fun",
  "29": "Indoor Fun",
  "30": "Indoor Fun",
  "31": "Outdoor",
  "32": "Outdoor",
  "33": "Outdoor",
  "34": "Outdoor",
  "35": "Outdoor",
  "36": "Outdoor"
};

const MISSION_ICONS = {
  1: `<svg viewBox="0 0 380 150" role="img" aria-label="Speed Demon">
      <defs><marker id="g1ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="50" y1="120" x2="330" y2="120" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="110" cy="48" r="9"/><line x1="110" y1="57" x2="110" y2="90"/><line x1="110" y1="90" x2="99" y2="116"/><line x1="110" y1="90" x2="121" y2="116"/><line x1="110" y1="64" x2="133" y2="44"/><line x1="110" y1="66" x2="92" y2="80"/><line x1="92" y1="80" x2="86" y2="92"/>
      <circle cx="270" cy="48" r="9"/><line x1="270" y1="57" x2="270" y2="90"/><line x1="270" y1="90" x2="259" y2="116"/><line x1="270" y1="90" x2="281" y2="116"/><line x1="270" y1="64" x2="251" y2="46"/><line x1="251" y1="46" x2="246" y2="34"/><line x1="270" y1="66" x2="288" y2="82"/>
      </g>
      <ellipse cx="83" cy="98" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="243" cy="26" rx="8" ry="10" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="112" cy="46" r="1.3" fill="var(--color-text-secondary)"/><circle cx="116" cy="46" r="1.3" fill="var(--color-text-secondary)"/>
      <path d="M111 52 Q114 54 117 52" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="266" cy="45" r="1.3" fill="var(--color-text-secondary)"/><circle cx="271" cy="46" r="1.3" fill="var(--color-text-secondary)"/>
      <circle cx="269" cy="52" r="1.1" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.1"/>
      <path d="M138 40 Q190 12 241 28" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g1ar)"/>
      <circle cx="228" cy="24" r="4" fill="#EF9F27" opacity="0.3"/><circle cx="190" cy="17" r="5" fill="#EF9F27" opacity="0.55"/><circle cx="135" cy="42" r="6" fill="#EF9F27"/>
      <text x="110" y="140" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">Throws by hand</text>
      <text x="270" y="140" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">Catches with paddle</text>
      </svg>`,
  2: `<svg width="100%" viewBox="0 0 380 156" role="img"><title>Red Light Green Light</title><desc>Red Light Green Light</desc>
<line x1="50" y1="120" x2="330" y2="120" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="#378ADD" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="110" cy="48" r="9"/><line x1="110" y1="57" x2="110" y2="90"/><line x1="110" y1="90" x2="104" y2="116"/><line x1="110" y1="90" x2="116" y2="116"/><line x1="110" y1="64" x2="133" y2="46"/><line x1="110" y1="66" x2="92" y2="80"/><line x1="92" y1="80" x2="86" y2="92"/>
<circle cx="270" cy="48" r="9"/><line x1="270" y1="57" x2="270" y2="90"/><line x1="270" y1="90" x2="264" y2="116"/><line x1="270" y1="90" x2="276" y2="116"/><line x1="270" y1="64" x2="251" y2="46"/><line x1="251" y1="46" x2="246" y2="34"/><line x1="270" y1="66" x2="288" y2="82"/>
</g>
<ellipse cx="83" cy="98" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="243" cy="26" rx="8" ry="10" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<g stroke="#378ADD" stroke-width="1.6" stroke-linecap="round">
<line x1="110" y1="22" x2="110" y2="34"/><line x1="104" y1="25" x2="116" y2="31"/><line x1="116" y1="25" x2="104" y2="31"/>
<line x1="270" y1="22" x2="270" y2="34"/><line x1="264" y1="25" x2="276" y2="31"/><line x1="276" y1="25" x2="264" y2="31"/>
<line x1="174" y1="20" x2="178" y2="20"/><line x1="176" y1="18" x2="176" y2="22"/><line x1="202" y1="20" x2="206" y2="20"/><line x1="204" y1="18" x2="204" y2="22"/>
</g>
<circle cx="108" cy="46" r="1.3" fill="#378ADD"/><circle cx="112" cy="46" r="1.3" fill="#378ADD"/><circle cx="110" cy="54" r="1.3" fill="none" stroke="#378ADD" stroke-width="1.2"/>
<circle cx="268" cy="46" r="1.3" fill="#378ADD"/><circle cx="272" cy="46" r="1.3" fill="#378ADD"/><circle cx="270" cy="54" r="1.3" fill="none" stroke="#378ADD" stroke-width="1.2"/>
<circle cx="190" cy="28" r="6" fill="#EF9F27"/>
<circle cx="96" cy="133" r="3.5" fill="#639922"/><text class="ts" x="104" y="137" text-anchor="start">Green light: everyone plays</text>
<circle cx="96" cy="145" r="3.5" fill="#E24B4A"/><text class="ts" x="104" y="149" text-anchor="start">Red light: everyone FREEZES</text>
</svg>`,
  3: `<svg viewBox="0 0 380 160" role="img" aria-label="Quick Hit">
      <defs><marker id="c3ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-border-secondary)" stroke-width="1"><rect x="14" y="10" width="160" height="142" rx="10"/><rect x="206" y="10" width="160" height="142" rx="10"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="94" cy="54" r="9"/><line x1="94" y1="63" x2="94" y2="96"/><line x1="94" y1="96" x2="85" y2="120"/><line x1="94" y1="96" x2="103" y2="120"/><line x1="94" y1="70" x2="110" y2="54"/><line x1="110" y1="54" x2="115" y2="45"/><line x1="94" y1="72" x2="106" y2="48"/></g>
      <ellipse cx="118" cy="39" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <g stroke="#EF9F27" stroke-width="1.8" stroke-linecap="round"><line x1="113" y1="44" x2="108" y2="40"/><line x1="114" y1="42" x2="111" y2="36"/><line x1="114" y1="48" x2="110" y2="52"/></g>
      <circle cx="92" cy="52" r="1.3" fill="var(--color-text-secondary)"/><circle cx="96" cy="52" r="1.3" fill="var(--color-text-secondary)"/>
      <text x="94" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">1. HIT</text>
      <line x1="180" y1="80" x2="202" y2="80" stroke="var(--color-text-secondary)" stroke-width="2" marker-end="url(#c3ar)"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="286" cy="54" r="9"/><line x1="286" y1="63" x2="286" y2="96"/><line x1="286" y1="96" x2="277" y2="120"/><line x1="286" y1="96" x2="295" y2="120"/><line x1="286" y1="70" x2="302" y2="54"/><line x1="302" y1="54" x2="307" y2="45"/><line x1="286" y1="72" x2="272" y2="86"/></g>
      <ellipse cx="310" cy="39" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <path d="M252 44 Q285 26 309 33" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#c3ar)"/>
      <circle cx="310" cy="30" r="6" fill="#EF9F27"/>
      <circle cx="284" cy="52" r="1.3" fill="var(--color-text-secondary)"/><circle cx="288" cy="52" r="1.3" fill="var(--color-text-secondary)"/>
      <path d="M283 58 Q286 60 289 58" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <text x="286" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">2. CATCH</text>
      </svg>`,
  4: `<svg viewBox="0 0 380 160" role="img" aria-label="Switch Hands">
      <defs><marker id="c4ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-border-secondary)" stroke-width="1"><rect x="14" y="10" width="160" height="142" rx="10"/><rect x="206" y="10" width="160" height="142" rx="10"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="94" cy="56" r="9"/><line x1="94" y1="65" x2="94" y2="98"/><line x1="94" y1="98" x2="85" y2="122"/><line x1="94" y1="98" x2="103" y2="122"/><line x1="94" y1="72" x2="112" y2="56"/><line x1="112" y1="56" x2="117" y2="47"/><line x1="94" y1="74" x2="80" y2="88"/></g>
      <ellipse cx="120" cy="41" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="120" cy="32" r="5" fill="#EF9F27"/>
      <circle cx="92" cy="54" r="1.3" fill="var(--color-text-secondary)"/><circle cx="96" cy="54" r="1.3" fill="var(--color-text-secondary)"/><path d="M91 60 Q94 62 97 60" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <text x="94" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">1. Catch with this hand</text>
      <g stroke="var(--color-text-secondary)" stroke-width="1.8" stroke-linecap="round"><line x1="183" y1="78" x2="199" y2="78" marker-end="url(#c4ar)"/><line x1="199" y1="86" x2="183" y2="86" marker-end="url(#c4ar)"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="286" cy="56" r="9"/><line x1="286" y1="65" x2="286" y2="98"/><line x1="286" y1="98" x2="277" y2="122"/><line x1="286" y1="98" x2="295" y2="122"/><line x1="286" y1="72" x2="268" y2="56"/><line x1="268" y1="56" x2="263" y2="47"/><line x1="286" y1="74" x2="300" y2="88"/></g>
      <ellipse cx="260" cy="41" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="260" cy="32" r="5" fill="#EF9F27"/>
      <circle cx="284" cy="54" r="1.3" fill="var(--color-text-secondary)"/><circle cx="288" cy="54" r="1.3" fill="var(--color-text-secondary)"/><path d="M283 60 Q286 62 289 60" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <text x="286" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">2. Switch to the other hand</text>
      </svg>`,
  5: `<svg viewBox="0 0 380 160" role="img" aria-label="Statue Mode">
      <defs><marker id="c5ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-border-secondary)" stroke-width="1"><rect x="14" y="10" width="160" height="142" rx="10"/><rect x="206" y="10" width="160" height="142" rx="10"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="94" cy="54" r="9"/><line x1="94" y1="63" x2="94" y2="96"/><line x1="94" y1="96" x2="85" y2="120"/><line x1="94" y1="96" x2="103" y2="120"/><line x1="94" y1="70" x2="110" y2="54"/><line x1="110" y1="54" x2="115" y2="45"/><line x1="94" y1="72" x2="80" y2="86"/></g>
      <ellipse cx="118" cy="39" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="118" cy="30" r="6" fill="#EF9F27"/>
      <circle cx="92" cy="52" r="1.3" fill="var(--color-text-secondary)"/><circle cx="96" cy="52" r="1.3" fill="var(--color-text-secondary)"/><path d="M91 58 Q94 60 97 58" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <text x="94" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">1. CATCH</text>
      <line x1="180" y1="80" x2="202" y2="80" stroke="var(--color-text-secondary)" stroke-width="2" marker-end="url(#c5ar)"/>
      <g fill="none" stroke="#378ADD" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="286" cy="54" r="9"/><line x1="286" y1="63" x2="286" y2="96"/><line x1="286" y1="96" x2="282" y2="120"/><line x1="286" y1="96" x2="290" y2="120"/><line x1="286" y1="70" x2="302" y2="54"/><line x1="302" y1="54" x2="307" y2="45"/><line x1="286" y1="72" x2="272" y2="84"/></g>
      <ellipse cx="310" cy="39" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="310" cy="30" r="6" fill="#EF9F27"/>
      <g stroke="#378ADD" stroke-width="1.6" stroke-linecap="round"><line x1="286" y1="22" x2="286" y2="34"/><line x1="280" y1="25" x2="292" y2="31"/><line x1="292" y1="25" x2="280" y2="31"/></g>
      <circle cx="284" cy="52" r="1.3" fill="#378ADD"/><circle cx="288" cy="52" r="1.3" fill="#378ADD"/><circle cx="286" cy="59" r="1.3" fill="none" stroke="#378ADD" stroke-width="1.2"/>
      <text x="286" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">2. FREEZE 2 sec</text>
      </svg>`,
  6: `<svg viewBox="0 0 380 150" role="img" aria-label="Number Echo">
      <defs><marker id="c6ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="50" y1="120" x2="330" y2="120" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="110" cy="48" r="9"/><line x1="110" y1="57" x2="110" y2="90"/><line x1="110" y1="90" x2="99" y2="116"/><line x1="110" y1="90" x2="121" y2="116"/><line x1="110" y1="64" x2="133" y2="44"/><line x1="110" y1="66" x2="92" y2="80"/><line x1="92" y1="80" x2="86" y2="92"/>
      <circle cx="270" cy="48" r="9"/><line x1="270" y1="57" x2="270" y2="90"/><line x1="270" y1="90" x2="259" y2="116"/><line x1="270" y1="90" x2="281" y2="116"/><line x1="270" y1="64" x2="251" y2="46"/><line x1="251" y1="46" x2="246" y2="34"/><line x1="270" y1="66" x2="288" y2="82"/></g>
      <ellipse cx="83" cy="98" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="243" cy="26" rx="8" ry="10" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="112" cy="46" r="1.3" fill="var(--color-text-secondary)"/><circle cx="116" cy="46" r="1.3" fill="var(--color-text-secondary)"/><path d="M111 52 Q114 54 117 52" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="266" cy="45" r="1.3" fill="var(--color-text-secondary)"/><circle cx="271" cy="46" r="1.3" fill="var(--color-text-secondary)"/>
      <path d="M138 40 Q190 14 241 28" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#c6ar)"/>
      <circle cx="190" cy="17" r="5" fill="#EF9F27" opacity="0.5"/><circle cx="135" cy="42" r="6" fill="#EF9F27"/>
      <g fill="var(--color-background-primary)" stroke="var(--color-text-secondary)" stroke-width="1.4"><rect x="58" y="12" width="30" height="22" rx="7"/><polygon points="76,33 86,33 88,44" stroke="none"/></g>
      <text x="73" y="28" text-anchor="middle" font-size="14" font-weight="500" fill="var(--color-text-secondary)">3</text>
      <g fill="var(--color-background-primary)" stroke="var(--color-text-secondary)" stroke-width="1.4"><rect x="292" y="12" width="30" height="22" rx="7"/><polygon points="294,33 304,33 292,44" stroke="none"/></g>
      <text x="307" y="28" text-anchor="middle" font-size="14" font-weight="500" fill="var(--color-text-secondary)">3</text>
      <text x="190" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">Call a number → partner repeats it</text>
      </svg>`,
  7: `<svg viewBox="0 0 380 158" role="img" aria-label="Rainbow Throws">
      <defs><marker id="c7ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="40" y1="128" x2="340" y2="128" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="96" cy="58" r="9"/><line x1="96" y1="67" x2="96" y2="100"/><line x1="96" y1="100" x2="85" y2="126"/><line x1="96" y1="100" x2="107" y2="126"/><line x1="96" y1="72" x2="116" y2="52"/><line x1="96" y1="74" x2="80" y2="88"/><line x1="80" y1="88" x2="74" y2="100"/>
      <circle cx="284" cy="58" r="9"/><line x1="284" y1="67" x2="284" y2="100"/><line x1="284" y1="100" x2="273" y2="126"/><line x1="284" y1="100" x2="295" y2="126"/><line x1="284" y1="72" x2="266" y2="50"/><line x1="266" y1="50" x2="261" y2="40"/><line x1="284" y1="74" x2="300" y2="90"/></g>
      <ellipse cx="71" cy="106" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="257" cy="32" rx="8" ry="10" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="94" cy="56" r="1.3" fill="var(--color-text-secondary)"/><circle cx="98" cy="56" r="1.3" fill="var(--color-text-secondary)"/><path d="M93 62 Q96 64 99 62" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="280" cy="55" r="1.3" fill="var(--color-text-secondary)"/><circle cx="285" cy="56" r="1.3" fill="var(--color-text-secondary)"/>
      <path d="M120 48 Q190 8 255 34" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#c7ar)"/>
      <circle cx="188" cy="16" r="5" fill="#EF9F27" opacity="0.5"/><circle cx="118" cy="50" r="6" fill="#EF9F27"/>
      <line x1="110" y1="138" x2="270" y2="138" stroke="var(--color-text-secondary)" stroke-width="1.4" marker-start="url(#c7ar)" marker-end="url(#c7ar)"/>
      <text x="190" y="152" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">5 kid steps</text>
      </svg>`,
  8: `<svg viewBox="0 0 380 150" role="img" aria-label="Landing Strip">
      <defs><marker id="c8ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="40" y1="124" x2="340" y2="124" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="96" cy="52" r="9"/><line x1="96" y1="61" x2="96" y2="94"/><line x1="96" y1="94" x2="85" y2="120"/><line x1="96" y1="94" x2="107" y2="120"/><line x1="96" y1="66" x2="114" y2="48"/><line x1="96" y1="68" x2="80" y2="82"/><line x1="80" y1="82" x2="75" y2="93"/>
      <circle cx="284" cy="52" r="9"/><line x1="284" y1="61" x2="284" y2="94"/><line x1="284" y1="94" x2="273" y2="120"/><line x1="284" y1="94" x2="295" y2="120"/><line x1="284" y1="68" x2="258" y2="78"/><line x1="284" y1="70" x2="300" y2="86"/><line x1="258" y1="78" x2="252" y2="80"/></g>
      <ellipse cx="72" cy="99" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="240" cy="80" rx="16" ry="5" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="94" cy="50" r="1.3" fill="var(--color-text-secondary)"/><circle cx="98" cy="50" r="1.3" fill="var(--color-text-secondary)"/><path d="M93 56 Q96 58 99 56" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="280" cy="50" r="1.3" fill="var(--color-text-secondary)"/><circle cx="285" cy="51" r="1.3" fill="var(--color-text-secondary)"/>
      <path d="M118 44 Q182 22 238 73" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#c8ar)"/>
      <circle cx="180" cy="25" r="5" fill="#EF9F27" opacity="0.5"/><circle cx="116" cy="46" r="6" fill="#EF9F27"/>
      <circle cx="240" cy="71" r="6" fill="#EF9F27"/>
      <g stroke="var(--color-text-secondary)" stroke-width="1.4" stroke-linecap="round" opacity="0.7"><line x1="226" y1="88" x2="232" y2="88"/><line x1="248" y1="88" x2="254" y2="88"/></g>
      <text x="190" y="142" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">Hold the paddle flat and still — the ball sticks itself</text>
      </svg>`,
  9: `<svg width="100%" viewBox="0 0 380 222" role="img"><title>Distance Ladder</title><desc>Distance Ladder</desc>
<defs><marker id="g9c" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="g9d" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>

<g fill="none" stroke="var(--s)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="150" cy="18" r="7"/><line x1="150" y1="25" x2="150" y2="43"/><line x1="150" y1="43" x2="144" y2="58"/><line x1="150" y1="43" x2="156" y2="58"/><line x1="150" y1="30" x2="139" y2="40"/><line x1="139" y1="40" x2="135" y2="47"/><line x1="150" y1="28" x2="163" y2="16"/>
<circle cx="230" cy="18" r="7"/><line x1="230" y1="25" x2="230" y2="43"/><line x1="230" y1="43" x2="224" y2="58"/><line x1="230" y1="43" x2="236" y2="58"/><line x1="230" y1="28" x2="217" y2="18"/><line x1="217" y1="18" x2="214" y2="12"/><line x1="230" y1="30" x2="241" y2="40"/></g>
<ellipse cx="132" cy="52" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/><ellipse cx="212" cy="10" rx="6" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
<path d="M167 14 Q190 4 209 10" fill="none" stroke="#EF9F27" stroke-width="1.9" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g9c)"/><circle cx="165" cy="14" r="5" fill="#EF9F27"/>
<circle cx="148" cy="16" r="1.1" fill="var(--s)"/><circle cx="152" cy="16" r="1.1" fill="var(--s)"/><circle cx="227" cy="16" r="1.1" fill="var(--s)"/><circle cx="231" cy="17" r="1.1" fill="var(--s)"/>
<line x1="156" y1="62" x2="224" y2="62" stroke="var(--s)" stroke-width="1.2" opacity="0.55" marker-start="url(#g9d)" marker-end="url(#g9d)"/>
<circle cx="24" cy="34" r="10" fill="none" stroke="var(--s)" stroke-width="1.5"/><text class="ts" x="24" y="38" text-anchor="middle">1</text>

<g fill="none" stroke="var(--s)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="120" cy="88" r="7"/><line x1="120" y1="95" x2="120" y2="113"/><line x1="120" y1="113" x2="114" y2="128"/><line x1="120" y1="113" x2="126" y2="128"/><line x1="120" y1="100" x2="109" y2="110"/><line x1="109" y1="110" x2="105" y2="117"/><line x1="120" y1="98" x2="133" y2="86"/>
<circle cx="260" cy="88" r="7"/><line x1="260" y1="95" x2="260" y2="113"/><line x1="260" y1="113" x2="254" y2="128"/><line x1="260" y1="113" x2="266" y2="128"/><line x1="260" y1="98" x2="247" y2="88"/><line x1="247" y1="88" x2="244" y2="82"/><line x1="260" y1="100" x2="271" y2="110"/></g>
<ellipse cx="102" cy="122" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/><ellipse cx="242" cy="80" rx="6" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
<path d="M137 84 Q190 70 240 80" fill="none" stroke="#EF9F27" stroke-width="1.9" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g9c)"/><circle cx="135" cy="84" r="5" fill="#EF9F27"/>
<circle cx="118" cy="86" r="1.1" fill="var(--s)"/><circle cx="122" cy="86" r="1.1" fill="var(--s)"/><circle cx="257" cy="86" r="1.1" fill="var(--s)"/><circle cx="261" cy="87" r="1.1" fill="var(--s)"/>
<line x1="126" y1="132" x2="254" y2="132" stroke="var(--s)" stroke-width="1.2" opacity="0.55" marker-start="url(#g9d)" marker-end="url(#g9d)"/>
<circle cx="24" cy="104" r="10" fill="none" stroke="var(--s)" stroke-width="1.5"/><text class="ts" x="24" y="108" text-anchor="middle">2</text>

<g fill="none" stroke="var(--s)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="95" cy="158" r="7"/><line x1="95" y1="165" x2="95" y2="183"/><line x1="95" y1="183" x2="89" y2="198"/><line x1="95" y1="183" x2="101" y2="198"/><line x1="95" y1="170" x2="84" y2="180"/><line x1="84" y1="180" x2="80" y2="187"/><line x1="95" y1="168" x2="108" y2="156"/>
<circle cx="285" cy="158" r="7"/><line x1="285" y1="165" x2="285" y2="183"/><line x1="285" y1="183" x2="279" y2="198"/><line x1="285" y1="183" x2="291" y2="198"/><line x1="285" y1="168" x2="272" y2="158"/><line x1="272" y1="158" x2="269" y2="152"/><line x1="285" y1="170" x2="296" y2="180"/></g>
<ellipse cx="77" cy="192" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/><ellipse cx="267" cy="150" rx="6" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
<path d="M112 154 Q190 138 265 150" fill="none" stroke="#EF9F27" stroke-width="1.9" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g9c)"/><circle cx="110" cy="154" r="5" fill="#EF9F27"/>
<circle cx="93" cy="156" r="1.1" fill="var(--s)"/><circle cx="97" cy="156" r="1.1" fill="var(--s)"/><circle cx="282" cy="156" r="1.1" fill="var(--s)"/><circle cx="286" cy="157" r="1.1" fill="var(--s)"/>
<line x1="89" y1="202" x2="291" y2="202" stroke="var(--s)" stroke-width="1.2" opacity="0.55" marker-start="url(#g9d)" marker-end="url(#g9d)"/>
<circle cx="24" cy="178" r="10" fill="none" stroke="var(--s)" stroke-width="1.5"/><text class="ts" x="24" y="182" text-anchor="middle">3</text>

<text class="ts" x="200" y="218" text-anchor="middle">3 catches per level, then step back a little</text>
</svg>`,
  10: `<svg width="100%" viewBox="0 0 380 160" role="img"><title>Power Step</title><desc>Power Step</desc>
<defs><marker id="g10b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<g fill="none" stroke="var(--b)" stroke-width="1"><rect x="14" y="10" width="160" height="142" rx="10"/><rect x="206" y="10" width="160" height="142" rx="10"/></g>
<line x1="30" y1="118" x2="158" y2="118" stroke="var(--b)" stroke-width="1"/><line x1="222" y1="118" x2="350" y2="118" stroke="var(--b)" stroke-width="1"/>

<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="90" cy="50" r="9"/><line x1="90" y1="59" x2="90" y2="90"/><line x1="90" y1="90" x2="82" y2="116"/><line x1="90" y1="90" x2="98" y2="116"/><line x1="90" y1="64" x2="80" y2="58"/><line x1="80" y1="58" x2="86" y2="47"/><line x1="90" y1="66" x2="104" y2="76"/><line x1="104" y1="76" x2="108" y2="84"/></g>
<ellipse cx="111" cy="89" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="88" cy="43" r="6" fill="#EF9F27"/>
<circle cx="88" cy="48" r="1.3" fill="var(--s)"/><circle cx="92" cy="48" r="1.3" fill="var(--s)"/><path d="M87 54 Q90 56 93 54" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<text class="ts" x="94" y="142" text-anchor="middle">1. Ready, arm back</text>

<line x1="182" y1="80" x2="200" y2="80" stroke="var(--s)" stroke-width="2" marker-end="url(#g10b)"/>

<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="300" cy="50" r="9"/><line x1="296" y1="60" x2="286" y2="82"/><line x1="286" y1="82" x2="310" y2="116"/><line x1="286" y1="82" x2="270" y2="116"/><line x1="296" y1="60" x2="316" y2="54"/><line x1="294" y1="62" x2="280" y2="68"/><line x1="280" y1="68" x2="276" y2="76"/></g>
<ellipse cx="273" cy="82" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="320" cy="51" r="6" fill="#EF9F27"/>
<circle cx="298" cy="48" r="1.3" fill="var(--s)"/><circle cx="302" cy="48" r="1.3" fill="var(--s)"/><path d="M297 54 Q300 56 303 54" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<line x1="280" y1="128" x2="314" y2="128" stroke="var(--s)" stroke-width="1.8" stroke-linecap="round" marker-end="url(#g10b)"/>
<text class="ts" x="286" y="142" text-anchor="middle">2. Step forward and throw</text>
</svg>`,
  11: `<svg width="100%" viewBox="0 0 380 160" role="img"><title>Sky Glide</title><desc>Sky Glide</desc>
<defs><marker id="g11ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="40" y1="130" x2="340" y2="130" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="86" cy="70" r="9"/><line x1="86" y1="79" x2="86" y2="106"/><line x1="86" y1="106" x2="77" y2="130"/><line x1="86" y1="106" x2="95" y2="130"/><line x1="86" y1="84" x2="104" y2="66"/><line x1="86" y1="86" x2="72" y2="96"/><line x1="72" y1="96" x2="67" y2="105"/>
<circle cx="292" cy="70" r="9"/><line x1="292" y1="79" x2="292" y2="106"/><line x1="292" y1="106" x2="283" y2="130"/><line x1="292" y1="106" x2="301" y2="130"/><line x1="292" y1="84" x2="276" y2="66"/><line x1="276" y1="66" x2="270" y2="57"/><line x1="292" y1="86" x2="306" y2="98"/></g>
<ellipse cx="64" cy="110" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="267" cy="52" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="84" cy="68" r="1.3" fill="var(--s)"/><circle cx="88" cy="68" r="1.3" fill="var(--s)"/><path d="M83 74 Q86 76 89 74" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="288" cy="66" r="1.3" fill="var(--s)"/><circle cx="293" cy="67" r="1.3" fill="var(--s)"/>
<path d="M108 60 Q190 -16 265 50" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g11ar)"/>
<circle cx="190" cy="9" r="5" fill="#EF9F27" opacity="0.4"/><circle cx="238" cy="31" r="5" fill="#EF9F27" opacity="0.55"/><circle cx="106" cy="62" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="150" text-anchor="middle">Throw high and slow — wait patiently</text>
</svg>`,
  12: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Chest Target</title><desc>Chest Target</desc>
<defs><marker id="g12ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="40" y1="124" x2="340" y2="124" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="100" cy="46" r="9"/><line x1="100" y1="55" x2="100" y2="88"/><line x1="100" y1="88" x2="90" y2="114"/><line x1="100" y1="88" x2="110" y2="114"/><line x1="100" y1="68" x2="124" y2="72"/><line x1="100" y1="70" x2="86" y2="82"/><line x1="86" y1="82" x2="81" y2="90"/>
<circle cx="282" cy="46" r="9"/><line x1="282" y1="55" x2="282" y2="88"/><line x1="282" y1="88" x2="272" y2="114"/><line x1="282" y1="88" x2="292" y2="114"/><line x1="282" y1="70" x2="264" y2="74"/><line x1="282" y1="72" x2="296" y2="84"/></g>
<ellipse cx="78" cy="96" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="250" cy="74" r="13" fill="none" stroke="var(--s)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.55"/>
<ellipse cx="250" cy="74" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="98" cy="44" r="1.3" fill="var(--s)"/><circle cx="102" cy="44" r="1.3" fill="var(--s)"/><path d="M97 50 Q100 52 103 50" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="278" cy="44" r="1.3" fill="var(--s)"/><circle cx="283" cy="45" r="1.3" fill="var(--s)"/>
<path d="M128 72 L242 74" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g12ar)"/>
<circle cx="126" cy="72" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.4" stroke-linecap="round" opacity="0.5"><line x1="246" y1="44" x2="254" y2="52"/><line x1="254" y1="44" x2="246" y2="52"/><line x1="246" y1="98" x2="254" y2="106"/><line x1="254" y1="98" x2="246" y2="106"/></g>
<text class="ts" x="190" y="142" text-anchor="middle">Aim for chest height — high or low misses</text>
</svg>`,
  13: `<h2 class="sr-only">Silent Mode</h2>
<div style="display:flex;align-items:center;gap:4px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:120px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:10px 6px">
    <i class="ti ti-message-off" style="font-size:40px;color:var(--color-text-secondary)" aria-hidden="true"></i>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. No talking</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:18px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1.3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:10px 4px">
    <svg width="118" height="76" viewBox="0 0 118 76" aria-hidden="true">
      <defs><marker id="g13h" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="8" y1="66" x2="110" y2="66" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="26" cy="26" r="7"/><line x1="26" y1="33" x2="26" y2="52"/><line x1="26" y1="52" x2="19" y2="66"/><line x1="26" y1="52" x2="33" y2="66"/><line x1="26" y1="38" x2="40" y2="27"/><line x1="26" y1="40" x2="16" y2="50"/>
      <circle cx="92" cy="26" r="7"/><line x1="92" y1="33" x2="92" y2="52"/><line x1="92" y1="52" x2="85" y2="66"/><line x1="92" y1="52" x2="99" y2="66"/><line x1="92" y1="38" x2="80" y2="27"/></g>
      <ellipse cx="13" cy="55" rx="4" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
      <ellipse cx="75" cy="21" rx="5" ry="6.5" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
      <path d="M43 24 Q60 8 74 19" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g13h)"/>
      <circle cx="42" cy="25" r="4.5" fill="#EF9F27"/>
      </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Throw and catch</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:18px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:120px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:10px 6px">
    <i class="ti ti-hand-three-fingers" style="font-size:42px;color:var(--color-text-secondary)" aria-hidden="true"></i>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">3. Count on fingers</div>
  </div>

</div>`,
  14: `<div style="display:flex;align-items:stretch;gap:18px">

    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-primary);padding:16px 12px">
      <svg width="124" height="74" viewBox="0 0 124 74" aria-hidden="true">
        <defs><marker id="g14f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
        <line x1="10" y1="64" x2="114" y2="64" stroke="var(--color-border-secondary)" stroke-width="1"/>
        <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="28" cy="25" r="7"/><line x1="28" y1="32" x2="28" y2="50"/><line x1="28" y1="50" x2="21" y2="64"/><line x1="28" y1="50" x2="35" y2="64"/><line x1="28" y1="37" x2="42" y2="27"/><line x1="28" y1="39" x2="18" y2="48"/>
        <circle cx="96" cy="25" r="7"/><line x1="96" y1="32" x2="96" y2="50"/><line x1="96" y1="50" x2="89" y2="64"/><line x1="96" y1="50" x2="103" y2="64"/><line x1="96" y1="37" x2="84" y2="27"/></g>
        <ellipse cx="15" cy="54" rx="4" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
        <ellipse cx="80" cy="21" rx="5" ry="6.5" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
        <path d="M47 24 Q70 10 82 21" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g14f)"/>
        <circle cx="47" cy="24" r="4.5" fill="#EF9F27"/>
        </svg>
      <div style="width:96px">
        <div style="position:relative;height:7px;border-radius:5px;background:var(--color-background-secondary);border:0.5px solid var(--color-border-secondary)"><div style="width:20%;height:100%;border-radius:5px;background:#EF9F27"></div><div style="position:absolute;left:20%;top:3px;width:11px;height:11px;border-radius:50%;background:#EF9F27;border:2px solid var(--color-background-primary);transform:translate(-50%,-50%)"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--color-text-tertiary);margin-top:5px"><span>slow</span><span>fast</span></div>
      </div>
      <div style="font-size:13px;font-weight:500;color:var(--color-text-secondary)">5 × slow</div>
    </div>

    <i class="ti ti-chevron-right" style="flex:none;align-self:center;font-size:20px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-primary);padding:16px 12px">
      <svg width="124" height="74" viewBox="0 0 124 74" aria-hidden="true">
        <line x1="10" y1="64" x2="114" y2="64" stroke="var(--color-border-secondary)" stroke-width="1"/>
        <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="28" cy="25" r="7"/><line x1="28" y1="32" x2="28" y2="50"/><line x1="28" y1="50" x2="21" y2="64"/><line x1="28" y1="50" x2="35" y2="64"/><line x1="28" y1="37" x2="42" y2="27"/><line x1="28" y1="39" x2="18" y2="48"/>
        <circle cx="96" cy="25" r="7"/><line x1="96" y1="32" x2="96" y2="50"/><line x1="96" y1="50" x2="89" y2="64"/><line x1="96" y1="50" x2="103" y2="64"/><line x1="96" y1="37" x2="84" y2="27"/></g>
        <ellipse cx="15" cy="54" rx="4" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
        <ellipse cx="80" cy="21" rx="5" ry="6.5" fill="#85B7EB" stroke="#639922" stroke-width="2"/>
        <path d="M47 24 Q70 14 82 22" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" marker-end="url(#g14f)"/>
        <circle cx="47" cy="24" r="4.5" fill="#EF9F27"/>
        </svg>
      <div style="width:96px">
        <div style="position:relative;height:7px;border-radius:5px;background:var(--color-background-secondary);border:0.5px solid var(--color-border-secondary)"><div style="width:55%;height:100%;border-radius:5px;background:#EF9F27"></div><div style="position:absolute;left:55%;top:3px;width:11px;height:11px;border-radius:50%;background:#EF9F27;border:2px solid var(--color-background-primary);transform:translate(-50%,-50%)"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--color-text-tertiary);margin-top:5px"><span>slow</span><span>fast</span></div>
      </div>
      <div style="font-size:13px;font-weight:500;color:var(--color-text-secondary)">5 × medium</div>
    </div>

  </div>`,
  15: `<svg width="100%" viewBox="0 0 380 266" role="img"><title>Spotlight Eyes</title><desc>Step 1: the catcher calls I SEE IT while the thrower still holds the ball. Step 2: only then is the same ball thrown.</desc>
<defs><marker id="g15ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>

<!-- STATE 1 — the catcher calls out FIRST. The single ball is still in the thrower's hand: no trajectory yet. -->
<circle cx="20" cy="20" r="11" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4"/><text class="th" x="20" y="25" text-anchor="middle">1</text>
<line x1="44" y1="104" x2="356" y2="104" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="100" cy="42" r="9"/><line x1="100" y1="51" x2="100" y2="80"/><line x1="100" y1="80" x2="90" y2="104"/><line x1="100" y1="80" x2="110" y2="104"/><line x1="100" y1="60" x2="112" y2="66"/><line x1="100" y1="58" x2="84" y2="72"/><line x1="84" y1="72" x2="80" y2="82"/>
<circle cx="290" cy="42" r="9"/><line x1="290" y1="51" x2="290" y2="80"/><line x1="290" y1="80" x2="280" y2="104"/><line x1="290" y1="80" x2="300" y2="104"/><line x1="290" y1="58" x2="304" y2="46"/><line x1="304" y1="46" x2="308" y2="38"/><line x1="290" y1="60" x2="274" y2="72"/>
</g>
<circle cx="97" cy="40" r="1.3" fill="var(--s)"/><circle cx="103" cy="40" r="1.3" fill="var(--s)"/><path d="M96 46 Q100 48 104 46" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="286" cy="40" r="1.6" fill="var(--s)"/><circle cx="294" cy="40" r="1.6" fill="var(--s)"/><path d="M285 47 Q290 50 295 47" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<ellipse cx="77" cy="88" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="311" cy="32" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="120" cy="70" r="6" fill="#EF9F27"/>
<g><rect x="164" y="8" width="108" height="26" rx="8" fill="var(--bg2)" stroke="#639922" stroke-width="1.6"/><polygon points="246,34 262,34 256,46" fill="var(--bg2)"/><text class="th" x="218" y="26" text-anchor="middle">I SEE IT!</text></g>
<text class="ts" x="100" y="124" text-anchor="middle">Ball stays in the hand</text>
<text class="ts" x="290" y="124" text-anchor="middle">Catcher calls out first</text>

<!-- STATE 2 — same two children, same two paddles, the same one ball finally leaves the hand. -->
<circle cx="20" cy="154" r="11" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4"/><text class="th" x="20" y="159" text-anchor="middle">2</text>
<line x1="44" y1="238" x2="356" y2="238" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="100" cy="176" r="9"/><line x1="100" y1="185" x2="100" y2="214"/><line x1="100" y1="214" x2="90" y2="238"/><line x1="100" y1="214" x2="110" y2="238"/><line x1="100" y1="192" x2="122" y2="180"/><line x1="100" y1="192" x2="84" y2="206"/><line x1="84" y1="206" x2="80" y2="216"/>
<circle cx="290" cy="176" r="9"/><line x1="290" y1="185" x2="290" y2="214"/><line x1="290" y1="214" x2="280" y2="238"/><line x1="290" y1="214" x2="300" y2="238"/><line x1="290" y1="192" x2="270" y2="182"/><line x1="270" y1="182" x2="262" y2="176"/><line x1="290" y1="194" x2="304" y2="206"/>
</g>
<circle cx="97" cy="174" r="1.3" fill="var(--s)"/><circle cx="103" cy="174" r="1.3" fill="var(--s)"/><path d="M96 180 Q100 182 104 180" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="286" cy="174" r="1.6" fill="var(--s)"/><circle cx="294" cy="174" r="1.6" fill="var(--s)"/><path d="M285 181 Q290 184 295 181" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<ellipse cx="77" cy="222" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="254" cy="170" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<path d="M136 172 Q190 146 242 164" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g15ar)"/>
<circle cx="130" cy="174" r="6" fill="#EF9F27"/>
<text class="ts" x="200" y="258" text-anchor="middle">Only after the call: soft throw, then swap roles</text>
</svg>`,
  16: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>1-2-3 Throw!</title><desc>1-2-3 Throw!</desc>
<defs><marker id="g16b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="50" y1="124" x2="330" y2="124" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="96" cy="56" r="9"/><line x1="96" y1="65" x2="96" y2="94"/><line x1="96" y1="94" x2="86" y2="120"/><line x1="96" y1="94" x2="106" y2="120"/><line x1="96" y1="70" x2="118" y2="52"/><line x1="96" y1="72" x2="82" y2="84"/><line x1="82" y1="84" x2="77" y2="94"/>
<circle cx="282" cy="56" r="9"/><line x1="282" y1="65" x2="282" y2="94"/><line x1="282" y1="94" x2="272" y2="120"/><line x1="282" y1="94" x2="292" y2="120"/><line x1="282" y1="70" x2="264" y2="52"/><line x1="264" y1="52" x2="259" y2="44"/><line x1="282" y1="72" x2="296" y2="86"/></g>
<ellipse cx="74" cy="100" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="256" cy="40" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="94" cy="54" r="1.3" fill="var(--s)"/><circle cx="98" cy="54" r="1.3" fill="var(--s)"/><path d="M93 60 Q96 62 99 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="278" cy="54" r="1.3" fill="var(--s)"/><circle cx="283" cy="55" r="1.3" fill="var(--s)"/>
<g><rect x="62" y="8" width="60" height="21" rx="7" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.4"/><polygon points="86,29 98,29 94,39" fill="var(--bg2)" stroke="none"/><text class="th" x="92" y="22" text-anchor="middle">1·2·3</text></g>
<g opacity="0.4"><rect x="256" y="9" width="56" height="20" rx="7" fill="none" stroke="var(--s)" stroke-width="1.4"/><polygon points="266,29 278,29 282,39" fill="none" stroke="var(--s)" stroke-width="1"/><text class="ts" x="284" y="22" text-anchor="middle">1·2·3</text></g>
<path d="M122 50 Q190 28 254 40" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g16b)"/>
<g stroke="#EF9F27" stroke-width="1.6" stroke-linecap="round"><line x1="132" y1="40" x2="128" y2="34"/><line x1="140" y1="42" x2="142" y2="35"/><line x1="146" y1="48" x2="152" y2="45"/></g>
<text class="th" x="142" y="54" text-anchor="middle" fill="#EF9F27">THROW!</text>
<circle cx="120" cy="50" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="142" text-anchor="middle">Thrower counts 1·2·3 and throws on 3 — the catcher counts too on their turn</text>
</svg>`,
  17: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Mirror Mode</title><desc>Mirror Mode</desc>
<line x1="190" y1="22" x2="190" y2="120" stroke="var(--s)" stroke-width="1.4" stroke-dasharray="5 5" opacity="0.5"/>
<line x1="50" y1="124" x2="330" y2="124" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="110" cy="56" r="9"/><line x1="110" y1="65" x2="110" y2="94"/><line x1="110" y1="94" x2="100" y2="120"/><line x1="110" y1="94" x2="120" y2="120"/><line x1="110" y1="70" x2="132" y2="50"/><line x1="132" y1="50" x2="140" y2="41"/><line x1="110" y1="72" x2="98" y2="84"/>
<circle cx="270" cy="56" r="9"/><line x1="270" y1="65" x2="270" y2="94"/><line x1="270" y1="94" x2="260" y2="120"/><line x1="270" y1="94" x2="280" y2="120"/><line x1="270" y1="70" x2="248" y2="50"/><line x1="248" y1="50" x2="240" y2="41"/><line x1="270" y1="72" x2="282" y2="84"/></g>
<ellipse cx="145" cy="35" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4" transform="rotate(-38 145 35)"/>
<ellipse cx="235" cy="35" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4" transform="rotate(38 235 35)"/>
<circle cx="108" cy="54" r="1.3" fill="var(--s)"/><circle cx="112" cy="54" r="1.3" fill="var(--s)"/><path d="M107 60 Q110 62 113 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="268" cy="54" r="1.3" fill="var(--s)"/><circle cx="272" cy="54" r="1.3" fill="var(--s)"/><path d="M267 60 Q270 62 273 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round" opacity="0.7"><line x1="182" y1="64" x2="174" y2="64" marker-end="url(#g17m)"/><line x1="198" y1="64" x2="206" y2="64" marker-end="url(#g17m)"/></g>
<defs><marker id="g17m" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<text class="ts" x="190" y="142" text-anchor="middle">Copy the same pose — then throw</text>
</svg>`,
  18: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Count to 10</title><desc>Count to 10</desc>
<defs><marker id="g18ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<text class="ts" x="60" y="11" text-anchor="middle">1</text><text class="ts" x="258" y="11" text-anchor="middle">10</text>
<g><circle cx="60" cy="22" r="4" fill="#EF9F27"/><circle cx="82" cy="22" r="4" fill="#EF9F27"/><circle cx="104" cy="22" r="4" fill="#EF9F27"/><circle cx="126" cy="22" r="4" fill="#EF9F27"/><circle cx="148" cy="22" r="4" fill="#EF9F27"/><circle cx="170" cy="22" r="4" fill="#EF9F27"/></g>
<g fill="none" stroke="var(--s)" stroke-width="1.4"><circle cx="192" cy="22" r="4"/><circle cx="214" cy="22" r="4"/><circle cx="236" cy="22" r="4"/><circle cx="258" cy="22" r="4"/></g>
<line x1="50" y1="128" x2="330" y2="128" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="110" cy="60" r="9"/><line x1="110" y1="69" x2="110" y2="98"/><line x1="110" y1="98" x2="100" y2="124"/><line x1="110" y1="98" x2="120" y2="124"/><line x1="110" y1="74" x2="132" y2="58"/><line x1="110" y1="76" x2="96" y2="88"/><line x1="96" y1="88" x2="91" y2="98"/>
<circle cx="270" cy="60" r="9"/><line x1="270" y1="69" x2="270" y2="98"/><line x1="270" y1="98" x2="260" y2="124"/><line x1="270" y1="98" x2="280" y2="124"/><line x1="270" y1="74" x2="252" y2="58"/><line x1="252" y1="58" x2="247" y2="50"/><line x1="270" y1="76" x2="284" y2="90"/></g>
<ellipse cx="88" cy="104" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="244" cy="46" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="108" cy="58" r="1.3" fill="var(--s)"/><circle cx="112" cy="58" r="1.3" fill="var(--s)"/><path d="M107 64 Q110 66 113 64" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="266" cy="58" r="1.3" fill="var(--s)"/><circle cx="271" cy="59" r="1.3" fill="var(--s)"/><path d="M265 64 Q268 66 271 64" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<path d="M134 56 Q190 40 242 46" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g18ar)"/>
<circle cx="132" cy="56" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="143" text-anchor="middle">Count together to 10 — a drop resets to 1</text>
</svg>`,
  19: `<h2 class="sr-only">Circle Round</h2>
<div style="display:flex;align-items:center;gap:4px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="88" viewBox="0 0 110 88" aria-hidden="true">
      <ellipse cx="55" cy="40" rx="32" ry="26" fill="none" stroke="var(--color-border-secondary)" stroke-width="1.1" stroke-dasharray="4 5"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="55" cy="14" r="5"/><line x1="55" y1="19" x2="55" y2="31"/><line x1="55" y1="31" x2="52" y2="37"/><line x1="55" y1="31" x2="58" y2="37"/>
      <circle cx="85" cy="32" r="5"/><line x1="85" y1="37" x2="85" y2="49"/><line x1="85" y1="49" x2="82" y2="55"/><line x1="85" y1="49" x2="88" y2="55"/>
      <circle cx="74" cy="61" r="5"/><line x1="74" y1="66" x2="74" y2="76"/><line x1="74" y1="76" x2="71" y2="82"/><line x1="74" y1="76" x2="77" y2="82"/>
      <circle cx="36" cy="61" r="5"/><line x1="36" y1="66" x2="36" y2="76"/><line x1="36" y1="76" x2="33" y2="82"/><line x1="36" y1="76" x2="39" y2="82"/>
      <circle cx="25" cy="32" r="5"/><line x1="25" y1="37" x2="25" y2="49"/><line x1="25" y1="49" x2="22" y2="55"/><line x1="25" y1="49" x2="28" y2="55"/></g>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. Form a circle</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:16px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="88" viewBox="0 0 110 88" aria-hidden="true">
      <defs><marker id="g19s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <ellipse cx="55" cy="40" rx="32" ry="26" fill="none" stroke="var(--color-border-secondary)" stroke-width="1.1" stroke-dasharray="4 5"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="55" cy="14" r="5"/><line x1="55" y1="19" x2="55" y2="31"/><line x1="55" y1="31" x2="52" y2="37"/><line x1="55" y1="31" x2="58" y2="37"/>
      <circle cx="85" cy="32" r="5"/><line x1="85" y1="37" x2="85" y2="49"/><line x1="85" y1="49" x2="82" y2="55"/><line x1="85" y1="49" x2="88" y2="55"/>
      <circle cx="74" cy="61" r="5"/><line x1="74" y1="66" x2="74" y2="76"/><line x1="74" y1="76" x2="71" y2="82"/><line x1="74" y1="76" x2="77" y2="82"/>
      <circle cx="36" cy="61" r="5"/><line x1="36" y1="66" x2="36" y2="76"/><line x1="36" y1="76" x2="33" y2="82"/><line x1="36" y1="76" x2="39" y2="82"/>
      <circle cx="25" cy="32" r="5"/><line x1="25" y1="37" x2="25" y2="49"/><line x1="25" y1="49" x2="22" y2="55"/><line x1="25" y1="49" x2="28" y2="55"/></g>
      <circle cx="85" cy="32" r="8.5" fill="none" stroke="#EF9F27" stroke-width="1.6"/>
      <path d="M42 58 L78 37" fill="none" stroke="#EF9F27" stroke-width="1.9" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g19s)"/>
      <circle cx="42" cy="58" r="3.5" fill="#EF9F27"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Throw to someone</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:16px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="88" viewBox="0 0 110 88" aria-hidden="true">
      <ellipse cx="55" cy="40" rx="32" ry="26" fill="none" stroke="var(--color-border-secondary)" stroke-width="1.1" stroke-dasharray="4 5"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="55" cy="14" r="5"/><line x1="55" y1="19" x2="55" y2="31"/><line x1="55" y1="31" x2="52" y2="37"/><line x1="55" y1="31" x2="58" y2="37"/>
      <circle cx="74" cy="61" r="5"/><line x1="74" y1="66" x2="74" y2="76"/><line x1="74" y1="76" x2="71" y2="82"/><line x1="74" y1="76" x2="77" y2="82"/>
      <circle cx="36" cy="61" r="5"/><line x1="36" y1="66" x2="36" y2="76"/><line x1="36" y1="76" x2="33" y2="82"/><line x1="36" y1="76" x2="39" y2="82"/>
      <circle cx="25" cy="32" r="5"/><line x1="25" y1="37" x2="25" y2="49"/><line x1="25" y1="49" x2="22" y2="55"/><line x1="25" y1="49" x2="28" y2="55"/></g>
      <circle cx="55" cy="14" r="8.5" fill="none" stroke="#EF9F27" stroke-width="1.6"/>
      <path d="M40 57 L53 23" fill="none" stroke="#EF9F27" stroke-width="1.9" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g19s)"/>
      <g stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round"><circle cx="85" cy="32" r="5" fill="none" opacity="0.4"/><line x1="81" y1="28" x2="89" y2="36"/><line x1="89" y1="28" x2="81" y2="36"/></g>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">3. To someone new (not the same ✗)</div>
  </div>

</div>`,
  20: `<h2 class="sr-only">Crab Relay</h2>
<div style="display:flex;align-items:center;gap:4px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="96" viewBox="0 0 110 96" aria-hidden="true">
      <line x1="55" y1="24" x2="55" y2="70" stroke="var(--color-border-secondary)" stroke-width="1" stroke-dasharray="3 4"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="42" cy="38" r="5"/><line x1="42" y1="43" x2="42" y2="55"/><line x1="42" y1="55" x2="39" y2="63"/><line x1="42" y1="55" x2="45" y2="63"/><line x1="42" y1="46" x2="48" y2="43"/>
      <circle cx="24" cy="38" r="5"/><line x1="24" y1="43" x2="24" y2="55"/><line x1="24" y1="55" x2="21" y2="63"/><line x1="24" y1="55" x2="27" y2="63"/>
      <circle cx="68" cy="38" r="5"/><line x1="68" y1="43" x2="68" y2="55"/><line x1="68" y1="55" x2="65" y2="63"/><line x1="68" y1="55" x2="71" y2="63"/><line x1="68" y1="46" x2="62" y2="43"/>
      <circle cx="86" cy="38" r="5"/><line x1="86" y1="43" x2="86" y2="55"/><line x1="86" y1="55" x2="83" y2="63"/><line x1="86" y1="55" x2="89" y2="63"/></g>
      <ellipse cx="51" cy="41" rx="3" ry="4" fill="#85B7EB" stroke="#639922" stroke-width="1.6"/>
      <ellipse cx="59" cy="41" rx="3" ry="4" fill="#85B7EB" stroke="#639922" stroke-width="1.6"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. Two lines face off</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:16px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="96" viewBox="0 0 110 96" aria-hidden="true">
      <defs><marker id="g20pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="42" cy="38" r="5"/><line x1="42" y1="43" x2="42" y2="55"/><line x1="42" y1="55" x2="39" y2="63"/><line x1="42" y1="55" x2="45" y2="63"/><line x1="42" y1="46" x2="48" y2="43"/>
      <circle cx="24" cy="38" r="5"/><line x1="24" y1="43" x2="24" y2="55"/><line x1="24" y1="55" x2="21" y2="63"/><line x1="24" y1="55" x2="27" y2="63"/>
      <circle cx="68" cy="38" r="5"/><line x1="68" y1="43" x2="68" y2="55"/><line x1="68" y1="55" x2="65" y2="63"/><line x1="68" y1="55" x2="71" y2="63"/><line x1="68" y1="46" x2="62" y2="43"/>
      <circle cx="86" cy="38" r="5"/><line x1="86" y1="43" x2="86" y2="55"/><line x1="86" y1="55" x2="83" y2="63"/><line x1="86" y1="55" x2="89" y2="63"/></g>
      <ellipse cx="51" cy="41" rx="3" ry="4" fill="#85B7EB" stroke="#639922" stroke-width="1.6"/>
      <ellipse cx="59" cy="41" rx="3" ry="4" fill="#85B7EB" stroke="#639922" stroke-width="1.6"/>
      <path d="M51 38 Q55 27 59 38" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g20pa)"/>
      <circle cx="51" cy="38" r="4" fill="#EF9F27"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Pass across</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:16px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="110" height="96" viewBox="0 0 110 96" aria-hidden="true">
      <defs><marker id="g20cb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
      <circle cx="70" cy="38" r="5"/><line x1="70" y1="43" x2="70" y2="55"/><line x1="70" y1="55" x2="67" y2="63"/><line x1="70" y1="55" x2="73" y2="63"/>
      <circle cx="88" cy="38" r="5"/><line x1="88" y1="43" x2="88" y2="55"/><line x1="88" y1="55" x2="85" y2="63"/><line x1="88" y1="55" x2="91" y2="63"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="44" cy="34" r="5"/><line x1="44" y1="39" x2="44" y2="51"/><line x1="44" y1="51" x2="41" y2="59"/><line x1="44" y1="51" x2="47" y2="59"/>
      <line x1="10" y1="72" x2="26" y2="72"/><circle cx="6" cy="69" r="4"/><line x1="26" y1="72" x2="24" y2="84"/><line x1="26" y1="72" x2="29" y2="84"/><line x1="10" y1="72" x2="8" y2="84"/><line x1="10" y1="72" x2="13" y2="84"/></g>
      <line x1="2" y1="86" x2="40" y2="86" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <path d="M44 28 Q12 34 20 64" fill="none" stroke="var(--color-text-tertiary)" stroke-width="1.7" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g20cb)"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">3. Crab back behind your own line</div>
  </div>

</div>`,
  21: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Captain Says</title><desc>Captain Says</desc>
<defs><marker id="g21ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="70" cy="62" r="9"/><line x1="70" y1="71" x2="70" y2="100"/><line x1="70" y1="100" x2="60" y2="124"/><line x1="70" y1="100" x2="80" y2="124"/><line x1="70" y1="76" x2="92" y2="60"/><line x1="70" y1="78" x2="56" y2="90"/>
<circle cx="206" cy="54" r="9"/><line x1="206" y1="63" x2="206" y2="90"/><line x1="206" y1="90" x2="197" y2="112"/><line x1="206" y1="90" x2="215" y2="112"/><line x1="206" y1="66" x2="190" y2="50"/><line x1="190" y1="50" x2="185" y2="42"/>
<circle cx="284" cy="70" r="9"/><line x1="284" y1="79" x2="284" y2="106"/><line x1="284" y1="106" x2="275" y2="128"/><line x1="284" y1="106" x2="293" y2="128"/><line x1="284" y1="82" x2="268" y2="66"/><line x1="268" y1="66" x2="263" y2="58"/>
<circle cx="326" cy="98" r="9"/><line x1="326" y1="107" x2="326" y2="132"/><line x1="326" y1="132" x2="317" y2="148"/><line x1="326" y1="132" x2="335" y2="148"/><line x1="326" y1="110" x2="310" y2="94"/><line x1="310" y1="94" x2="305" y2="86"/></g>
<ellipse cx="181" cy="38" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="259" cy="54" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="301" cy="82" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<path d="M70 40 L72.6 45.2 L78.3 46 L74.2 50 L75.1 55.7 L70 53 L64.9 55.7 L65.8 50 L61.7 46 L67.4 45.2 Z" fill="#EF9F27" stroke="#EF9F27" stroke-width="1" stroke-linejoin="round"/>
<circle cx="284" cy="70" r="14" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="3 3"/>
<text class="ts" x="284" y="36" text-anchor="middle" fill="#EF9F27">Sam</text>
<g><rect x="92" y="16" width="50" height="21" rx="7" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.4"/><polygon points="100,37 112,37 96,46" fill="var(--bg2)" stroke="none"/><text class="th" x="117" y="30" text-anchor="middle">SAM!</text></g>
<path d="M94 58 Q190 24 268 64" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g21ar)"/>
<circle cx="94" cy="58" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="146" text-anchor="middle">Captain calls a name → throws the ball to that person</text>
</svg>`,
  22: `<h2 class="sr-only">Spinning Team</h2>
<div style="display:flex;align-items:center;gap:6px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 150 130" aria-hidden="true" style="max-width:160px">
      <defs><marker id="g22pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <path d="M50 32 L100 32 L100 86 L50 86 Z" fill="none" stroke="var(--color-border-secondary)" stroke-width="1.1" stroke-dasharray="4 5"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="50" cy="32" r="5"/><line x1="50" y1="37" x2="50" y2="49"/><line x1="50" y1="49" x2="46" y2="57"/><line x1="50" y1="49" x2="54" y2="57"/><line x1="50" y1="40" x2="57" y2="40"/>
      <circle cx="100" cy="32" r="5"/><line x1="100" y1="37" x2="100" y2="49"/><line x1="100" y1="49" x2="96" y2="57"/><line x1="100" y1="49" x2="104" y2="57"/><line x1="100" y1="40" x2="93" y2="40"/>
      <circle cx="100" cy="86" r="5"/><line x1="100" y1="91" x2="100" y2="103"/><line x1="100" y1="103" x2="96" y2="111"/><line x1="100" y1="103" x2="104" y2="111"/><line x1="100" y1="94" x2="93" y2="94"/>
      <circle cx="50" cy="86" r="5"/><line x1="50" y1="91" x2="50" y2="103"/><line x1="50" y1="103" x2="46" y2="111"/><line x1="50" y1="103" x2="54" y2="111"/><line x1="50" y1="94" x2="57" y2="94"/></g>
      <ellipse cx="60" cy="40" rx="4" ry="5" fill="#85B7EB" stroke="#639922" stroke-width="1.8"/>
      <ellipse cx="90" cy="40" rx="4" ry="5" fill="#85B7EB" stroke="#639922" stroke-width="1.8"/>
      <ellipse cx="90" cy="94" rx="4" ry="5" fill="#85B7EB" stroke="#639922" stroke-width="1.8"/>
      <ellipse cx="60" cy="94" rx="4" ry="5" fill="#85B7EB" stroke="#639922" stroke-width="1.8"/>
      <path d="M62 42 Q80 62 96 98" fill="none" stroke="#EF9F27" stroke-width="2.1" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g22pa)"/>
      <circle cx="62" cy="42" r="5" fill="#EF9F27"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. Throw to someone, catch</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:18px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 150 130" aria-hidden="true" style="max-width:160px">
      <defs><marker id="g22pb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <path d="M50 32 L100 32 L100 86 L50 86 Z" fill="none" stroke="var(--color-border-secondary)" stroke-width="1.1" stroke-dasharray="4 5"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="50" cy="32" r="5"/><line x1="50" y1="37" x2="50" y2="49"/><line x1="50" y1="49" x2="46" y2="57"/><line x1="50" y1="49" x2="54" y2="57"/>
      <circle cx="100" cy="32" r="5"/><line x1="100" y1="37" x2="100" y2="49"/><line x1="100" y1="49" x2="96" y2="57"/><line x1="100" y1="49" x2="104" y2="57"/>
      <circle cx="100" cy="86" r="5"/><line x1="100" y1="91" x2="100" y2="103"/><line x1="100" y1="103" x2="96" y2="111"/><line x1="100" y1="103" x2="104" y2="111"/>
      <circle cx="50" cy="86" r="5"/><line x1="50" y1="91" x2="50" y2="103"/><line x1="50" y1="103" x2="46" y2="111"/><line x1="50" y1="103" x2="54" y2="111"/></g>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2" stroke-linecap="round">
      <path d="M62 20 L88 20" marker-end="url(#g22pb)"/>
      <path d="M114 44 L114 74" marker-end="url(#g22pb)"/>
      <path d="M88 118 L62 118" marker-end="url(#g22pb)"/>
      <path d="M36 74 L36 44" marker-end="url(#g22pb)"/></g>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Everyone shifts one corner clockwise</div>
  </div>

</div>`,
  23: `<h2 class="sr-only">Switch Partners</h2>
<div style="display:flex;align-items:center;gap:6px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 150 128" aria-hidden="true" style="max-width:160px">
      <defs><marker id="g23a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="45" cy="34" r="6"/><line x1="45" y1="40" x2="45" y2="54"/><line x1="45" y1="54" x2="41" y2="64"/><line x1="45" y1="54" x2="49" y2="64"/><line x1="45" y1="44" x2="53" y2="46"/>
      <circle cx="105" cy="34" r="6"/><line x1="105" y1="40" x2="105" y2="54"/><line x1="105" y1="54" x2="101" y2="64"/><line x1="105" y1="54" x2="109" y2="64"/><line x1="105" y1="44" x2="97" y2="46"/>
      <circle cx="45" cy="94" r="6"/><line x1="45" y1="100" x2="45" y2="114"/><line x1="45" y1="114" x2="41" y2="124"/><line x1="45" y1="114" x2="49" y2="124"/><line x1="45" y1="92" x2="53" y2="84"/>
      <circle cx="105" cy="94" r="6"/><line x1="105" y1="100" x2="105" y2="114"/><line x1="105" y1="114" x2="101" y2="124"/><line x1="105" y1="114" x2="109" y2="124"/><line x1="105" y1="92" x2="97" y2="84"/></g>
      <ellipse cx="56" cy="47" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="94" cy="47" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="56" cy="81" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="94" cy="81" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <path d="M53 30 Q75 46 97 30" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" marker-start="url(#g23a)" marker-end="url(#g23a)"/>
      <circle cx="75" cy="40" r="4.5" fill="#EF9F27"/>
      <path d="M53 98 Q75 82 97 98" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" marker-start="url(#g23a)" marker-end="url(#g23a)"/>
      <circle cx="75" cy="88" r="4.5" fill="#EF9F27"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. 6 catches with your partner</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:18px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 150 128" aria-hidden="true" style="max-width:160px">
      <defs><marker id="g23b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="45" cy="34" r="6"/><line x1="45" y1="40" x2="45" y2="54"/><line x1="45" y1="54" x2="41" y2="64"/><line x1="45" y1="54" x2="49" y2="64"/><line x1="45" y1="46" x2="53" y2="50"/>
      <circle cx="105" cy="34" r="6"/><line x1="105" y1="40" x2="105" y2="54"/><line x1="105" y1="54" x2="101" y2="64"/><line x1="105" y1="54" x2="109" y2="64"/><line x1="105" y1="46" x2="97" y2="50"/>
      <circle cx="45" cy="94" r="6"/><line x1="45" y1="100" x2="45" y2="114"/><line x1="45" y1="114" x2="41" y2="124"/><line x1="45" y1="114" x2="49" y2="124"/><line x1="45" y1="90" x2="53" y2="82"/>
      <circle cx="105" cy="94" r="6"/><line x1="105" y1="100" x2="105" y2="114"/><line x1="105" y1="114" x2="101" y2="124"/><line x1="105" y1="114" x2="109" y2="124"/><line x1="105" y1="90" x2="97" y2="82"/></g>
      <ellipse cx="56" cy="52" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="94" cy="52" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="56" cy="76" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <ellipse cx="94" cy="76" rx="3.5" ry="4.5" fill="#85B7EB" stroke="#639922" stroke-width="1.7"/>
      <path d="M41 42 Q60 64 41 86" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" marker-start="url(#g23b)" marker-end="url(#g23b)"/>
      <circle cx="54" cy="64" r="4.5" fill="#EF9F27"/>
      <path d="M109 42 Q90 64 109 86" fill="none" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" marker-start="url(#g23b)" marker-end="url(#g23b)"/>
      <circle cx="96" cy="64" r="4.5" fill="#EF9F27"/>
      <g fill="none" stroke="var(--color-text-tertiary)" stroke-width="1.7" stroke-linecap="round">
      <path d="M68 59 Q75 55 82 59" marker-end="url(#g23b)"/>
      <path d="M82 69 Q75 73 68 69" marker-end="url(#g23b)"/></g>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Then switch to a new partner</div>
  </div>

</div>`,
  24: `<svg width="100%" viewBox="0 0 380 162" role="img"><title>2v2 Shared Score</title><desc>2v2 Shared Score</desc>
<defs><marker id="g24n" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<rect x="126" y="12" width="128" height="40" rx="8" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.6"/>
<text class="ts" x="190" y="30" text-anchor="middle">SHARED TOTAL</text>
<text class="ts" x="190" y="46" text-anchor="middle">target 40</text>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="50" cy="98" r="9"/><line x1="50" y1="107" x2="50" y2="131"/><line x1="50" y1="131" x2="42" y2="151"/><line x1="50" y1="131" x2="58" y2="151"/><line x1="50" y1="111" x2="64" y2="107"/>
<circle cx="118" cy="98" r="9"/><line x1="118" y1="107" x2="118" y2="131"/><line x1="118" y1="131" x2="110" y2="151"/><line x1="118" y1="131" x2="126" y2="151"/><line x1="118" y1="111" x2="104" y2="107"/>
<circle cx="262" cy="98" r="9"/><line x1="262" y1="107" x2="262" y2="131"/><line x1="262" y1="131" x2="254" y2="151"/><line x1="262" y1="131" x2="270" y2="151"/><line x1="262" y1="111" x2="276" y2="107"/>
<circle cx="330" cy="98" r="9"/><line x1="330" y1="107" x2="330" y2="131"/><line x1="330" y1="131" x2="322" y2="151"/><line x1="330" y1="131" x2="338" y2="151"/><line x1="330" y1="111" x2="316" y2="107"/></g>
<ellipse cx="68" cy="105" rx="5" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<ellipse cx="100" cy="105" rx="5" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<ellipse cx="280" cy="105" rx="5" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<ellipse cx="312" cy="105" rx="5" ry="6" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<line x1="73" y1="105" x2="95" y2="105" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>
<circle cx="84" cy="105" r="5" fill="#EF9F27"/>
<line x1="285" y1="105" x2="307" y2="105" stroke="#EF9F27" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>
<circle cx="296" cy="105" r="5" fill="#EF9F27"/>
<path d="M84 88 Q108 62 152 52" fill="none" stroke="var(--s)" stroke-width="1.8" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g24n)"/>
<path d="M296 88 Q272 62 228 52" fill="none" stroke="var(--s)" stroke-width="1.8" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g24n)"/>
<text class="ts" x="118" y="74" text-anchor="middle">+5</text>
<text class="ts" x="262" y="74" text-anchor="middle">+5</text>
<text class="ts" x="190" y="160" text-anchor="middle">Two pairs take turns — points merge into ONE shared total</text>
</svg>`,
  25: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Easy Catch</title><desc>Easy Catch</desc>
<defs><marker id="g25ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="50" y1="120" x2="330" y2="120" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="88" cy="72" r="9"/><line x1="88" y1="81" x2="88" y2="112"/><line x1="88" y1="112" x2="118" y2="112"/><line x1="118" y1="112" x2="120" y2="104"/><line x1="88" y1="86" x2="110" y2="76"/>
<circle cx="292" cy="72" r="9"/><line x1="292" y1="81" x2="292" y2="112"/><line x1="292" y1="112" x2="262" y2="112"/><line x1="262" y1="112" x2="260" y2="104"/><line x1="292" y1="86" x2="272" y2="74"/><line x1="272" y1="74" x2="267" y2="66"/></g>
<ellipse cx="263" cy="61" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="85" cy="70" r="1.3" fill="var(--s)"/><circle cx="91" cy="70" r="1.3" fill="var(--s)"/><path d="M84 76 Q88 78 92 76" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="289" cy="70" r="1.3" fill="var(--s)"/><circle cx="294" cy="70" r="1.3" fill="var(--s)"/><path d="M288 76 Q291 78 294 76" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<path d="M114 74 Q204 52 262 64" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g25ar)"/>
<circle cx="114" cy="74" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="142" text-anchor="middle">Play seated — short soft tosses, don't get up</text>
</svg>`,
  26: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Tiny Space</title><desc>Tiny Space</desc>
<defs><marker id="g26ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="60" y1="122" x2="320" y2="122" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="150" cy="56" r="9"/><line x1="150" y1="65" x2="150" y2="96"/><line x1="150" y1="96" x2="142" y2="120"/><line x1="150" y1="96" x2="158" y2="120"/><line x1="150" y1="70" x2="172" y2="60"/><line x1="150" y1="72" x2="138" y2="84"/><line x1="138" y1="84" x2="133" y2="94"/>
<circle cx="230" cy="56" r="9"/><line x1="230" y1="65" x2="230" y2="96"/><line x1="230" y1="96" x2="222" y2="120"/><line x1="230" y1="96" x2="238" y2="120"/><line x1="230" y1="70" x2="212" y2="58"/><line x1="212" y1="58" x2="207" y2="50"/><line x1="230" y1="72" x2="242" y2="84"/></g>
<ellipse cx="130" cy="100" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="204" cy="46" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="147" cy="54" r="1.3" fill="var(--s)"/><circle cx="153" cy="54" r="1.3" fill="var(--s)"/><path d="M146 60 Q150 62 154 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="227" cy="54" r="1.3" fill="var(--s)"/><circle cx="232" cy="55" r="1.3" fill="var(--s)"/>
<path d="M176 58 Q190 48 204 56" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g26ar)"/>
<circle cx="176" cy="58" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round"><line x1="166" y1="114" x2="184" y2="114" opacity="0.4" marker-end="url(#g26ar)"/><line x1="171" y1="109" x2="179" y2="119"/><line x1="179" y1="109" x2="171" y2="119"/></g>
<g stroke="var(--s)" stroke-width="1.4" stroke-linecap="round"><line x1="138" y1="126" x2="138" y2="130"/><line x1="162" y1="126" x2="162" y2="130"/><line x1="218" y1="126" x2="218" y2="130"/><line x1="242" y1="126" x2="242" y2="130"/></g>
<text class="ts" x="190" y="144" text-anchor="middle">Just 1 step apart — feet planted, no stepping forward</text>
</svg>`,
  27: `<h2 class="sr-only">Secret Signal</h2>
<div style="display:flex;align-items:center;gap:6px">

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 96 100" aria-hidden="true" style="max-width:120px">
      <defs><marker id="g27sa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="44" cy="44" r="9"/><line x1="44" y1="53" x2="44" y2="78"/><line x1="44" y1="78" x2="36" y2="96"/><line x1="44" y1="78" x2="52" y2="96"/><line x1="44" y1="58" x2="60" y2="40"/><line x1="60" y1="40" x2="64" y2="32"/><line x1="44" y1="60" x2="30" y2="70"/>
      <circle cx="41" cy="42" r="1.3" fill="var(--color-text-secondary)"/><circle cx="47" cy="42" r="1.3" fill="var(--color-text-secondary)"/><path d="M40 48 Q44 50 48 48" stroke-width="1.3"/></g>
      <ellipse cx="66" cy="26" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="28" cy="72" r="5" fill="#EF9F27"/>
      <path d="M56 16 Q66 4 76 16" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.8" stroke-linecap="round" marker-end="url(#g27sa)"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">1. Signal with the paddle (raise/wave)</div>
  </div>

  <i class="ti ti-chevron-right" style="flex:none;font-size:18px;color:var(--color-text-tertiary)" aria-hidden="true"></i>

  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-secondary);padding:8px 4px">
    <svg width="100%" viewBox="0 0 150 96" aria-hidden="true" style="max-width:160px">
      <defs><marker id="g27ta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="20" y1="88" x2="130" y2="88" stroke="var(--color-border-secondary)" stroke-width="1"/>
      <g fill="none" stroke="var(--color-text-secondary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="38" cy="34" r="8"/><line x1="38" y1="42" x2="38" y2="64"/><line x1="38" y1="64" x2="31" y2="84"/><line x1="38" y1="64" x2="45" y2="84"/><line x1="38" y1="46" x2="56" y2="38"/><line x1="38" y1="48" x2="26" y2="58"/>
      <circle cx="112" cy="34" r="8"/><line x1="112" y1="42" x2="112" y2="64"/><line x1="112" y1="64" x2="105" y2="84"/><line x1="112" y1="64" x2="119" y2="84"/><line x1="112" y1="46" x2="96" y2="36"/><line x1="96" y1="36" x2="91" y2="29"/></g>
      <ellipse cx="88" cy="26" rx="5" ry="6.5" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
      <path d="M60 38 Q75 26 86 34" fill="none" stroke="#EF9F27" stroke-width="2.1" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#g27ta)"/>
      <circle cx="60" cy="38" r="5" fill="#EF9F27"/>
    </svg>
    <div style="font-size:12px;color:var(--color-text-secondary);text-align:center">2. Then throw — no signal, no throw</div>
  </div>

</div>`,
  /* Mission 28 is the one illustration in the set that is a sequence rather
   * than a snapshot: the whole point is that the catcher commits BEFORE the
   * ball moves, which a single frame cannot say. It therefore ships a
   * three-slide swipe block instead of one SVG. The markup is inert on its
   * own — app.js wires the dots and arrows by looking for [data-jv-carousel],
   * so nothing here is keyed to a mission id, and the CSS scroll-snap track
   * still swipes with JavaScript disabled. */
  28: `<div class="jvCar" data-jv-carousel aria-roledescription="carousel" aria-label="Mind Reader — how to play, in three steps">
  <h2 class="sr-only">Mind Reader</h2>
  <div class="jvCarTrack" data-jv-car-track tabindex="0" role="group" aria-label="Mind Reader steps, use the left and right arrow keys">

    <div class="jvCarSlide" role="group" aria-roledescription="slide" aria-label="Step 1 of 3">
      <svg width="100%" viewBox="0 0 380 160" role="img"><title>Step 1 — the thrower picks a direction in secret</title><desc>The thrower holds the one ball and thinks of left, centre or right. Nothing has been thrown yet.</desc>
      <line x1="24" y1="150" x2="356" y2="150" stroke="var(--b)" stroke-width="1"/>
      <g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="96" cy="74" r="9"/><line x1="96" y1="83" x2="96" y2="112"/><line x1="96" y1="112" x2="86" y2="150"/><line x1="96" y1="112" x2="106" y2="150"/><line x1="96" y1="92" x2="112" y2="96"/><line x1="96" y1="90" x2="82" y2="104"/><line x1="82" y1="104" x2="78" y2="114"/>
      <circle cx="290" cy="74" r="9"/><line x1="290" y1="83" x2="290" y2="112"/><line x1="290" y1="112" x2="280" y2="150"/><line x1="290" y1="112" x2="300" y2="150"/><line x1="290" y1="92" x2="274" y2="100"/><line x1="274" y1="100" x2="266" y2="108"/><line x1="290" y1="94" x2="304" y2="106"/>
      </g>
      <circle cx="93" cy="72" r="1.3" fill="var(--s)"/><circle cx="99" cy="72" r="1.3" fill="var(--s)"/><path d="M92 78 Q96 80 100 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="287" cy="72" r="1.3" fill="var(--s)"/><circle cx="293" cy="72" r="1.3" fill="var(--s)"/><path d="M286 78 Q290 80 294 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <ellipse cx="75" cy="122" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="260" cy="114" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="120" cy="100" r="6" fill="#EF9F27"/>
      <circle cx="118" cy="72" r="3.5" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4"/><circle cx="128" cy="64" r="5" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4"/>
      <rect x="136" y="6" width="170" height="54" rx="12" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4" stroke-dasharray="5 4"/>
      <text class="ts" x="221" y="26" text-anchor="middle">MY SECRET</text>
      <rect x="144" y="34" width="44" height="20" rx="6" fill="#639922" fill-opacity="0.14" stroke="#639922" stroke-width="1.6"/><text class="ts" x="166" y="48" text-anchor="middle">LEFT</text>
      <rect x="192" y="34" width="54" height="20" rx="6" fill="none" stroke="var(--b)" stroke-width="1.4"/><text class="ts" x="219" y="48" text-anchor="middle">CENTER</text>
      <rect x="250" y="34" width="48" height="20" rx="6" fill="none" stroke="var(--b)" stroke-width="1.4"/><text class="ts" x="274" y="48" text-anchor="middle">RIGHT</text>
      </svg>
      <p class="jvCarCap">Step 1 — the thrower secretly picks LEFT, CENTER or RIGHT. The ball stays in the hand.</p>
    </div>

    <div class="jvCarSlide" role="group" aria-roledescription="slide" aria-label="Step 2 of 3">
      <svg width="100%" viewBox="0 0 380 160" role="img"><title>Step 2 — the catcher commits the paddle before the throw</title><desc>After a three second pause the catcher moves their one paddle to the direction they predict. The ball has still not left the hand.</desc>
      <line x1="24" y1="150" x2="356" y2="150" stroke="var(--b)" stroke-width="1"/>
      <rect x="24" y="8" width="62" height="22" rx="8" fill="var(--bg2)" stroke="var(--b)" stroke-width="1.4"/><text class="ts" x="55" y="23" text-anchor="middle">3s pause</text>
      <g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="96" cy="74" r="9"/><line x1="96" y1="83" x2="96" y2="112"/><line x1="96" y1="112" x2="86" y2="150"/><line x1="96" y1="112" x2="106" y2="150"/><line x1="96" y1="92" x2="112" y2="96"/><line x1="96" y1="90" x2="82" y2="104"/><line x1="82" y1="104" x2="78" y2="114"/>
      <circle cx="290" cy="74" r="9"/><line x1="290" y1="83" x2="290" y2="112"/><line x1="290" y1="112" x2="280" y2="150"/><line x1="290" y1="112" x2="300" y2="150"/><line x1="290" y1="90" x2="272" y2="84"/><line x1="272" y1="84" x2="262" y2="78"/><line x1="290" y1="94" x2="304" y2="106"/>
      </g>
      <circle cx="93" cy="72" r="1.3" fill="var(--s)"/><circle cx="99" cy="72" r="1.3" fill="var(--s)"/><path d="M92 78 Q96 80 100 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="287" cy="72" r="1.3" fill="var(--s)"/><circle cx="293" cy="72" r="1.3" fill="var(--s)"/><path d="M286 78 Q290 80 294 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <ellipse cx="75" cy="122" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="254" cy="74" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <circle cx="120" cy="100" r="6" fill="#EF9F27"/>
      <rect x="150" y="6" width="160" height="26" rx="8" fill="var(--bg2)" stroke="#639922" stroke-width="1.6"/><polygon points="244,32 260,32 252,44" fill="var(--bg2)"/><text class="th" x="230" y="24" text-anchor="middle">MY GUESS: LEFT</text>
      <path d="M252 46 L254 62" fill="none" stroke="var(--b)" stroke-width="1.4" stroke-dasharray="3 3"/>
      </svg>
      <p class="jvCarCap">Step 2 — after a 3-second pause the catcher moves the paddle to their guess. Still no throw.</p>
    </div>

    <div class="jvCarSlide" role="group" aria-roledescription="slide" aria-label="Step 3 of 3">
      <svg width="100%" viewBox="0 0 380 160" role="img"><title>Step 3 — one throw reveals whether the guess was right</title><desc>The same single ball is thrown along one path. The paddle was already waiting there, so the guess was correct.</desc>
      <defs><marker id="m28ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      <line x1="24" y1="150" x2="356" y2="150" stroke="var(--b)" stroke-width="1"/>
      <g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="96" cy="74" r="9"/><line x1="96" y1="83" x2="96" y2="112"/><line x1="96" y1="112" x2="86" y2="150"/><line x1="96" y1="112" x2="106" y2="150"/><line x1="96" y1="90" x2="118" y2="78"/><line x1="96" y1="92" x2="82" y2="106"/><line x1="82" y1="106" x2="78" y2="114"/>
      <circle cx="290" cy="74" r="9"/><line x1="290" y1="83" x2="290" y2="112"/><line x1="290" y1="112" x2="280" y2="150"/><line x1="290" y1="112" x2="300" y2="150"/><line x1="290" y1="90" x2="272" y2="84"/><line x1="272" y1="84" x2="262" y2="78"/><line x1="290" y1="94" x2="304" y2="106"/>
      </g>
      <circle cx="93" cy="72" r="1.3" fill="var(--s)"/><circle cx="99" cy="72" r="1.3" fill="var(--s)"/><path d="M92 78 Q96 80 100 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="287" cy="72" r="1.3" fill="var(--s)"/><circle cx="293" cy="72" r="1.3" fill="var(--s)"/><path d="M286 78 Q290 80 294 78" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
      <ellipse cx="75" cy="122" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <ellipse cx="254" cy="74" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
      <path d="M136 72 Q192 52 246 68" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#m28ar)"/>
      <circle cx="128" cy="74" r="6" fill="#EF9F27"/>
      <rect x="132" y="4" width="142" height="28" rx="9" fill="var(--bg2)" stroke="#639922" stroke-width="1.6"/>
      <path d="M148 18 L154 25 L165 11" fill="none" stroke="#639922" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <text class="th" x="222" y="23" text-anchor="middle">MIND READ!</text>
      </svg>
      <p class="jvCarCap">Step 3 — one throw, one ball. The paddle was already waiting: that is a mind read.</p>
    </div>

  </div>
  <div class="jvCarBar">
    <button type="button" class="jvCarNav" data-jv-car-prev aria-label="Previous step"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 L8 12 L15 19"/></svg></button>
    <div class="jvCarDots">
      <button type="button" class="jvCarDot" data-jv-car-dot aria-label="Step 1 of 3"></button>
      <button type="button" class="jvCarDot" data-jv-car-dot aria-label="Step 2 of 3"></button>
      <button type="button" class="jvCarDot" data-jv-car-dot aria-label="Step 3 of 3"></button>
    </div>
    <button type="button" class="jvCarNav" data-jv-car-next aria-label="Next step"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5 L16 12 L9 19"/></svg></button>
    <span class="jvCarCount" data-jv-car-count>1 / 3</span>
  </div>
  <p class="sr-only" aria-live="polite" data-jv-car-live></p>
</div>`,
  29: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Stuck-Foot Catch</title><desc>Stuck-Foot Catch</desc>
<defs><marker id="g29ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="50" y1="122" x2="330" y2="122" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="118" cy="56" r="9"/><line x1="118" y1="65" x2="118" y2="96"/><line x1="118" y1="96" x2="108" y2="118"/><line x1="118" y1="96" x2="128" y2="118"/><line x1="118" y1="70" x2="140" y2="58"/><line x1="118" y1="72" x2="106" y2="84"/><line x1="106" y1="84" x2="101" y2="92"/>
<circle cx="270" cy="56" r="9"/><line x1="270" y1="65" x2="270" y2="96"/><line x1="270" y1="96" x2="260" y2="118"/><line x1="270" y1="96" x2="280" y2="118"/><line x1="270" y1="70" x2="252" y2="58"/><line x1="252" y1="58" x2="247" y2="50"/><line x1="270" y1="72" x2="282" y2="84"/></g>
<ellipse cx="102" cy="92" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="236" cy="46" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="115" cy="54" r="1.3" fill="var(--s)"/><circle cx="121" cy="54" r="1.3" fill="var(--s)"/><path d="M114 60 Q118 62 122 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="259" cy="54" r="1.3" fill="var(--s)"/><circle cx="264" cy="55" r="1.3" fill="var(--s)"/>
<ellipse cx="118" cy="123" rx="18" ry="4" fill="none" stroke="var(--s)" stroke-width="1.6"/>
<ellipse cx="262" cy="123" rx="18" ry="4" fill="none" stroke="var(--s)" stroke-width="1.6"/>
<g stroke="var(--s)" stroke-width="1.4" stroke-linecap="round"><line x1="108" y1="123" x2="108" y2="128"/><line x1="128" y1="123" x2="128" y2="128"/><line x1="252" y1="123" x2="252" y2="128"/><line x1="272" y1="123" x2="272" y2="128"/></g>
<path d="M144 56 Q190 40 236 48" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g29ar)"/>
<circle cx="144" cy="56" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round"><line x1="250" y1="112" x2="228" y2="112" opacity="0.4" marker-end="url(#g29ar)"/><line x1="234" y1="107" x2="244" y2="117"/><line x1="244" y1="107" x2="234" y2="117"/></g>
<text class="ts" x="190" y="143" text-anchor="middle">Feet glued to the spot — catch in place, no chasing</text>
</svg>`,
  30: `<svg width="100%" viewBox="0 0 380 162" role="img"><title>Left or Right!</title><desc>Left or Right!</desc>
<defs><marker id="g30c" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<g fill="none" stroke="var(--s)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="186" cy="26" r="8"/><line x1="186" y1="34" x2="186" y2="56"/><line x1="186" y1="56" x2="179" y2="72"/><line x1="186" y1="56" x2="193" y2="72"/><line x1="186" y1="40" x2="170" y2="48"/><line x1="186" y1="40" x2="200" y2="46"/></g>
<circle cx="183" cy="24" r="1.2" fill="var(--s)"/><circle cx="189" cy="24" r="1.2" fill="var(--s)"/>
<g><rect x="200" y="12" width="48" height="19" rx="7" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.4"/><polygon points="206,31 218,31 204,40" fill="var(--bg2)" stroke="none"/><text class="th" x="224" y="25" text-anchor="middle">RIGHT!</text></g>
<g fill="none" stroke="var(--s)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
<circle cx="158" cy="96" r="11"/><line x1="158" y1="107" x2="158" y2="138"/><line x1="158" y1="138" x2="147" y2="158"/><line x1="158" y1="138" x2="169" y2="158"/><line x1="158" y1="114" x2="196" y2="108"/><line x1="196" y1="108" x2="206" y2="104"/></g>
<ellipse cx="214" cy="100" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.6"/>
<g opacity="0.3"><line x1="158" y1="114" x2="120" y2="108" stroke="var(--s)" stroke-width="2.6" stroke-linecap="round"/><line x1="120" y1="108" x2="110" y2="104" stroke="var(--s)" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="102" cy="100" rx="7" ry="9" fill="none" stroke="var(--s)" stroke-width="2.4" stroke-dasharray="3 3"/></g>
<text class="ts" x="102" y="128" text-anchor="middle" opacity="0.5">LEFT</text>
<text class="th" x="214" y="128" text-anchor="middle" fill="#EF9F27">RIGHT</text>
<path d="M180 50 Q216 64 210 92" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g30c)"/>
<circle cx="208" cy="90" r="6" fill="#EF9F27"/>
<text class="ts" x="190" y="154" text-anchor="middle">Caller shouts a side — catcher (from behind) turns the paddle that way</text>
</svg>`,
  31: `<svg width="100%" viewBox="0 0 380 190" role="img"><title>Cloud Chaser</title><desc>Cloud Chaser</desc>
<defs><marker id="g31b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="40" y1="170" x2="340" y2="170" stroke="var(--b)" stroke-width="1"/>
<g fill="var(--b)" opacity="0.55"><circle cx="214" cy="30" r="8"/><circle cx="226" cy="25" r="10"/><circle cx="238" cy="31" r="8"/><rect x="214" y="28" width="24" height="9"/></g>
<path d="M88 92 Q190 6 290 78" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 6" stroke-linecap="round" marker-end="url(#g31b)"/>
<circle cx="178" cy="22" r="6.5" fill="#EF9F27"/>
<circle cx="120" cy="46" r="4.5" fill="#EF9F27" opacity="0.3"/><circle cx="246" cy="46" r="4.5" fill="#EF9F27" opacity="0.3"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="70" cy="100" r="9"/><line x1="70" y1="109" x2="70" y2="138"/><line x1="70" y1="138" x2="60" y2="168"/><line x1="70" y1="138" x2="80" y2="168"/><line x1="70" y1="112" x2="88" y2="92"/><line x1="70" y1="114" x2="56" y2="124"/>
<circle cx="67" cy="98" r="1.3" fill="var(--s)"/><circle cx="73" cy="98" r="1.3" fill="var(--s)"/>
<circle cx="312" cy="100" r="9"/><line x1="312" y1="109" x2="312" y2="138"/><line x1="312" y1="138" x2="302" y2="168"/><line x1="312" y1="138" x2="322" y2="168"/><line x1="312" y1="112" x2="296" y2="90"/><line x1="296" y1="90" x2="291" y2="82"/><line x1="312" y1="114" x2="326" y2="124"/></g>
<ellipse cx="288" cy="76" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<circle cx="309" cy="97" r="1.3" fill="var(--s)"/><circle cx="315" cy="97" r="1.3" fill="var(--s)"/><path d="M308 102 Q312 105 316 102" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<text class="ts" x="190" y="184" text-anchor="middle">Step 6 apart — throw it high, watch it down, catch with the paddle</text>
</svg>`,
  32: `<svg width="100%" viewBox="0 0 380 168" role="img"><title>Home Base</title><desc>Home Base</desc>
<defs><marker id="g32b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<polygon points="90,116 132,116 142,138 80,138" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.8"/>
<polygon points="248,116 290,116 300,138 238,138" fill="var(--bg2)" stroke="var(--s)" stroke-width="1.8"/>
<text class="ts" x="111" y="132" text-anchor="middle" opacity="0.7">BASE</text>
<text class="ts" x="269" y="132" text-anchor="middle" opacity="0.7">BASE</text>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="112" cy="54" r="9"/><line x1="112" y1="63" x2="112" y2="92"/><line x1="112" y1="92" x2="104" y2="116"/><line x1="112" y1="92" x2="120" y2="116"/><line x1="112" y1="68" x2="134" y2="56"/><line x1="112" y1="70" x2="100" y2="82"/><line x1="100" y1="82" x2="95" y2="90"/>
<circle cx="109" cy="52" r="1.3" fill="var(--s)"/><circle cx="115" cy="52" r="1.3" fill="var(--s)"/><path d="M108 58 Q112 61 116 58" stroke-width="1.3"/>
<circle cx="268" cy="54" r="9"/><line x1="268" y1="63" x2="268" y2="92"/><line x1="268" y1="92" x2="260" y2="116"/><line x1="268" y1="92" x2="276" y2="116"/><line x1="268" y1="68" x2="250" y2="56"/><line x1="250" y1="56" x2="245" y2="48"/><line x1="268" y1="70" x2="280" y2="82"/>
<circle cx="265" cy="52" r="1.3" fill="var(--s)"/><circle cx="271" cy="52" r="1.3" fill="var(--s)"/><path d="M264 58 Q268 61 272 58" stroke-width="1.3"/></g>
<ellipse cx="91" cy="90" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="242" cy="44" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<path d="M138 54 Q190 40 244 46" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g32b)"/>
<circle cx="138" cy="54" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round"><line x1="148" y1="126" x2="168" y2="126" opacity="0.4" marker-end="url(#g32b)"/><line x1="153" y1="121" x2="163" y2="131"/><line x1="163" y1="121" x2="153" y2="131"/></g>
<text class="ts" x="190" y="160" text-anchor="middle">Each stays on their BASE square — step off = miss</text>
</svg>`,
  33: `<svg width="100%" viewBox="0 0 380 178" role="img"><title>How Far Can You Throw?</title><desc>How Far Can You Throw?</desc>
<defs><marker id="g33b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<text class="ts" x="190" y="22" text-anchor="middle">3 catches → both step back 2</text>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="150" cy="56" r="9"/><line x1="150" y1="65" x2="150" y2="94"/><line x1="150" y1="94" x2="143" y2="116"/><line x1="150" y1="94" x2="157" y2="116"/><line x1="150" y1="70" x2="170" y2="58"/><line x1="150" y1="72" x2="139" y2="84"/><line x1="139" y1="84" x2="134" y2="92"/>
<circle cx="147" cy="54" r="1.3" fill="var(--s)"/><circle cx="153" cy="54" r="1.3" fill="var(--s)"/><path d="M146 60 Q150 63 154 60" stroke-width="1.3"/>
<circle cx="230" cy="56" r="9"/><line x1="230" y1="65" x2="230" y2="94"/><line x1="230" y1="94" x2="223" y2="116"/><line x1="230" y1="94" x2="237" y2="116"/><line x1="230" y1="70" x2="213" y2="58"/><line x1="213" y1="58" x2="208" y2="50"/><line x1="230" y1="72" x2="242" y2="84"/>
<circle cx="227" cy="54" r="1.3" fill="var(--s)"/><circle cx="233" cy="54" r="1.3" fill="var(--s)"/><path d="M226 60 Q230 63 234 60" stroke-width="1.3"/></g>
<ellipse cx="130" cy="92" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<ellipse cx="205" cy="46" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<path d="M174 56 Q190 42 207 50" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g33b)"/>
<circle cx="174" cy="56" r="6" fill="#EF9F27"/>
<text class="th" x="190" y="40" text-anchor="middle">3×</text>
<g stroke="var(--s)" stroke-width="2" stroke-linecap="round"><line x1="140" y1="106" x2="114" y2="106" marker-end="url(#g33b)"/><line x1="240" y1="106" x2="266" y2="106" marker-end="url(#g33b)"/></g>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round"><line x1="150" y1="128" x2="230" y2="128"/><line x1="150" y1="123" x2="150" y2="133"/><line x1="230" y1="123" x2="230" y2="133"/></g>
<text class="ts" x="190" y="146" text-anchor="middle">6 steps</text>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round" opacity="0.7"><line x1="106" y1="158" x2="274" y2="158"/><line x1="106" y1="153" x2="106" y2="163"/><line x1="274" y1="153" x2="274" y2="163"/></g>
<text class="ts" x="190" y="176" text-anchor="middle" opacity="0.8">10 steps → how far can you go?</text>
</svg>`,
  34: `<svg width="100%" viewBox="0 0 380 150" role="img"><title>Chase the Ball!</title><desc>Chase the Ball!</desc>
<defs><marker id="g34ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<line x1="30" y1="126" x2="350" y2="126" stroke="var(--b)" stroke-width="1"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="66" cy="52" r="9"/><line x1="66" y1="61" x2="66" y2="90"/><line x1="66" y1="90" x2="56" y2="122"/><line x1="66" y1="90" x2="76" y2="122"/><line x1="66" y1="66" x2="90" y2="56"/><line x1="66" y1="68" x2="52" y2="80"/>
<circle cx="63" cy="50" r="1.3" fill="var(--s)"/><circle cx="69" cy="50" r="1.3" fill="var(--s)"/><path d="M62 56 Q66 59 70 56" stroke-width="1.3"/></g>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="250" cy="50" r="9"/><line x1="250" y1="59" x2="244" y2="84"/><line x1="244" y1="84" x2="258" y2="96"/><line x1="258" y1="96" x2="266" y2="116"/><line x1="244" y1="84" x2="232" y2="94"/><line x1="232" y1="94" x2="224" y2="114"/><line x1="248" y1="64" x2="266" y2="56"/><line x1="266" y1="56" x2="276" y2="50"/><line x1="248" y1="66" x2="236" y2="74"/>
<circle cx="248" cy="48" r="1.3" fill="var(--s)"/><circle cx="254" cy="48" r="1.3" fill="var(--s)"/><path d="M247 54 Q251 56 255 54" stroke-width="1.3"/></g>
<ellipse cx="284" cy="44" rx="6" ry="8" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round" opacity="0.5"><line x1="222" y1="58" x2="208" y2="58"/><line x1="220" y1="68" x2="204" y2="68"/><line x1="222" y1="78" x2="208" y2="78"/></g>
<path d="M92 54 Q200 14 284 40" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g34ar)"/>
<circle cx="284" cy="40" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.4" stroke-linecap="round" opacity="0.35"><line x1="280" y1="120" x2="288" y2="128"/><line x1="288" y1="120" x2="280" y2="128"/></g>
<text class="ts" x="190" y="142" text-anchor="middle">Thrower tosses it ahead — catcher runs and catches before it lands</text>
</svg>`,
  35: `<svg width="100%" viewBox="0 0 380 176" role="img"><title>Sky High Jump</title><desc>The thrower stays on the ground and sends the one ball in a gentle arc just above normal standing reach. The catcher jumps, meets it with a raised paddle and lands on flat grass.</desc>
<defs><marker id="g35ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>

<!-- Flat, soft grass — the only surface this mission is safe on. -->
<line x1="20" y1="152" x2="360" y2="152" stroke="var(--b)" stroke-width="1"/>
<g stroke="var(--b)" stroke-width="1.4" stroke-linecap="round" opacity="0.8">
<path d="M32 152 L30 145"/><path d="M36 152 L39 146"/><path d="M108 152 L106 145"/><path d="M112 152 L115 146"/><path d="M158 152 L156 146"/><path d="M186 152 L189 145"/><path d="M214 152 L212 146"/><path d="M242 152 L245 145"/><path d="M300 152 L298 145"/><path d="M304 152 L307 146"/><path d="M332 152 L330 146"/><path d="M336 152 L339 145"/>
</g>

<!-- THROWER — both feet on the ground, controlled underarm-height release, second paddle in the other hand. -->
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="80" cy="76" r="9"/><line x1="80" y1="85" x2="80" y2="114"/><line x1="80" y1="114" x2="70" y2="152"/><line x1="80" y1="114" x2="92" y2="152"/><line x1="80" y1="92" x2="100" y2="78"/><line x1="80" y1="94" x2="66" y2="106"/><line x1="66" y1="106" x2="60" y2="114"/>
</g>
<circle cx="77" cy="74" r="1.3" fill="var(--s)"/><circle cx="83" cy="74" r="1.3" fill="var(--s)"/><path d="M76 80 Q80 82 84 80" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<ellipse cx="55" cy="122" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>

<!-- The ball's one gentle arc: it peaks only a little over the dashed standing-reach line. -->
<path d="M120 62 Q180 32 236 36" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 5" stroke-linecap="round" marker-end="url(#g35ar)"/>
<circle cx="110" cy="70" r="6" fill="#EF9F27"/>
<g stroke="var(--s)" stroke-width="1.4" opacity="0.45"><path d="M120 58 L232 58" stroke-dasharray="4 4"/><path d="M120 52 L120 64"/><path d="M232 52 L232 64"/></g>
<text class="ts" x="176" y="74" text-anchor="middle" opacity="0.6">normal reach</text>

<!-- CATCHER — a small hop, knees soft for the landing, one raised paddle meeting the ball. -->
<ellipse cx="278" cy="152" rx="18" ry="4" fill="var(--s)" opacity="0.22"/>
<g fill="none" stroke="var(--s)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="278" cy="56" r="9"/><line x1="278" y1="65" x2="278" y2="92"/><line x1="278" y1="92" x2="265" y2="106"/><line x1="265" y1="106" x2="270" y2="121"/><line x1="278" y1="92" x2="291" y2="106"/><line x1="291" y1="106" x2="286" y2="121"/><line x1="278" y1="70" x2="266" y2="56"/><line x1="266" y1="56" x2="256" y2="44"/><line x1="278" y1="72" x2="294" y2="86"/>
</g>
<circle cx="275" cy="54" r="1.3" fill="var(--s)"/><circle cx="281" cy="54" r="1.3" fill="var(--s)"/><path d="M274 60 Q278 62 282 60" fill="none" stroke="var(--s)" stroke-width="1.3" stroke-linecap="round"/>
<ellipse cx="247" cy="37" rx="7" ry="9" fill="#85B7EB" stroke="#639922" stroke-width="2.4"/>
<g stroke="var(--s)" stroke-width="1.6" stroke-linecap="round" opacity="0.35"><line x1="268" y1="132" x2="268" y2="142"/><line x1="278" y1="134" x2="278" y2="144"/><line x1="288" y1="132" x2="288" y2="142"/></g>

<text class="ts" x="190" y="170" text-anchor="middle">Aim just above reach — one small jump, soft knees on landing</text>
</svg>`,
  36: `<style>
.jrw{display:flex;align-items:center;justify-content:center;gap:6px;font-family:var(--font-sans);padding:2px 0;}
.jrw .panel{flex:1 1 0;min-width:0;border:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:10px 6px 8px;display:flex;flex-direction:column;align-items:center;}
.jrw .panel svg{width:100%;height:auto;display:block;}
.jrw .cap{font-size:12px;color:var(--color-text-secondary);text-align:center;margin-top:6px;line-height:1.35;}
.jrw .chev{flex:0 0 auto;color:var(--color-text-tertiary);}
.jrw text.ts{font-size:12px;fill:var(--color-text-secondary);}
.jrw text.th{font-size:13px;fill:var(--color-text-primary);font-weight:500;}
.jrw .fig{fill:none;stroke:var(--color-text-secondary);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
</style>
<div class="jrw">
<div class="panel">
<svg viewBox="0 0 200 118" role="img"><title>Marathon Rally</title><desc>Marathon Rally</desc>
<defs><marker id="m1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<g fill="#EF9F27"><circle cx="56" cy="12" r="2.4"/><circle cx="68" cy="12" r="2.4"/><circle cx="80" cy="12" r="2.4"/><circle cx="92" cy="12" r="2.4"/><circle cx="104" cy="12" r="2.4"/></g>
<text class="th" x="114" y="16" text-anchor="start">…20!</text>
<g class="fig">
<circle cx="60" cy="50" r="8"/><line x1="60" y1="58" x2="60" y2="84"/><line x1="60" y1="84" x2="53" y2="106"/><line x1="60" y1="84" x2="67" y2="106"/><line x1="60" y1="63" x2="77" y2="51"/><line x1="77" y1="51" x2="81" y2="45"/><line x1="60" y1="65" x2="50" y2="76"/>
<path d="M56 53 Q60 55 64 53" stroke-width="1.2"/>
<circle cx="140" cy="50" r="8"/><line x1="140" y1="58" x2="140" y2="84"/><line x1="140" y1="84" x2="133" y2="106"/><line x1="140" y1="84" x2="147" y2="106"/><line x1="140" y1="63" x2="123" y2="51"/><line x1="123" y1="51" x2="119" y2="45"/><line x1="140" y1="65" x2="150" y2="76"/>
<path d="M136 53 Q140 55 144 53" stroke-width="1.2"/>
</g>
<circle cx="57" cy="48" r="1.2" fill="var(--color-text-secondary)"/><circle cx="63" cy="48" r="1.2" fill="var(--color-text-secondary)"/>
<circle cx="137" cy="48" r="1.2" fill="var(--color-text-secondary)"/><circle cx="143" cy="48" r="1.2" fill="var(--color-text-secondary)"/>
<ellipse cx="83" cy="42" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<ellipse cx="117" cy="42" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<path d="M88 38 Q100 23 112 38" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-linecap="round" marker-end="url(#m1)"/>
<path d="M112 50 Q100 65 88 50" fill="none" stroke="#EF9F27" stroke-width="2.2" stroke-dasharray="4 4" stroke-linecap="round" marker-end="url(#m1)"/>
<circle cx="100" cy="24" r="5" fill="#EF9F27"/>
<line x1="28" y1="108" x2="172" y2="108" stroke="var(--color-border-tertiary)" stroke-width="1"/>
</svg>
<div class="cap">Start close — rally back and forth, <b>don’t drop</b>!</div>
</div>
<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
<div class="panel">
<svg viewBox="0 0 200 118" role="img"><title>Marathon Rally</title><desc>Marathon Rally</desc>
<defs><marker id="m2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<text class="th" x="100" y="16" text-anchor="middle">5 ✓</text>
<g class="fig">
<circle cx="64" cy="50" r="8"/><line x1="64" y1="58" x2="64" y2="84"/><line x1="64" y1="84" x2="57" y2="106"/><line x1="64" y1="84" x2="71" y2="106"/><line x1="64" y1="63" x2="81" y2="51"/><line x1="81" y1="51" x2="85" y2="45"/><line x1="64" y1="65" x2="54" y2="76"/>
<path d="M60 53 Q64 55 68 53" stroke-width="1.2"/>
<circle cx="136" cy="50" r="8"/><line x1="136" y1="58" x2="136" y2="84"/><line x1="136" y1="84" x2="129" y2="106"/><line x1="136" y1="84" x2="143" y2="106"/><line x1="136" y1="63" x2="119" y2="51"/><line x1="119" y1="51" x2="115" y2="45"/><line x1="136" y1="65" x2="146" y2="76"/>
<path d="M132 53 Q136 55 140 53" stroke-width="1.2"/>
</g>
<circle cx="61" cy="48" r="1.2" fill="var(--color-text-secondary)"/><circle cx="67" cy="48" r="1.2" fill="var(--color-text-secondary)"/>
<circle cx="133" cy="48" r="1.2" fill="var(--color-text-secondary)"/><circle cx="139" cy="48" r="1.2" fill="var(--color-text-secondary)"/>
<ellipse cx="87" cy="42" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<ellipse cx="113" cy="42" rx="5" ry="7" fill="#85B7EB" stroke="#639922" stroke-width="2.2"/>
<g stroke="var(--color-text-secondary)" stroke-width="1.8" stroke-linecap="round"><line x1="48" y1="100" x2="28" y2="100" marker-end="url(#m2)"/><line x1="152" y1="100" x2="172" y2="100" marker-end="url(#m2)"/></g>
<text class="ts" x="38" y="95" text-anchor="middle">1 step</text>
<text class="ts" x="162" y="95" text-anchor="middle">1 step</text>
<line x1="20" y1="110" x2="180" y2="110" stroke="var(--color-border-tertiary)" stroke-width="1"/>
</svg>
<div class="cap">Every <b>5</b> catches, both <b>step back 1</b></div>
</div>
</div>`,
};

/* ============================================================
 * BRANDED EQUIPMENT SWAP (runtime decorator — the 36 diagrams above
 * are NOT redrawn; this rewrites their generic paddle ellipses and
 * ball circles into <use> refs of the real JUMVI product art).
 *
 * - Paddle: every <ellipse fill="#85B7EB" stroke="#639922"> → #jmvEqPaddle,
 *   sized from rx/ry, centered on the same cx/cy, rotation preserved.
 * - Ball: every SOLID <circle fill="#EF9F27"> (no opacity) → #jmvEqBall.
 *   Trail circles (opacity<1) stay — they read as motion, not equipment.
 * - Catch: a ball whose center sits on/next to a paddle face merges into
 *   #jmvEqCatch (ball-on-paddle product shot) and the ball is dropped.
 * - The symbols carry the 128px PNGs (quantized, ~2-5KB each).
 * ============================================================ */
(function brandEquipment(){
  if (typeof document === "undefined") return;
  var V = "20260718-1";
  var DEFS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
      '<symbol id="jmvEqPaddle" viewBox="0 0 128 128"><image href="assets/equipment/jumvi-paddle-128.png?v=' + V + '" width="128" height="128"/></symbol>' +
      '<symbol id="jmvEqBall" viewBox="0 0 128 128"><image href="assets/equipment/jumvi-ball-128.png?v=' + V + '" width="128" height="128"/></symbol>' +
      '<symbol id="jmvEqCatch" viewBox="0 0 128 128"><image href="assets/equipment/jumvi-catch-128.png?v=' + V + '" width="128" height="128"/></symbol>' +
    '</svg>';
  function injectDefs(){
    if (document.getElementById("jmvEqPaddle")) return;
    var host = document.createElement("div");
    host.innerHTML = DEFS;
    document.body.appendChild(host.firstChild);
  }
  if (document.body) injectDefs();
  else document.addEventListener("DOMContentLoaded", injectDefs);

  var ELLIPSE_RE = /<ellipse ([^>]*?)fill="#85B7EB" stroke="#639922"([^>]*?)\/>/g;
  var BALL_RE = /<circle cx="([0-9.]+)" cy="([0-9.]+)" r="([0-9.]+)" fill="#EF9F27"\/>/g;
  function attr(s, name){
    var m = s.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : null;
  }
  function useTag(id, cx, cy, size, transform){
    var half = size / 2;
    return '<use href="#' + id + '" x="' + (cx - half).toFixed(1) + '" y="' + (cy - half).toFixed(1) +
      '" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '"' +
      (transform ? ' transform="' + transform + '"' : '') + '/>';
  }
  // The Play Mode diagrams (play-mode-icons.js) draw their paddle and ball with
  // the same placeholder colours, so they get the same swap — the equipment
  // stays photographic in both tabs and only the action is line art. Guarded on
  // presence: mission icons must keep working if that file is not loaded.
  var SETS = [MISSION_ICONS];
  if (typeof window !== "undefined" && window.JUMVI_PLAY_MODE_ICONS) {
    SETS.push(window.JUMVI_PLAY_MODE_ICONS);
  }
  SETS.forEach(function(ICONS){
  Object.keys(ICONS).forEach(function(id){
    var src = ICONS[id];
    if (src.indexOf("#85B7EB") < 0 && src.indexOf("#EF9F27") < 0) return;

    // Pass 1 — collect paddles (position + size) so balls can test proximity.
    var paddles = [];
    src.replace(ELLIPSE_RE, function(full, pre, post){
      var all = pre + post;
      paddles.push({
        full: full,
        cx: parseFloat(attr(all, "cx")), cy: parseFloat(attr(all, "cy")),
        rx: parseFloat(attr(all, "rx")), ry: parseFloat(attr(all, "ry")),
        transform: attr(all, "transform"), isCatch: false
      });
      return full;
    });

    // Pass 2 — solid balls: those resting ON a paddle face merge into a catch.
    var out = src.replace(BALL_RE, function(full, cxs, cys, rs){
      var cx = parseFloat(cxs), cy = parseFloat(cys), r = parseFloat(rs);
      for (var i = 0; i < paddles.length; i++) {
        var p = paddles[i];
        var d = Math.hypot(cx - p.cx, cy - p.cy);
        if (d <= p.ry + r + 2) { p.isCatch = true; return ""; } // ball merges into the paddle
      }
      // 2.4×r: the ball artwork fills ~85% of its square canvas, so this
      // renders the visible ball at ≈ the old circle's diameter.
      return useTag("jmvEqBall", cx, cy, r * 2.4, null);
    });

    // Pass 3 — paddles (now knowing which ones hold a ball).
    var pi = 0;
    out = out.replace(ELLIPSE_RE, function(){
      var p = paddles[pi++];
      // 2.7×ry: paddle artwork is ~86% of its canvas; keys off ry (the long
      // axis) so all the different rx/ry combos land at the drawn size.
      return useTag(p.isCatch ? "jmvEqCatch" : "jmvEqPaddle", p.cx, p.cy, p.ry * 2.7, p.transform);
    });

    ICONS[id] = out;
  });
  });
})();

// FIX: expose on window for non-module consumers
if(typeof window !== "undefined"){
  window.MISSION_ICONS = MISSION_ICONS;
  window.MISSION_NAMES = MISSION_NAMES;
  window.MISSION_PACKS = MISSION_PACKS;
}
