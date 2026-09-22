export function el(tag,text,cls) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
export function heading(text) {const n=el('h1',text);n.tabIndex=-1;return n;}
