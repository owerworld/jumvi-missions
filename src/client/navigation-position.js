const context = s => `${s.mission?.id}:${s.screen}:${s.round?.id || ''}`;

// Reading positions are document-local UI state, never player history.
export class NavigationPosition {
 constructor(root) { this.root = root; this.positions = new Map(); this.pending = null; this.rendered = null; }
 capture() {
  const node = document.activeElement;
  return {y: window.scrollY, id: this.root.contains(node) ? node?.id : null, label: this.root.contains(node) && node?.tagName === 'BUTTON' ? node.textContent : null};
 }
 transition(before, after, event) {
  if (context(before) === context(after)) return;
  this.positions.set(context(before), this.capture());
  const returning = ['RETURN', 'BACK'].includes(event) && after.screen !== 'interrupted';
  this.pending = returning ? this.positions.get(context(after)) || {y: 0} : {y: 0};
 }
 render(state, prior) {
  const key = context(state), moved = this.rendered !== key || this.pending !== null;
  const position = moved ? this.pending || {y: 0} : prior;
  const target = position?.id ? document.getElementById(position.id) : null;
  const trigger = target || (position?.label && [...this.root.querySelectorAll('button')].find(b => b.textContent === position.label));
  if (trigger) trigger.focus({preventScroll: true});
  else if (moved) this.root.querySelector('h1')?.focus({preventScroll: true});
  if (position) window.scrollTo({top: position.y, behavior: 'instant'});
  this.rendered = key; this.pending = null;
 }
}
