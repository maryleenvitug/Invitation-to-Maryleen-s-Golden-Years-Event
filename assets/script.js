/* Maryleen B. Vitug — Golden 50th Birthday Invitation */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWUJPKBG0xLTM5cgQZ7jWuthq4rYRhnUwXSJl6-G7Fya48oNzdTTH6XuFNbUIUifyeJg/exec";
const EVENT = { mapUrl: "https://maps.app.goo.gl/w9zNegShTh3TfAin6", venue: "Ednalizamon Event Place", address: "B8 L7, Purok 5, Barangay Pampang, Angeles City", date: "Saturday, November 7, 2026", time: "4:30 PM" };
const COURT_ICONS = {
 heart:'<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.8-4.9-7.8-11A4.6 4.6 0 0 1 12 6.4 4.6 4.6 0 0 1 19.8 9.5c0 6.1-7.8 11-7.8 11z"/></svg>',
 pen:'<svg viewBox="0 0 24 24"><path d="M4 20l1-4.2L15.8 5a1.6 1.6 0 0 1 2.3 0l.9.9a1.6 1.6 0 0 1 0 2.3L8.2 19 4 20z"/><path d="M13.5 6.5l4 4"/></svg>',
 shots:'<svg viewBox="0 0 24 24"><path d="M7 3h10l-1 7-2 2v7h-4v-7l-2-2zM8 8h8"/></svg>',
 flame:'<svg viewBox="0 0 24 24"><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-4.8 2.6-7.3.3 1.4 1.4 2.3 2.1 1.6-.6-2.4.4-5 2.3-6.3-.6 2.6.6 4 1.9 5.6 1.4 1.7 2.6 3.3 2.6 6.4 0 3.4-2.5 6-5 6z"/></svg>',
 gift:'<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-7-3.5-7-.5C5 10.5 8 9 12 9zM12 9c2-4 7-3.5 7-.5C19 10.5 16 9 12 9z"/></svg>'
};
const HONORARY_COURT = [
 {title:"50 Dances of Love",subtitle:"(Roses)",icon:COURT_ICONS.heart,members:["Rhussel Bondoc","Marlon Bondoc","Danny Tiglao","Edward Besa","Artur Tanjuakio"]},
 {title:"50 Words from the Heart",subtitle:"(Wishes)",icon:COURT_ICONS.pen,members:["Edna Tongol","Riza Masangcay","Jenny Pangilinan","Marcia Carbungco","Analiza Nulud"]},
 {title:"50 Cheers to Fifty!",subtitle:"(Shots)",icon:COURT_ICONS.shots,members:["Rufino Manapul","Roll Umali","Edward Ferrer","Marlon Soguilon","Ernesto Yap"]},
 {title:"50 Flames of Love and Wishes",subtitle:"(Candles)",icon:COURT_ICONS.flame,members:["Angelina Soguilon","Jeremy Besa","Catalina Bagalawis","Ofelia Quiambao","Agustina Almachar"]},
 {title:"50 Symbolic Gifts",icon:COURT_ICONS.gift,members:["Janice Policarpio","Jennielyn Carlos","Elena Garcia","Marie Grace Bondoc","Celeste Salvador"]}
];
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
(function initNavigation(){const header=document.querySelector('.site-header'),toggle=document.getElementById('navToggle');if(!header||!toggle)return;toggle.addEventListener('click',()=>{const open=header.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});document.querySelectorAll('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>{header.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));})();
(function initReveal(){const nodes=document.querySelectorAll('.reveal-on-scroll');if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver'in window)){nodes.forEach(n=>n.classList.add('in-view'));return;}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target);}}),{threshold:.12});nodes.forEach(n=>io.observe(n));})();
(function renderCourt(){const grid=document.getElementById('courtGrid');if(!grid)return;grid.replaceChildren();HONORARY_COURT.forEach((cat,i)=>{const card=document.createElement('article');card.className='court-card';card.style.transitionDelay=(i*80)+'ms';card.innerHTML=`<div class="court-icon" aria-hidden="true">${cat.icon}</div><h3>${escapeHtml(cat.title)}${cat.subtitle?`<br><small>${escapeHtml(cat.subtitle)}</small>`:''}</h3><ol>${cat.members.map((n,j)=>`<li><span class="num">${j+1}.</span>${escapeHtml(n)}</li>`).join('')}</ol>`;grid.appendChild(card);});if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver'in window)){grid.querySelectorAll('.court-card').forEach(c=>c.classList.add('in-view'));return;}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target);}}),{threshold:.1});grid.querySelectorAll('.court-card').forEach(c=>io.observe(c));})();
(function initCountdown(){const ids=['countDays','countHours','countMinutes','countSeconds'].map(id=>document.getElementById(id));if(ids.some(x=>!x))return;const target=Date.UTC(2026,10,7,8,30,0);function tick(){let ms=Math.max(0,target-Date.now());const d=Math.floor(ms/86400000);ms%=86400000;const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);const sec=Math.floor(ms%60000/1000);[d,h,m,sec].forEach((v,i)=>ids[i].textContent=String(v).padStart(2,'0'));}tick();window.setInterval(tick,1000);})();
function submitToAppsScript(payload){
  // Submit through a hidden iframe + ordinary HTML form. This avoids the
  // cross-origin fetch/CORS response problem caused by Apps Script redirects.
  return new Promise((resolve,reject)=>{
    const requestId='req_'+(window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2));
    const frameName='mvbRsvpFrame_'+requestId.replace(/[^a-zA-Z0-9_]/g,'');
    const frame=document.createElement('iframe');
    frame.name=frameName;frame.title='RSVP submission';frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:absolute;width:1px;height:1px;left:-9999px;border:0;';
    const form=document.createElement('form');
    form.method='POST';form.action=APPS_SCRIPT_URL;form.target=frameName;
    form.style.display='none';
    const fields={payload:JSON.stringify({action:'submitRsvp',payload,requestId}),requestId};
    Object.entries(fields).forEach(([name,value])=>{const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);});
    let settled=false;
    const cleanup=()=>{window.removeEventListener('message',onMessage);clearTimeout(timer);form.remove();frame.remove();};
    const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);};
    const onMessage=(event)=>{
      const data=event.data;
      if(!data||data.type!=='MVB_RSVP_RESULT'||data.requestId!==requestId)return;
      if(data.result)finish(resolve,data.result);else finish(reject,new Error('The RSVP server returned an empty response.'));
    };
    window.addEventListener('message',onMessage);
    const timer=setTimeout(()=>finish(reject,new Error('No confirmation was received from Google Apps Script after 70 seconds. The deployment may be outdated, inaccessible, or not returning the RSVP response. Check the Apps Script deployment and Executions log before submitting again.')),70000);
    document.body.append(frame,form);
    try{form.submit();}catch(error){finish(reject,error);}
  });
}

function checkAppsScriptStatus(submissionId,timeoutMs=12000){
  return new Promise((resolve,reject)=>{
    const callbackName='mvbStatus_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');let settled=false;
    const cleanup=()=>{if(script.parentNode)script.remove();try{delete window[callbackName];}catch(_){window[callbackName]=undefined;}clearTimeout(timer);};
    const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);};
    window[callbackName]=(result)=>finish(resolve,result);
    script.onerror=()=>finish(reject,new Error('Could not reach the RSVP status endpoint.'));
    const timer=setTimeout(()=>finish(reject,new Error('RSVP status check timed out.')),timeoutMs);
    script.src=APPS_SCRIPT_URL+'?action=status&submissionId='+encodeURIComponent(submissionId)+'&callback='+encodeURIComponent(callbackName)+'&_='+Date.now();
    document.head.appendChild(script);
  });
}

