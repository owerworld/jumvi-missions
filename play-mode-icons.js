/* ============================================================
 * play-mode-icons.js — one motion diagram per Play Mode.
 *
 * The Modes tab used to show the same two product photos on every card and
 * again on every detail sheet: nine different games illustrated identically,
 * telling a parent nothing about how any of them is played. Missions solved
 * this years ago with jumvi-mission-icons.js, so these follow that drawing
 * language exactly — stick figures, a #85B7EB paddle ellipse, an #EF9F27
 * ball, and a dashed arc for the throw.
 *
 * Two deliberate differences from the mission icons:
 *
 *   NO TEXT. Mission diagrams carry 12px labels. These are drawn once and
 *   shown at two sizes — ~104px on the card and full width in the sheet —
 *   and 12px text is unreadable at the small one. Leaving text out also
 *   keeps the diagrams off the /tr translation surface entirely: the card
 *   already prints the title, gear and goal in the reader's language.
 *
 *   SAME 380x150 CANVAS as the missions. brandEquipment() scales the swapped
 *   paddle art by ry*2.7 and the ball by r*2.4, so those radii only look right
 *   at the missions' canvas size — on a smaller viewBox the paddle balloons
 *   over the figure. Matching the canvas keeps the equipment in proportion.
 *
 * The paddle ellipse and ball circle use the same placeholder colours the
 * mission icons use, so brandEquipment() in jumvi-mission-icons.js swaps them
 * for the real product art here too — the equipment stays photographic, only
 * the ACTION is drawn.
 * ============================================================ */
