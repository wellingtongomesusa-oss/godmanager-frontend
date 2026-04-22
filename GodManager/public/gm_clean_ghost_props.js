// Limpeza one-time: remove entradas fantasma Total/Manager Prop do storage
(function(){
 try{
  var K='gm_properties';
  var raw=localStorage.getItem(K);
  if(!raw)return;
  var arr=JSON.parse(raw);
  if(!Array.isArray(arr))return;
  var before=arr.length;
  var cleaned=arr.filter(function(p){
   if(!p||typeof p!=='object')return false;
   var nm=String(p.name||'').trim().toLowerCase();
   var addr=String(p.address||'').trim().toLowerCase();
   if(nm==='total'||nm==='manager prop')return false;
   if(addr==='total'||addr.indexOf('admin -')===0)return false;
   return true;
  });
  if(cleaned.length!==before){
   localStorage.setItem(K,JSON.stringify(cleaned));
   console.log('[gm_clean_ghost_props] Removidas '+(before-cleaned.length)+' entradas fantasma');
  }
 }catch(e){console.warn('[gm_clean_ghost_props]',e);}
})();
