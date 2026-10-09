// Offline security contract only. No listener, credentials, OAuth or model calls.
// A future native adapter must obtain local user consent before issuing a code.
export function pairingGate({origin='https://mornyep.github.io',now=Date.now,random}){
 if(typeof random!=='function')throw new Error('Secure random source required');
 const pending=new Map(),sessions=new Map();
 const valid=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(v);
 const context=c=>c&&typeof c.profile==='string'&&/^[a-f0-9-]{36}$/.test(c.profile)&&valid(c.tab);
 const source=o=>{if(o!==origin)throw new Error('Origin rejected');};
 const secret=()=>{const v=random();if(!valid(v))throw new Error('Invalid random source');return v;};
 function issue(c){if(!context(c))throw new Error('Invalid local context');const code=secret();pending.set(code,{...c,expires:now()+60000});return code;}
 function pair(o,code,c){source(o);const p=pending.get(code);if(!p||p.expires<now()||!context(c)||p.profile!==c.profile||p.tab!==c.tab)throw new Error('Pairing rejected');pending.delete(code);const token=secret();sessions.set(token,{...c,expires:now()+3600000,generation:0});return token;}
 function capture(o,token,c){source(o);const s=sessions.get(token);if(!s||s.expires<now()||!context(c)||s.profile!==c.profile||s.tab!==c.tab||!['zh-CN','zh-TW','ja','en'].includes(c.language)||c.provider!=='chatgpt')throw new Error('Session rejected');return {token,generation:s.generation,...c};}
 function current(c){const s=sessions.get(c.token);return !!s&&s.expires>=now()&&s.generation===c.generation&&s.profile===c.profile&&s.tab===c.tab;}
 function revoke(profile){for(const [k,s]of sessions)if(s.profile===profile)sessions.delete(k);for(const[k,p]of pending)if(p.profile===profile)pending.delete(k);}
 function change(token){const s=sessions.get(token);if(s)s.generation++;}
 function question(value){if(!value||Object.keys(value).some(k=>!['question','language','evidence'].includes(k))||typeof value.question!=='string'||!value.question.trim()||value.question.length>2000||!['zh-CN','zh-TW','ja','en'].includes(value.language)||typeof value.evidence!=='string'||value.evidence.length>12000)throw new Error('Invalid reading request');return {...value};}
 return Object.freeze({issue,pair,capture,current,revoke,change,question});
}
