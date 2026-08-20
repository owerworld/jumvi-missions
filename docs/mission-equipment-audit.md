# Mission Equipment Audit

Baseline: `b53448a9d5d681297b5edea288240a269301e2ac` (`origin/main`)
Baseline service-worker cache: `jumvi-missions-v234`

The Mission Detail “You need” row was globally hardcoded in `index.html` as two paddles and one soft ball. Mission records had player, timing, rules, win, safety, and tip fields, but no equipment metadata. This pass adds an `equipment` object to every mission and makes `openMission()` render that data into the existing two-chip layout.

Equipment counts use integers for fixed quantities and a two-integer inclusive range for variable paddle counts. Zero-count items are omitted. Player labels describe active paddle players and are bounded by the retail kit’s four paddles.

| ID | Mission | Players | Paddles | Balls | Notes |
|---:|---|---:|---:|---:|---|
| 1 | Speed Demon | 2 | 2 | 1 | Standard partner catch. |
| 2 | Red Light, Green Light | 2–3 | 2–3 | 1 | A third active player may act within the caller game; each active player has a paddle. |
| 3 | Quick Slap | 2 | 2 | 1 | Standard partner catch. |
| 4 | Switcharoo | 2 | 2 | 1 | Standard partner catch. |
| 5 | Statue Mode | 2 | 2 | 1 | Standard partner catch. |
| 6 | Number Echo | 2 | 2 | 1 | Standard partner catch. |
| 7 | Rainbow Throws | 2 | 2 | 1 | Standard partner catch. |
| 8 | The Landing Pad | 2 | 2 | 1 | Standard partner catch. |
| 9 | Step-Back Challenge | 2 | 2 | 1 | Standard partner catch. |
| 10 | Power Step | 2 | 2 | 1 | Standard partner catch. |
| 11 | Sky Floater | 2 | 2 | 1 | Standard partner catch. |
| 12 | Heart-High | 2 | 2 | 1 | Standard partner catch. |
| 13 | Silent Mode | 2 | 2 | 1 | Standard partner catch. |
| 14 | Tempo Master | 2 | 2 | 1 | Standard partner catch. |
| 15 | Spotlight Eyes | 2 | 2 | 1 | Standard partner catch. |
| 16 | 1 — 2 — 3 — GO! | 2 | 2 | 1 | Standard partner catch. |
| 17 | Mirror Mode | 2 | 2 | 1 | Standard partner catch. |
| 18 | Count to 10 | 2 | 2 | 1 | Standard partner catch. |
| 19 | Round Robin | 3–4 | 3–4 | 1 | The rules say everyone stands in a circle holding a paddle. The former 3–6 label exceeded the four-paddle kit, so active play is bounded at four; one ball moves around the circle. |
| 20 | Crab Walk Relay | 4 | 4 | 1 | Shared-ball/turn-based relay. The rules repeatedly use singular “the ball,” and the approved illustration shows one ball moving along one pass path before the player rotates to the back. The two lines therefore share one relay ball rather than running two simultaneous ball paths. |
| 21 | Captain Says | 3–4 | 3–4 | 1 | The captain calls one teammate and throws one ball. The former 3+ label is bounded at four active paddle players; captain rotation still gives everyone a turn. |
| 22 | Spin Squad | 4 | 4 | 1 | The source explicitly places four paddle players in a square while one player throws the single ball. |
| 23 | Mix It Up | 4 | 4 | 1 | Shared-ball/turn-based pairs. The rules use one catch sequence and one partner swap cycle, while the approved illustration shows one ball connecting the four paddles. Pairs rotate through that shared ball; the repository does not define two concurrent rallies. |
| 24 | 2v2 Squad Count | 4 | 4 | 1 | The rules explicitly say each team gets five catches “then the other team goes.” All four players have paddles, but the teams take turns with one ball; two simultaneous balls would contradict the mechanic. |
| 25 | Chill Catch | 2 | 2 | 1 | Standard partner catch. |
| 26 | Tiny Space | 2 | 2 | 1 | Standard partner catch. |
| 27 | Secret Signal | 2–3 | 2–3 | 1 | Two or three active players share one ball; each active catcher uses a paddle. |
| 28 | Mind Reader | 2 | 2 | 1 | Standard partner catch. |
| 29 | Stuck-Foot Catch | 2 | 2 | 1 | Standard partner catch. |
| 30 | Left or Right! | 2 | 2 | 1 | Standard partner catch. |
| 31 | Cloud Chaser | 2 | 2 | 1 | Standard partner catch. |
| 32 | Home Base | 2 | 2 | 1 | Standard partner catch. |
| 33 | How Far Can You Throw? | 2 | 2 | 1 | Standard partner catch. |
| 34 | Chase the Ball! | 2 | 2 | 1 | Standard partner catch. |
| 35 | Sky High Jump | 2 | 2 | 1 | Standard partner catch. |
| 36 | Marathon Rally | 2 | 2 | 1 | Standard partner catch. |

## Consistency outcome

- Missions with fixed counts render singular/plural labels from the numeric data (`1 paddle`, `2 paddles`, `1 soft ball`, `2 soft balls`).
- Ranges render with an en dash (`2–3 paddles`, `3–4 paddles`).
- The maximum active requirement is four paddles and one ball.
- Missions 19, 20, 21, and 23 no longer imply more than four active paddle players. The Mission Detail player-count control is also bounded at `4` instead of `4+`.
- Mission 24 remains a turn-taking 2v2 activity with one shared ball.
- No mission rules, audio routing, Coach Leo assets, mission illustrations, or navigation were changed.
