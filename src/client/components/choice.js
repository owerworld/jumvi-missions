export function choice({group,value,label,checked=false,onSelect}) {
 const wrapper=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');wrapper.className='choice';input.type='radio';input.id=group+'-'+value;input.name=group;input.value=value;input.checked=checked;text.textContent=label;input.addEventListener('change',()=>{if(input.checked)onSelect(value);});wrapper.append(input,text);return wrapper;
}
