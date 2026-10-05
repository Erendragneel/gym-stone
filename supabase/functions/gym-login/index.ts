// Username resolution stays on the server; an email address is never returned.
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins = new Set((Deno.env.get('GYM_ALLOWED_ORIGINS') || 'https://erendragneel.github.io,https://gym-stone-quest.elijio-villa.chatgpt.site').split(',').map(s=>s.trim()));
const digest = async (text:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async request => {
  const origin=request.headers.get('origin') || '';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if (origin && !origins.has(origin)) return reply(403,{error:'Origin not allowed'});
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (request.method!=='POST') return reply(405,{error:'Method not allowed'});
  if (Number(request.headers.get('content-length'))>8192) return reply(413,{error:'Request too large'});
  try {
    const raw=await request.text();if(raw.length>8192)return reply(413,{error:'Request too large'});
    const body=JSON.parse(raw),username=String(body.username||'').trim().toLowerCase(),password=body.password;
    if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length>1024)return reply(400,{error:'Enter your username and password.'});
    const adminHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
    const bucket=await digest(service+':username:'+username);
    const limit=await fetch(url+'/rest/v1/rpc/gym_consume_login_attempt',{method:'POST',headers:adminHeaders,body:JSON.stringify({p_bucket:bucket,p_limit:10})});
    if(!limit.ok)return reply(503,{error:'Sign-in is temporarily unavailable.'});
    if(await limit.json()!==true)return reply(429,{error:'Too many attempts. Wait a minute and try again.'});
    const rowResponse=await fetch(url+'/rest/v1/rpc/gym_resolve_username',{method:'POST',headers:adminHeaders,body:JSON.stringify({p_username:username})});
    if(!rowResponse.ok)return reply(503,{error:'Sign-in is temporarily unavailable.'});
    const userId=await rowResponse.json();let email='missing-'+crypto.randomUUID()+'@invalid.example';
    if(userId) {
      const account=await fetch(url+'/auth/v1/admin/users/'+userId,{headers:adminHeaders});
      if(!account.ok)return reply(503,{error:'Sign-in is temporarily unavailable.'});
      email=(await account.json()).email;
    }
    const response=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const payload=await response.json();
    if(!response.ok)return reply(401,{error:'Username or password is incorrect, or email confirmation is needed.'});
    return reply(200,payload);
  } catch {return reply(503,{error:'Sign-in is temporarily unavailable. Please try again.'});}
});