(function exposeJumviPlayModeIcons(){
  "use strict";

  var S = 'var(--color-text-secondary)';   // figure stroke
  var G = 'var(--color-border-secondary)'; // ground line

  /** Stick figure. `arms` picks the pose so a throw reads as a throw. */
  function fig(x, base, arms){
    var head = base - 68, hip = base - 26;
    var a = {
      up:    'M' + x + ' ' + (head + 18) + ' l-20 -18 M' + x + ' ' + (head + 20) + ' l21 -16',
      out:   'M' + x + ' ' + (head + 18) + ' l-23 9 M' + x + ' ' + (head + 19) + ' l23 8',
      toss:  'M' + x + ' ' + (head + 19) + ' l-22 -13 M' + x + ' ' + (head + 20) + ' l20 12',
      down:  'M' + x + ' ' + (head + 18) + ' l-18 18 M' + x + ' ' + (head + 19) + ' l18 17',
      hold:  'M' + x + ' ' + (head + 19) + ' l-20 3 M' + x + ' ' + (head + 20) + ' l20 -9'
    }[arms || 'out'];
    return '<circle cx="' + x + '" cy="' + head + '" r="9"/>' +
           '<line x1="' + x + '" y1="' + (head + 9) + '" x2="' + x + '" y2="' + hip + '"/>' +
           '<line x1="' + x + '" y1="' + hip + '" x2="' + (x - 12) + '" y2="' + base + '"/>' +
           '<line x1="' + x + '" y1="' + hip + '" x2="' + (x + 12) + '" y2="' + base + '"/>' +
           '<path d="' + a + '"/>';
  }

  var paddle = function(cx, cy, rot){
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="7" ry="9" fill="#85B7EB" ' +
      'stroke="#639922" stroke-width="2.4"' +
      (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';
  };
  var ball = function(cx, cy, r){
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r || 6) + '" fill="#EF9F27"/>';
  };
  /** Dashed flight path. `lift` is how high the arc bows above the endpoints. */
  var arc = function(id, x1, y1, x2, y2, lift){
    var mx = (x1 + x2) / 2, my = Math.min(y1, y2) - (lift == null ? 44 : lift);
    return '<path d="M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2 + '" ' +
      'fill="none" stroke="#EF9F27" stroke-width="2.6" stroke-dasharray="5 6" ' +
      'stroke-linecap="round" marker-end="url(#' + id + ')"/>';
  };
  var ground = function(x1, x2, y){
    return '<line x1="' + x1 + '" y1="' + (y || 120) + '" x2="' + x2 + '" y2="' + (y || 120) +
      '" stroke="' + G + '" stroke-width="1.6"/>';
  };

  function svg(id, label, body){
    return '<svg viewBox="0 0 380 150" role="img" aria-label="' + label + '">' +
      '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" ' +
      'markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" ' +
      'stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round"/></marker></defs>' +
      '<g fill="none" stroke="' + S + '" stroke-width="2.6" stroke-linecap="round" ' +
      'stroke-linejoin="round">' + body.fig + '</g>' + body.props +
      '</svg>';
  }

  window.JUMVI_PLAY_MODE_ICONS = {

    // Self-toss to your own paddle: ball leaves the free hand, arcs no higher
    // than the forehead, comes down onto the paddle.
    "pop-and-stick": svg('pmA', 'Self-toss and catch on your own paddle', {
      fig: ground(90, 290) + fig(190, 116, 'toss'),
      // Paddle sits at the END of the raised arm and the ball at the end of the
      // free one, so the arc clears the head instead of crossing the torso.
      props: paddle(156, 50, -18) + ball(216, 84) + arc('pmA', 212, 78, 164, 60, 42)
    }),

    // Straight drop, no throw. The vertical fall IS the mode, so it is the only
    // motion line and the paddle waits underneath.
    "quick-drop": svg('pmB', 'Drop the ball straight down and slide the paddle under it', {
      fig: ground(90, 290) + fig(190, 116, 'hold'),
      props: ball(218, 58) +
        '<path d="M218 68 L218 92" fill="none" stroke="#EF9F27" stroke-width="2.6" ' +
        'stroke-dasharray="5 6" stroke-linecap="round" marker-end="url(#pmB)"/>' +
        paddle(218, 102)
    }),

    // Paddle lying flat on the floor as a target, balls tossed onto it, the
    // spares waiting beside the thrower's feet.
    "floor-target-four": svg('pmC', 'Toss four balls onto a paddle lying on the floor', {
      fig: ground(30, 350) + fig(100, 116, 'toss'),
      props: '<ellipse cx="286" cy="114" rx="30" ry="10" fill="#85B7EB" stroke="#639922" ' +
        'stroke-width="2.4"/>' +
        ball(136, 70) + ball(52, 110, 5) + ball(68, 110, 5) +
        arc('pmC', 138, 64, 278, 104, 46)
    }),

    // Two players facing each other, one ball crossing between them.
    "free-rally": svg('pmD', 'Two players rally one ball back and forth', {
      fig: ground(30, 350) + fig(95, 116, 'out') + fig(285, 116, 'out'),
      props: paddle(126, 86, 16) + paddle(254, 86, -16) +
        arc('pmD', 142, 78, 238, 78, 40)
    }),

    // Side by side, one ball each, both making the same low toss — nothing
    // travels between them, which is what separates this from a rally.
    "copycat-pops": svg('pmE', 'Side by side, both players copy the same low toss', {
      fig: ground(30, 350) + fig(130, 116, 'toss') + fig(250, 116, 'toss'),
      props: paddle(96, 50, -18) + paddle(216, 50, -18) +
        ball(156, 84) + ball(276, 84) +
        arc('pmE', 152, 78, 104, 60, 38) + arc('pmE', 272, 78, 224, 60, 38)
    }),

    // One thrower with the spare balls, one catcher, a single ball in the air.
    "four-ball-round": svg('pmF', 'One player throws four balls, the other catches', {
      fig: ground(20, 360) + fig(95, 116, 'toss') + fig(295, 116, 'out'),
      props: paddle(264, 86, -16) +
        ball(131, 70) + ball(46, 110, 5) + ball(62, 110, 5) + ball(78, 110, 5) +
        arc('pmF', 133, 64, 252, 78, 44)
    }),

    // Everyone pops their own ball on the same call. Four separate up-ticks,
    // no ball crossing between players.
    "sync-pop": svg('pmG', 'Every player pops and catches their own ball at the same moment', {
      fig: ground(14, 366) + fig(68, 116, 'toss') + fig(158, 116, 'toss') +
           fig(248, 116, 'toss') + fig(338, 116, 'toss'),
      // Paddle sits in each raised hand and the ball straight above it, so the
      // four pops read as four people, not as loose equipment on the floor.
      props: paddle(44, 52, -18) + paddle(134, 52, -18) + paddle(224, 52, -18) +
        paddle(314, 52, -18) +
        ball(44, 20, 5) + ball(134, 20, 5) + ball(224, 20, 5) + ball(314, 20, 5) +
        '<path d="M44 40 l0 -10 M134 40 l0 -10 M224 40 l0 -10 M314 40 l0 -10" fill="none" ' +
        'stroke="#EF9F27" stroke-width="2.6" stroke-linecap="round"/>'
    }),

    // A shape with an empty middle and the ball moving round it one player at a
    // time. Drawn as a formation, so there is no side-on ground line.
    "loop-rally": svg('pmH', 'One ball travels around the group, one player at a time', {
      fig: fig(72, 142, 'out') + fig(190, 96, 'out') + fig(308, 142, 'out'),
      props: paddle(98, 96, 16) + paddle(214, 50, 0) + paddle(282, 96, -16) +
        arc('pmH', 110, 88, 202, 56, 26) +
        '<path d="M226 54 Q286 60 278 86" fill="none" stroke="#EF9F27" stroke-width="2.6" ' +
        'stroke-dasharray="5 6" stroke-linecap="round" marker-end="url(#pmH)"/>' +
        ball(98, 92, 5)
    }),

    // Two pairs, two lanes, a wide gap between them. The gap is the safety
    // point of the mode, so the ground line is split rather than continuous.
    "twin-lane-rally": svg('pmI', 'Two pairs rally in two separate lanes', {
      fig: ground(14, 172) + ground(208, 366) +
           fig(40, 116, 'out') + fig(150, 116, 'out') +
           fig(230, 116, 'out') + fig(340, 116, 'out'),
      props: paddle(66, 70, 16) + paddle(124, 70, -16) +
        paddle(256, 70, 16) + paddle(314, 70, -16) +
        arc('pmI', 78, 62, 112, 62, 30) + arc('pmI', 268, 62, 302, 62, 30)
    })
  };
})();