(function initRsvp(){
 const form=document.getElementById('rsvpForm');if(!form)return;
 const nameInput=document.getElementById('representativeName'),emailInput=document.getElementById('representativeEmail');
 const nameError=document.getElementById('nameError'),emailError=document.getElementById('emailError'),attendanceError=document.getElementById('attendanceError');
 const message=document.getElementById('formMessage'),submit=document.getElementById('submitBtn'),confirmation=document.getElementById('confirmationScreen');
 const body=document.getElementById('confirmationBody'),details=document.getElementById('confirmationDetails'),title=document.getElementById('confirmationTitle'),edit=document.getElementById('editAnotherBtn');let busy=false;
 function clearErrors(){nameError.textContent='';emailError.textContent='';attendanceError.textContent='';[nameInput,emailInput].forEach(x=>x.classList.remove('invalid'));}
 edit.addEventListener('click',()=>{confirmation.hidden=true;form.hidden=false;form.reset();clearErrors();message.textContent='';message.className='form-message';window.scrollTo({top:form.getBoundingClientRect().top+window.scrollY-90,behavior:'smooth'});});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;clearErrors();
  const fullName=nameInput.value.trim().replace(/\s+/g,' '),email=emailInput.value.trim();
  const choice=form.querySelector('input[name="attendanceChoice"]:checked');let valid=true;
  if(!fullName){nameError.textContent='Please enter your full name.';nameInput.classList.add('invalid');valid=false;}
  if(!email){emailError.textContent='Please enter your email address.';emailInput.classList.add('invalid');valid=false;}
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){emailError.textContent='Please enter a valid email address.';emailInput.classList.add('invalid');valid=false;}
  if(!choice){attendanceError.textContent='Please select one attendance option.';valid=false;}
  if(!valid){message.textContent='Please complete all required fields.';message.className='form-message error';return;}
  const attendeeCount=choice.value==='Attending with a Plus-One'?2:1;
  const payloadSignature=JSON.stringify({fullName,email,attendance:choice.value});
  const pendingKey='mvb_rsvp_pending_v1';
  let pending=null;
  try{pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch(_){}
  const submissionId=pending&&pending.signature===payloadSignature&&pending.submissionId
    ?pending.submissionId
    :'sub_'+(window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
  try{sessionStorage.setItem(pendingKey,JSON.stringify({signature:payloadSignature,submissionId}));}catch(_){}
  busy=true;submit.disabled=true;submit.classList.add('loading');message.textContent='Submitting your RSVP…';message.className='form-message';
  try{
   let result;
   try{
    result=await submitToAppsScript({submissionId,representativeName:fullName,email,attendanceChoice:choice.value});
   }catch(transportError){
    // The save may have committed even if the iframe acknowledgement was lost.
    const status=await checkAppsScriptStatus(submissionId);
    if(status&&status.saved)result={status:'success',submissionId,attendeeCount,duplicate:true,emailStatus:status.emailStatus||'Pending',emailAttempts:status.emailAttempts||0,emailError:status.emailError||''};
    else throw transportError;
   }
   if(!result||result.status!=='success')throw new Error(result?.message||'SUBMISSION_FAILED');
   try{const saved=JSON.parse(sessionStorage.getItem(pendingKey)||'null');if(saved&&saved.submissionId===submissionId)sessionStorage.removeItem(pendingKey);}catch(_){}
   form.hidden=true;confirmation.hidden=false;title.textContent='Thank You for Your RSVP';
   body.textContent=choice.value==='Attending Alone'?`Thank you, ${fullName}! Your attendance has been successfully confirmed for our 50th Birthday Celebration.`:`Thank you, ${fullName}! Your attendance has been successfully confirmed for two guests. We look forward to celebrating with you!`;
   const emailLine=result.emailStatus==='Sent'
    ?'Google accepted your confirmation email for sending.'
    :(result.emailStatus==='Pending'||result.emailStatus==='Sending'
      ?'Your RSVP is saved. Your confirmation email is being processed.'
      :(result.emailStatus==='Failed'
        ?'Your RSVP is saved, but the confirmation email could not be sent yet. The system will retry automatically; please check your inbox later.'
        :'Your RSVP is saved. The email processing status is not yet confirmed.'));
   details.innerHTML=`<p><strong>Representative:</strong> ${escapeHtml(fullName)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Attendance:</strong> ${escapeHtml(choice.value)}</p><p><strong>Total attendees:</strong> ${attendeeCount}</p><p><strong>Date:</strong> ${EVENT.date}</p><p><strong>Time:</strong> ${EVENT.time}</p><p><strong>Venue:</strong> ${EVENT.venue}<br>${EVENT.address}</p><p class="email-delivery-note">${escapeHtml(emailLine)}</p>`;
   confirmation.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){console.error('RSVP submission failed',err);message.textContent=err&&err.message&&err.message!=='SUBMISSION_FAILED'?`We could not complete your RSVP: ${err.message}`:'We could not confirm your RSVP. Please try again in a moment.';message.className='form-message error';}
  finally{busy=false;submit.disabled=false;submit.classList.remove('loading');}
 });
})();
/* The supplied MP4 has its own AAC audio track. It is the only supplied audio asset, so it is used as the invitation soundtrack without creating a second overlapping audio player. */
(function initInvitationPlayback(){const video=document.getElementById('invitationVideo'),prompt=document.getElementById('playInvitationPrompt'),toggle=document.getElementById('videoAudioToggle');if(!video||!prompt||!toggle)return;const label=toggle.querySelector('.video-audio-label'),icon=toggle.querySelector('.video-audio-icon');let initialized=false;function sync(){const sound=!video.muted&&video.volume>0;toggle.setAttribute('aria-pressed',String(!sound));toggle.setAttribute('aria-label',sound?'Mute invitation video':'Turn invitation video sound on');if(label)label.textContent=sound?'Mute sound':'Enable sound';if(icon)icon.textContent=sound?'♫':'♪';}async function playWithSound(){try{video.muted=false;video.volume=1;await video.play();prompt.hidden=true;sync();return true;}catch(err){prompt.hidden=false;sync();return false;}}function startOnce(){if(initialized)return;initialized=true;playWithSound();}video.addEventListener('playing',()=>{if(!video.muted)prompt.hidden=true;sync();});video.addEventListener('error',()=>{prompt.textContent='The invitation video could not be loaded.';prompt.hidden=false;});prompt.addEventListener('click',async()=>{initialized=true;await playWithSound();});toggle.addEventListener('click',async()=>{if(video.paused){await playWithSound();return;}video.muted=!video.muted;if(!video.muted)video.volume=1;sync();});video.addEventListener('volumechange',sync);sync();startOnce();})();
