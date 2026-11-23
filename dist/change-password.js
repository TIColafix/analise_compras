const form=document.querySelector('#password-form'),message=document.querySelector('#message');
document.documentElement.dataset.theme=localStorage.getItem('colafix-theme')==='dark'?'dark':'light';
function show(text,success=false){message.hidden=false;message.className='message'+(success?' success':'');message.textContent=text;}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const values=new FormData(form),currentPassword=String(values.get('currentPassword')||''),newPassword=String(values.get('newPassword')||'');
  if(newPassword!==values.get('confirmPassword'))return show('A confirmação da nova senha não corresponde.');
  const button=form.querySelector('button');button.disabled=true;
  try{
    const response=await fetch('/api/me/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível alterar a senha.');
    form.reset();form.hidden=true;show('Senha alterada. Entre novamente com a nova senha.',true);document.querySelector('#login').hidden=false;
  }catch(error){show(error.message);button.disabled=false;}
});
