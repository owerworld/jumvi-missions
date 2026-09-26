# JUMVI M6 visual correction register — local review only

The original `catalog-v3` and `final` files remain untouched. The baseline had **28 entry hero mappings** whose repeated upright actor did not make the mission movement legible. The current local packaged app has 26 repeated mappings plus two unaccepted replacements; m05, m09 and m13 now have separate local, mobile-scale replacement **candidates**, not accepted replacement art. No art acceptance or deployment is implied.

| Mission | Distinct action that must be visible | Current entry hero deficiency | Existing asset sufficient? / concrete correction |
|---|---|---|---|
| m01 Speed Demon | Short quick alternation while the ball reaches a paddle face | Upright actor and two near-identical poses do not show quick exchange | No. Controlled two-person toss → sticky catch sequence needed. |
| m02 Red Light, Green Light | Human caller's Green toss / Red freeze, with role handoff | Standing paddles do not establish caller or stopped moment | No. Human caller plus separate Green/Red moments; no phone caller. |
| m05 Statue Mode | Ball sticks, then body and paddle freeze for two seconds | Standing actor could be any catch task | New `m05-freeze-candidate-v1` shows one blue-front catch and freeze posture in local app; strap-hand angle and two-second continuity still need review. |
| m06 Number Echo | Thrower calls a number during a soft pass | Static actor does not connect speech to throw | No. Throw/reply moments with one ball and distinct speaking role. |
| m09 Step-Back Challenge | After three catches, both players move a half-step back | Repeated stance and small annotation do not make the distance change legible | New `m09-backstep-candidate-v1` shows a one-ball reset and both backward steps locally; verify the receiving paddle/hand before acceptance. |
| m10 Power Step | Forward step powers a controlled toss | Standing actor does not show footwork or release | Local customer-v4 candidate: forward-step release → sticky contact → reset/detach; NOT HUMAN ACCEPTED. |
| m11 Sky Floater | Controlled high flight arc, blue paddle target below face | Standing actor with path does not distinguish catch moment | No. Arc and paddle-facing incoming ball, not head target. |
| m13 Silent Mode | Players remain silent during active physical play | Static actor and number cue do not distinguish silence | `m13-silent-candidate-v3` shows closed mouths, one blue-front sticky catch and free-hand finger count locally; open-mouth and black-background variants rejected. Strap-hand angle still needs review. |
| m14 Tempo Master | Five slow then five medium-paced soft exchanges | Static single pose cannot express two tempos | No. Controlled slow/medium temporal sequence; generated double-ball variant rejected. |
| m15 Spotlight Eyes | Catcher calls “I SEE IT” before throw | Standing actor does not show order | No. Seen/call moment then release/catch, one ball. |
| m16 1 — 2 — 3 — GO! | Human counts before release | Static actor does not show count preceding throw | No. Count → toss moments without app automation. |
| m17 Mirror Mode | Both players adopt the same comfortable relative paddle pose | Two generic stances do not convey mirroring or leader | No. Approved role/pose sequence needs enlarged product-faithful art. |
| m18 Count to 10 | Players count each clean paddle catch together | Generic catch stance alone cannot show shared count | No. Catch and human counting cue with one ball. |
| m19 Round Robin | Ball travels to the next player in a circle | Paired repeated actors do not show circular receiver order | No. Labeled multiplayer placement and one-ball route. |
| m21 Middle Defender | Middle player intercepts, then walks to switch with thrower | Three static actors do not convey the defender/catcher role switch | No. Role-labeled toss/interception → walking switch sequence. |
| m22 Spin Squad | Four players in a square rotate turn order | Repeated actors and tiny path do not show square/order at mobile scale | No. Enlarged four-player placement and one-ball turn sequence. |
| m23 Mix It Up | Exactly one pair plays, then next pairing after six catches | Generic four-player group does not mark active vs waiting pair | No. Active/waiting role labels and one-ball transition. |
| m24 2v2 Squad Count | One team plays at a time, then single ball changes team | Generic group risks implying simultaneous play | No. Turn-taking panels with one visible ball. |
| m26 Tiny Space | One big step apart, short gentle passes | Same standing pose hides constrained distance | No. Side-by-side scale/foot placement and paddle target. |
| m27 Secret Signal | Catch → free-hand detach → strapped paddle signal → toss | Generic pose cannot distinguish signal from toss | No. Canonical four-moment logic compressed into reviewed 2–3 panels. |
| m28 Mind Reader | Thrower privately chooses left/right/center before the catch | Generic image does not show private selection or target | No. Separated choice and toss/catch moments, receiver perspective preserved. |
| m29 Stuck-Foot Catch | Feet remain planted through exchange | Upright pose does not distinguish fixed feet from standing normally | No. Visible foot anchors through two temporal moments. |
| m31 Cloud Chaser | Soft high arc to paddle, never person's head | Standing actor and thin path are too generic | No. Full-size high arc and blue-front contact. |
| m32 Home Base | Each player stays within a flat home base area | Small base marking under reused actor is easy to miss | No. Enlarged two-player bases, feet/ball route. |
| m33 How Far Can You Throw? | Distance increases only after controlled catches | Generic standing actors obscure distance progression | No. Near → farther positions with same players and one ball. |
| m34 Chase the Ball! | Soft toss ahead followed by safe forward movement | Upright actor does not depict chase order | No. Toss-ahead → moving catcher → paddle contact; no running into another player. |
| m35 Sky High Jump | Catch target just above ordinary paddle reach, not head | Tiny static actor/path may imply head target | No. Reviewed reach/catch sequence with safe height and blue face. |
| m36 Marathon Rally | Sustained one-ball back-and-forth rally | Repeated standing actor does not show reciprocal motion | No. Bidirectional continuous passes with one ball per temporal panel. |

The other eight missions (m03, m04, m07, m08, m12, m20, m25, m30) are **not automatically accepted**. m03 has a confirmed timing ambiguity and a separately previewed v3 candidate. m04/m07/m08/m12/m20/m25/m30 have mission-specific art and remain on the previously recorded product/hand/strap/customer visual review path.

In this local implementation pass, 25 Help sequences were explicitly mapped to canonical steps without changing mission rules. This removes one kind of repeated document text; it does **not** close the 28 hero-motion issues. Every mapped TR/EN canonical step was checked exactly once by test.

### m05 local review candidate
Versioned customer-v4 freeze/detach/return frames replace the repeated hero in the isolated local package. Same two actors, same paddle hands, one ball, blue-front contact, free-hand detach/toss. Hand-switched and high-ball return variants rejected. Not human accepted; no release eligibility inferred.
