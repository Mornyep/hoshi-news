// Unwired transport-injected adapter. No fetch, key input/storage or subscription token access.
import {standardAPIContract} from './adapters.mjs';
const allowed=new Set(['provider','model','prompt','region']);
export function standardAPIAdapter({transport,approvedProviders=[],timeoutMs=15000}={}){
 const approved=new Set(approvedProviders.filter(p=>['deepseek','qianwen'].includes(p)));let busy=false;
 const result=(state,extra={})=>({state,connected:false,...extra});
 return Object.freeze({
  status(provider){return result(!approved.has(provider)?'separate_key_and_billing_approval_required':typeof transport!=='function'?'transport_unconfigured':'ready_for_explicit_request');},
  async read(config,{signal}={}){
   if(!config||typeof config!=='object'||Object.keys(config).some(k=>!allowed.has(k)))return result('invalid_configuration');
   if(!approved.has(config.provider))return result('separate_key_and_billing_approval_required');
   if(typeof transport!=='function')return result('transport_unconfigured');
   if(busy)return result('request_in_progress');
   let contract;try{contract=standardAPIContract(config.provider,config);}catch{return result('invalid_configuration');}
   const controller=new AbortController();let timer,remove=()=>{};
   if(signal?.aborted)return result('cancelled');
   if(signal){const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});remove=()=>signal.removeEventListener('abort',cancel);}
   busy=true;
   try{
    const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
    timer=setTimeout(()=>controller.abort(),Math.min(Math.max(timeoutMs,1),45000));
    // Host-provided transport owns its separately authorized standard API credential.
    const response=await Promise.race([Promise.resolve().then(()=>transport(contract,{signal:controller.signal})),aborted]);
    if(controller.signal.aborted)return result(signal?.aborted?'cancelled':'timeout');
    if(response?.status===401)return result('key_authorization_required');
    if(response?.status===403)return result('permission_denied');
    if(response?.status===429)return result('rate_limited');
    if(response?.status!==200||response.redirected===true)return result('provider_request_failed');
    // Bounded text is supplied by the host; never expose raw error bodies or headers.
    if(typeof response.text!=='string'||Buffer.byteLength(response.text)>100000)return result('invalid_response');
    let data;try{data=JSON.parse(response.text);}catch{return result('invalid_response');}
    if(!Array.isArray(data.choices)||data.choices.length!==1)return result('invalid_response');
    const choice=data.choices[0],message=choice.message;
    if(choice.finish_reason!=='stop')return result('incomplete_response');
    if(!message||message.role!=='assistant'||message.tool_calls?.length||message.function_call||typeof message.content!=='string'||!message.content.trim()||message.content.length>16000)return result('invalid_response');
    return result('completed',{provider:config.provider,answer:message.content,verifiedFacts:false});
   }catch{return result(controller.signal.aborted?(signal?.aborted?'cancelled':'timeout'):'provider_request_failed');}
   finally{clearTimeout(timer);remove();busy=false;}
  }
 });
}
