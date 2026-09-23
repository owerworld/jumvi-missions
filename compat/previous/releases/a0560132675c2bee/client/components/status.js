export function status(text) {const n=document.createElement('p');n.setAttribute('role','status');n.setAttribute('aria-atomic','true');n.className='status';n.textContent=text;return n;}
