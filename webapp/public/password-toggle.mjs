const PASSWORD_SELECTOR='input[type="password"]';
const tr=(es,pt)=>window.RimmaLocale?.isPt?pt:es;

function makeIcon(className, hiddenLine=false){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add(className);

  const eye=document.createElementNS('http://www.w3.org/2000/svg','path');
  eye.setAttribute('d','M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z');
  svg.append(eye);

  const pupil=document.createElementNS('http://www.w3.org/2000/svg','circle');
  pupil.setAttribute('cx','12');
  pupil.setAttribute('cy','12');
  pupil.setAttribute('r','2.7');
  svg.append(pupil);

  if(hiddenLine){
    const slash=document.createElementNS('http://www.w3.org/2000/svg','path');
    slash.setAttribute('d','M4 4l16 16');
    svg.append(slash);
  }
  return svg;
}

function enhancePassword(input){
  if(!(input instanceof HTMLInputElement)||input.dataset.passwordToggle==='ready')return;
  input.dataset.passwordToggle='ready';

  const wrapper=document.createElement('span');
  wrapper.className='password-field';
  input.parentNode.insertBefore(wrapper,input);
  wrapper.append(input);

  const button=document.createElement('button');
  button.type='button';
  button.className='password-toggle';
  button.setAttribute('aria-label',tr('Mostrar contraseña','Mostrar senha'));
  button.setAttribute('title',tr('Mostrar contraseña','Mostrar senha'));
  button.setAttribute('aria-pressed','false');
  button.append(makeIcon('password-eye'),makeIcon('password-eye-off',true));

  button.addEventListener('click',()=>{
    const show=input.type==='password';
    input.type=show?'text':'password';
    button.setAttribute('aria-pressed',show?'true':'false');
    const label=show?tr('Ocultar contraseña','Ocultar senha'):tr('Mostrar contraseña','Mostrar senha');
    button.setAttribute('aria-label',label);
    button.setAttribute('title',label);
  });

  wrapper.append(button);
}

function enhanceWithin(root){
  if(root instanceof HTMLInputElement&&root.matches(PASSWORD_SELECTOR))enhancePassword(root);
  if(root.querySelectorAll)root.querySelectorAll(PASSWORD_SELECTOR).forEach(enhancePassword);
}

enhanceWithin(document);

const observer=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node instanceof Element)enhanceWithin(node);
    }
  }
});
observer.observe(document.documentElement,{childList:true,subtree:true});
