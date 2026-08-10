/* R-Proposta Fácil v4.3 — ADM com espelhamento suspenso nos campos editáveis; visual azul e demais recursos preservados. */
(() => {
  if (window.__rpropV53Index) return;
  window.__rpropV53Index = true;

  const DRAFT_KEY = 'rproposta_facil_draft_v1';
  const DRAFT_TTL = 2 * 60 * 60 * 1000;
  const ADM_PIN_HASH = '12059f32c65ae1a47314eb006ef7feb21bac880e9278f59a4b80a9a0351bf8d4';
  const TITLES = {
    proposta:'PROPOSTA COLETIVO POR ADESÃO', carencia:'TERMO DE CARÊNCIA', carta:'CARTA ANS',
    consent:'TERMO DE CONSENTIMENTO', comprov:'COMPROVANTE DE ADESÃO'
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const main = () => window.__rpropMainV51;
  const engine = () => window.__rpropPdfEngineV342;
  const editor = () => window.__rpropEditorV51Api;
  let admActive = false;
  let admOrigin = 'normal';
  let saveTimer = 0;
  let statusTimer = 0;
  let draftRestoring = false;
  let draftDecisionPending = false;
  let startupDraft = null;
  let lastTrustedFormChange = 0;
  let ridSeq = 1;

  window.__rpropV53Adm = window.__rpropV52Adm = { isActive: () => admActive };

  const style = document.createElement('style');
  style.id = 'rpropV51Style';
  style.textContent = `
    #editorAdmBtn{flex:0 0 42px;width:42px;height:40px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#dbeafe;border-radius:11px;padding:0;font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-left:auto}
    #editorAdmBtn:hover{background:rgba(255,255,255,.10);border-color:rgba(125,211,252,.38)}
    .v51-doc-status{margin-top:6px;font-size:11px;font-weight:900;line-height:1.35}
    .v51-doc-status.ok{color:#86efac}.v51-doc-status.bad{color:#fcd34d}.v51-doc-status.multi{font-weight:700}
    .v51-pending-link{border:0;background:transparent;color:#fde68a;text-align:left;padding:2px 0;cursor:pointer;font:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
    .v51-pending-link:hover{color:#fff7cc}
    .v51-overlay{position:fixed;inset:0;z-index:120000;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:18px}
    .v51-overlay.open{display:flex}
    .v51-card{width:min(620px,96vw);max-height:88vh;overflow:auto;background:#111827;border:1px solid rgba(255,255,255,.16);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.58);padding:18px;color:#e5e7eb}
    .v51-card h2{margin:0 0 8px;font-size:19px}.v51-card p{margin:6px 0 14px;color:#9ca3af;font-size:13px;line-height:1.4}
    .v51-pin{width:100%;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#fff;font-size:18px;letter-spacing:3px;text-align:center}
    .v51-error{min-height:20px;color:#fca5a5;font-size:12px;margin-top:7px}
    .v51-actions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}.v51-actions button{padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#e5e7eb;font-weight:900;cursor:pointer}.v51-actions .primary{background:rgba(14,165,233,.25);color:#dff6ff}.v51-actions .danger{color:#fecaca}
    #v51AdmDock{position:fixed;right:12px;top:12px;z-index:110000;display:none;gap:8px;align-items:center;padding:9px;border-radius:14px;border:1px solid rgba(56,189,248,.5);background:rgba(3,16,29,.94);box-shadow:0 12px 30px rgba(0,0,0,.4)}
    body.rprop-adm-active #v51AdmDock{display:flex}#v51AdmDock .tag{color:#7dd3fc;font-size:12px;font-weight:900;white-space:nowrap}#v51AdmDock button{padding:8px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font-weight:900;cursor:pointer}
    .v51-select-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}.v51-select-row{display:flex;gap:10px;align-items:center;padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03)}.v51-select-row input{width:18px;height:18px}.v51-select-row label{flex:1;font-size:13px;font-weight:800;cursor:pointer}
    @media(max-width:960px){#v51AdmDock{top:auto;bottom:calc(78px + env(safe-area-inset-bottom));right:8px;left:8px;justify-content:space-between}#v51AdmDock .tag{font-size:10px}.v51-card{padding:15px}}
  `;
  document.head.appendChild(style);

  function makeOverlay(id, inner){
    const o=document.createElement('div'); o.id=id; o.className='v51-overlay'; o.innerHTML='<div class="v51-card">'+inner+'</div>'; document.body.appendChild(o); return o;
  }

  const pinOverlay=makeOverlay('v51PinOverlay', `
    <h2>🛡️ MODO ADM</h2><p>Informe o PIN ADM para ativar as funções administrativas nesta sessão.</p>
    <input id="v51PinInput" class="v51-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN ADM">
    <div id="v51PinError" class="v51-error"></div>
    <div class="v51-actions"><button id="v51PinCancel">CANCELAR</button><button id="v51PinOk" class="primary">ATIVAR</button></div>`);

  const draftOverlay=makeOverlay('v51DraftOverlay', `
    <h2>Proposta não finalizada</h2><p>Encontramos uma proposta não finalizada salva neste navegador nas últimas 2 horas.</p>
    <div id="v51DraftMessage" class="v51-error" style="color:#bae6fd"></div>
    <div class="v51-actions"><button id="v51DraftDiscard" class="danger">DESCARTAR</button><button id="v51DraftRecover" class="primary">RECUPERAR</button></div>`);

  const selectOverlay=makeOverlay('v51SelectOverlay', `
    <h2>Gerar documentos selecionados</h2><p>Somente os documentos/instâncias marcados serão incluídos no PDF parcial. No Modo ADM, campos vazios ou inválidos não bloqueiam a geração.</p>
    <div id="v51SelectList" class="v51-select-list"></div>
    <div id="v51SelectError" class="v51-error"></div>
    <div class="v51-actions"><button id="v51SelectCancel">CANCELAR</button><button id="v51SelectGenerate" class="primary">GERAR SELECIONADOS</button></div>`);

  const dock=document.createElement('div'); dock.id='v51AdmDock'; dock.innerHTML='<span class="tag">🛡️ MODO ADM ATIVO</span><button id="v51AdmGenerate">GERAR SELECIONADOS</button><button id="v51AdmExit">SAIR DO MODO ADM</button>'; document.body.appendChild(dock);

  function editorIsOpen(){ return !!(editor() && editor().isOpen && editor().isOpen()); }

  async function sha256(text){
    try{
      if(crypto && crypto.subtle){
        const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
        return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');
      }
    }catch(e){}
    try{ if(window.__rpropSha256PureV342) return window.__rpropSha256PureV342(text); }catch(e){}
    return '';
  }

  function postFrame(iframe, msg, timeout=5000){
    return new Promise((resolve,reject)=>{
      if(!iframe || !iframe.contentWindow) return reject(new Error('Formulário indisponível.'));
      const rid='v51_'+Date.now()+'_'+(ridSeq++); let done=false;
      const finish=(ok,val)=>{ if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',onMsg);ok?resolve(val):reject(val); };
      const onMsg=e=>{ const d=e.data; if(e.source===iframe.contentWindow && d && d.rid===rid) finish(true,d); };
      const timer=setTimeout(()=>finish(false,new Error('Tempo excedido ao comunicar com o formulário.')),timeout);
      window.addEventListener('message',onMsg,false);
      try{iframe.contentWindow.postMessage(Object.assign({rid},msg),'*');}catch(e){finish(false,e);}
    });
  }

  function normalSeq(){
    try{return engine().collectWrapsInOrder();}catch(e){return [];}
  }

  async function setAdmOnNormalFrames(active){
    const seq=normalSeq();
    for(const it of seq){
      try{
        const keys=active && editor() && editor().editableKeysForDoc ? editor().editableKeysForDoc(it.docId) : [];
        await postFrame(it.iframe,{__rpropV51:true,type:'ADM_SET_MODE_V51',active:!!active,editableKeys:keys},2500);
      }catch(e){}
    }
  }

  async function activateAdm(){
    const pin=document.getElementById('v51PinInput');
    const err=document.getElementById('v51PinError');
    const hash=await sha256(pin.value || '');
    if(hash!==ADM_PIN_HASH){ err.textContent='PIN ADM incorreto.'; pin.select(); return; }
    pin.value=''; err.textContent=''; pinOverlay.classList.remove('open');
    admActive=true; admOrigin=editorIsOpen()?'editor':'normal'; document.body.classList.add('rprop-adm-active');
    if(admOrigin==='normal') await setAdmOnNormalFrames(true);
    clearStatusVisuals();
  }

  async function exitAdm(){
    if(!admActive) return;
    if(admOrigin==='normal') await setAdmOnNormalFrames(false);
    admActive=false; document.body.classList.remove('rprop-adm-active'); selectOverlay.classList.remove('open');
    if(admOrigin==='normal'){ try{ if(typeof window.__propostaMirrorV31Sync==='function') window.__propostaMirrorV31Sync(); }catch(e){} }
    scheduleStatus(80);
  }

  function openPin(){ if(admActive) return; document.getElementById('v51PinError').textContent=''; pinOverlay.classList.add('open'); setTimeout(()=>document.getElementById('v51PinInput').focus(),20); }

  function installAdmButtons(){
    const entry=document.getElementById('admEntryBtn');
    if(entry && entry.dataset.admBound!=='1'){ entry.dataset.admBound='1'; entry.addEventListener('click',openPin); }
    const header=document.querySelector('.editorHeader');
    if(header && !document.getElementById('editorAdmBtn')){
      const b=document.createElement('button'); b.id='editorAdmBtn'; b.type='button'; b.textContent='🛡️'; b.title='Modo ADM'; b.setAttribute('aria-label','Modo ADM'); b.addEventListener('click',openPin);
      const close=document.getElementById('editorCloseBtn'); header.insertBefore(b,close);
    }
  }

  document.getElementById('v51PinCancel').onclick=()=>pinOverlay.classList.remove('open');
  document.getElementById('v51PinOk').onclick=activateAdm;
  document.getElementById('v51PinInput').addEventListener('keydown',e=>{if(e.key==='Enter')activateAdm();});
  document.getElementById('v51AdmExit').onclick=exitAdm;
  document.getElementById('v51AdmGenerate').onclick=openSelection;
  document.getElementById('v51SelectCancel').onclick=()=>selectOverlay.classList.remove('open');
  document.getElementById('v51SelectGenerate').onclick=generateSelected;

  // If ADM was entered inside the editor, closing the editor also ends that administrative context.
  document.getElementById('editorCloseBtn')?.addEventListener('click',()=>{ if(admActive && admOrigin==='editor') setTimeout(exitAdm,0); });

  function contextItems(){
    if(editorIsOpen()){
      return editor().getPages().filter(p=>p.configured).map(p=>({docId:p.docId,inst:String(p.inst),iframe:p.iframe}));
    }
    return normalSeq();
  }

  function itemLabel(it){
    const repeated=it.docId==='carencia'||it.docId==='carta';
    return (TITLES[it.docId]||it.docId)+(repeated?' — Instância '+it.inst:'');
  }

  function openSelection(){
    const list=document.getElementById('v51SelectList'); list.innerHTML=''; document.getElementById('v51SelectError').textContent='';
    contextItems().forEach((it,i)=>{
      const row=document.createElement('div');row.className='v51-select-row';
      const cb=document.createElement('input');cb.type='checkbox';cb.id='v51Sel_'+i;cb.dataset.doc=it.docId;cb.dataset.inst=it.inst;
      const lab=document.createElement('label');lab.htmlFor=cb.id;lab.textContent=itemLabel(it);
      row.append(cb,lab);list.appendChild(row);
    });
    selectOverlay.classList.add('open');
  }

  async function generateSelected(){
    const err=document.getElementById('v51SelectError'); err.textContent='';
    const selected=Array.from(document.querySelectorAll('#v51SelectList input[type="checkbox"]:checked')).map(cb=>({docId:cb.dataset.doc,inst:cb.dataset.inst}));
    if(!selected.length){err.textContent='Selecione pelo menos um documento ou instância.';return;}
    const all=contextItems(); const seq=selected.map(s=>all.find(x=>x.docId===s.docId&&String(x.inst)===String(s.inst))).filter(Boolean);
    if(seq.length!==selected.length){err.textContent='Uma das instâncias selecionadas não está disponível.';return;}
    const btn=document.getElementById('v51SelectGenerate'),old=btn.textContent;btn.disabled=true;btn.textContent='GERANDO...';
    try{
      if(editorIsOpen()) await engine().synchronizeEditorFramesForPdfV348(seq);
      const nameSeq=editorIsOpen()?editor().getSeq():normalSeq();
      let name=await engine().getPdfFileNameSafe(nameSeq);
      name=String(name||'DOCUMENTO.pdf').replace(/\.pdf$/i,'')+' - PARCIAL.pdf';
      const options={skipCurrentAttachments:true};
      if(editorIsOpen()) options.basePayload=editor().getLoadedPayload();
      const bytes=await engine().generatePdfOriginal(seq,name,options);
      engine().downloadPdfBlob(new Blob([bytes],{type:'application/pdf'}),name);
      selectOverlay.classList.remove('open');
    }catch(e){err.textContent=e&&e.message?e.message:'Não foi possível gerar os documentos selecionados.';}
    finally{btn.disabled=false;btn.textContent=old;}
  }

  // ----- Clickable validation navigation -----
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function directField(docId,text){
    const t=norm(text);
    if(docId==='proposta'){
      if(t.includes('movimentacao')) return {selector:'input[name="mov"]'};
      if(t.includes('vendedor')) return {fieldId:'vendedor'}; if(t.includes('valor do plano'))return{fieldId:'valor_plano'};
      if(t.includes('% da taxa'))return{fieldId:'pct_taxa'}; if(t.includes('taxa'))return{fieldId:'taxa'}; if(t.includes('contrato'))return{fieldId:'contrato_nome'};
      if(t.includes('nome do titular'))return{fieldId:'nome_titular'}; if(t.includes('cpf')){const m=t.match(/dependente (\d)/);return{fieldId:m?'cpf_d'+m[1]:'cpf_titular'};}
      if(t.includes('data de nascimento')){const m=t.match(/dependente (\d)/);return{fieldId:m?'data_d'+m[1]:'data_titular'};}
      if(t.includes('cns')){const m=t.match(/dependente (\d)/);return{fieldId:m?'cns_d'+m[1]:'cns_titular'};}
      if(t.includes('e-mail')){const m=t.match(/dependente (\d)/);return{fieldId:m?'email_d'+m[1]:'email_titular'};}
      if(t.includes('cidade de nascimento'))return{fieldId:'cidade_titular'}; if(t.includes('uf de nascimento'))return{fieldId:'uf_titular'}; if(t.includes('sexo'))return{fieldId:'sexo_titular'}; if(t.includes('estado civil'))return{fieldId:'estado_civil'}; if(t.includes('telefone'))return{fieldId:'fone'};
      if(t.includes('cep'))return{fieldId:'cep'}; if(t.includes('logradouro'))return{fieldId:'logradouro'}; if(t.includes('numero'))return{fieldId:'numero'}; if(t.includes('bairro'))return{fieldId:'bairro'}; if(t.includes('endereco: cidade'))return{fieldId:'cidade'}; if(t.includes('endereco: uf'))return{fieldId:'estado'};
      if(t.includes('carencia / portabilidade'))return{selector:'.psel'}; if(t.includes('plano:'))return{fieldId:'nome_plano'};
    }
    if(docId==='carencia'){
      if(t.includes('nome do beneficiario'))return{fieldId:'nome_benef'}; if(t.includes('urgencia'))return{fieldId:'car_urgencia'}; if(t.includes('consultas'))return{fieldId:'car_consultas'}; if(t.includes('basicos'))return{fieldId:'car_ex_basicos'}; if(t.includes('especiais'))return{fieldId:'car_ex_especiais'}; if(t.includes('internacoes'))return{fieldId:'car_internacoes'}; if(t.includes('cirurgias'))return{fieldId:'car_cirurgias'}; if(t.includes('parto'))return{fieldId:'car_parto'}; if(t.includes('dlp'))return{fieldId:'car_dlp'};
    }
    if(docId==='carta') return {fieldId:'nome_benef'};
    if(docId==='consent'){if(t.includes('e-mail'))return{fieldId:'email'};if(t.includes('ddd'))return{fieldId:'ddd'};if(t.includes('fone'))return{fieldId:'telefone'};}
    if(docId==='comprov'){
      if(t.includes('nome do beneficiario'))return{fieldId:'nome_benef'};if(t.includes('prestadora'))return{fieldId:'prestadora'};if(t.includes('plano contrato'))return{fieldId:'plano_contrato'};if(t.includes('ativacao prevista'))return{selector:'input[name="ativ_tipo"]'};if(t.includes('data de ativacao'))return{fieldId:'ativ_data'};if(t.includes('valor mensal'))return{fieldId:'valor_mensal'};if(t==='contrato.'||t.includes('contrato.'))return{fieldId:'contrato'};if(t.includes('vencimento'))return{fieldId:'venc_dia'};if(t.includes('reajuste'))return{fieldId:'reaj_mes'};if(t.includes('responsavel resolve'))return{fieldId:'resp_resolve'};
    }
    return {};
  }

  function profileHas(docId,target){
    if(target.selector) return true;
    if(!target.fieldId || !editor() || !editor().editableKeysForDoc) return false;
    return editor().editableKeysForDoc(docId).includes('id:'+target.fieldId);
  }

  function correctionTarget(docId,target){
    const editableMode=editorIsOpen()||admActive;
    if(target.selector) return {docId,target};
    if(editableMode && profileHas(docId,target)) return {docId,target};
    if(docId==='consent'){
      if(target.fieldId==='email')return{docId:'proposta',target:{fieldId:'email_titular'}};
      if(target.fieldId==='ddd'||target.fieldId==='telefone')return{docId:'proposta',target:{fieldId:'fone'}};
    }
    if(docId==='comprov'){
      if(target.fieldId==='nome_benef')return{docId:'proposta',target:{fieldId:'nome_titular'}};
      if(['prestadora','plano_contrato'].includes(target.fieldId))return{docId:'proposta',target:{fieldId:'nome_plano'}};
      if(['contrato','venc_dia','reaj_mes'].includes(target.fieldId))return{docId:'proposta',target:{fieldId:'contrato_nome'}};
      if(target.fieldId==='valor_mensal')return{docId:'proposta',target:{fieldId:'valor_plano'}};
      if(target.fieldId==='resp_resolve')return{docId:'proposta',target:{fieldId:'vendedor'}};
    }
    if(docId==='proposta' && target.fieldId==='taxa')return{docId:'proposta',target:{fieldId:'pct_taxa'}};
    if(docId==='proposta' && target.fieldId==='codigo_plano')return{docId:'proposta',target:{fieldId:'nome_plano'}};
    return {docId,target};
  }

  async function focusFrame(it,target){
    if(!it||!it.iframe)return;
    try{it.iframe.contentWindow.postMessage({__rpropV51:true,type:'FOCUS_FIELD_V51',fieldId:target.fieldId||'',selector:target.selector||''},'*');}catch(e){}
  }

  window.__rpropV51NavigateProblem = async (group,item) => {
    const sourceDoc=group.docId || 'proposta', sourceInst=String(group.inst||'1');
    const direct=directField(sourceDoc,item), resolved=correctionTarget(sourceDoc,direct);
    document.getElementById('modalOverlay').style.display='none';
    if(editorIsOpen()){
      const inst=resolved.docId===sourceDoc?sourceInst:'1';
      editor().goTo(resolved.docId,inst); await sleep(100);
      const pg=editor().getPages().find(p=>p.docId===resolved.docId&&String(p.inst)===String(inst)); await focusFrame(pg,resolved.target); return;
    }
    const inst=resolved.docId===sourceDoc?Number(sourceInst):1;
    if(main()) main().activateDoc(resolved.docId,inst); await sleep(100);
    const wrap=document.querySelector('.framewrap[data-doc="'+resolved.docId+'"][data-inst="'+inst+'"]'); await focusFrame({iframe:wrap&&wrap.querySelector('iframe')},resolved.target);
  };

  // ----- Status visual (normal new proposal only) -----
  function clearStatusVisuals(){ document.querySelectorAll('.v51-doc-status').forEach(x=>x.remove()); }
  async function updateStatus(){
    if(admActive || editorIsOpen()){clearStatusVisuals();return;}
    const e=engine(); if(!e)return;
    const seq=normalSeq(); if(!seq.length)return;
    let problems=[]; try{problems=await e.validateRequired(seq);}catch(_){return;}
    if(admActive||editorIsOpen())return;
    const bad=new Set((problems||[]).map(g=>(g.docId||'')+':'+String(g.inst||'1')));
    clearStatusVisuals();
    const grouped={}; seq.forEach(it=>{(grouped[it.docId]||(grouped[it.docId]=[])).push(it);});
    Object.keys(grouped).forEach(docId=>{
      const menu=document.querySelector('.item[data-doc="'+docId+'"] .d'); if(!menu)return;
      const rows=grouped[docId].map(it=>({inst:String(it.inst),ok:!bad.has(docId+':'+String(it.inst))}));
      const el=document.createElement('div'); el.className='v51-doc-status '+(rows.every(x=>x.ok)?'ok':'bad')+(rows.length>1?' multi':'');
      if(rows.length===1) el.textContent=rows[0].ok?'✓ Completo':'⚠ Pendente';
      else el.textContent=rows.map(x=>'Inst. '+x.inst+' '+(x.ok?'✓':'⚠')).join('  •  ');
      menu.appendChild(el);
    });
  }
  function scheduleStatus(ms=300){clearTimeout(statusTimer);statusTimer=setTimeout(updateStatus,ms);}

  // ----- Draft: 2 hours from last saved USER change -----
  function readDraft(){
    try{
      const raw=localStorage.getItem(DRAFT_KEY);
      if(!raw)return null;
      const x=JSON.parse(raw);
      if(!x||!x.lastChanged||Date.now()-Number(x.lastChanged)>DRAFT_TTL){localStorage.removeItem(DRAFT_KEY);return null;}
      return x;
    }catch(e){return null;}
  }
  window.__rpropV51ClearDraft=()=>{try{localStorage.removeItem(DRAFT_KEY);}catch(e){}};

  // IMPORTANT: determine this synchronously, before STATE_CHANGED can schedule a new autosave.
  // While the user has not chosen RECUPERAR or DESCARTAR, the old draft is read-only/protected.
  startupDraft=readDraft();
  draftDecisionPending=!!startupDraft;

  async function captureDraft(){
    if(draftRestoring || draftDecisionPending || editorIsOpen())return;
    const seq=normalSeq(); if(!seq.length)return;
    const docs={};
    for(const it of seq){
      try{
        const r=await postFrame(it.iframe,{type:'EDITOR_EXPORT_V342'},3500);
        if(!r||!r.ok)continue;
        (docs[it.docId]||(docs[it.docId]=[])).push({inst:Number(it.inst||1),controls:Array.isArray(r.controls)?r.controls:[]});
      }catch(e){}
    }
    const counts={};Object.keys(docs).forEach(k=>counts[k]=docs[k].length);
    const data={schema:'rproposta.draft.v1',lastChanged:Date.now(),counts,docs};
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(data));}catch(e){}
  }
  function scheduleDraft(){
    if(draftRestoring||draftDecisionPending||editorIsOpen())return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(captureDraft,420);
  }

  async function applyCounts(counts){
    const m=main();if(!m)return;
    for(const d of m.DOCS){
      const wanted=Math.max(d.min,Math.min(d.max,Number(counts&&counts[d.id]||d.min)));
      m.state.counts[d.id]=wanted;
      m.state.activeInstIndex[d.id]=Math.min(wanted,Math.max(1,m.state.activeInstIndex[d.id]||1));
      m.ensureFrames(d.id);
      m.pruneFrames(d.id);
    }
    m.saveState(m.state);
    m.activateDoc(m.state.activeDocId,m.state.activeInstIndex[m.state.activeDocId]);
  }

  async function waitForDraftFrame(docId,inst,timeout=9000){
    const until=Date.now()+timeout;
    while(Date.now()<until){
      const wrap=document.querySelector('.framewrap[data-doc="'+docId+'"][data-inst="'+String(inst||1)+'"]');
      const iframe=wrap&&wrap.querySelector('iframe');
      if(iframe&&iframe.contentWindow){
        try{
          const pong=await postFrame(iframe,{type:'EDITOR_PING_V344'},1400);
          if(pong&&pong.ok)return iframe;
        }catch(e){}
      }
      await sleep(180);
    }
    return null;
  }

  async function importDraftEntry(docId,entry){
    const inst=Number(entry&&entry.inst||1);
    for(let attempt=0;attempt<4;attempt++){
      const iframe=await waitForDraftFrame(docId,inst,3500);
      if(iframe){
        try{
          const r=await postFrame(iframe,{type:'EDITOR_IMPORT_V342',controls:entry.controls||[]},12000);
          if(r&&r.ok)return true;
        }catch(e){}
      }
      await sleep(350);
    }
    return false;
  }

  function setDraftUiBusy(busy,message=''){
    const recover=document.getElementById('v51DraftRecover');
    const discard=document.getElementById('v51DraftDiscard');
    const msg=document.getElementById('v51DraftMessage');
    if(recover){recover.disabled=!!busy;recover.textContent=busy?'RECUPERANDO...':'RECUPERAR';}
    if(discard)discard.disabled=!!busy;
    if(msg)msg.textContent=message||'';
  }

  async function restoreDraft(draft){
    if(!draft||draftRestoring)return;
    draftRestoring=true;
    draftDecisionPending=true;
    clearTimeout(saveTimer);
    setDraftUiBusy(true,'Restaurando os dados salvos...');
    const failed=[];
    try{
      await applyCounts(draft.counts||{});
      await sleep(250);
      for(const docId of Object.keys(draft.docs||{})){
        for(const entry of draft.docs[docId]||[]){
          const ok=await importDraftEntry(docId,entry);
          if(!ok)failed.push((TITLES[docId]||docId)+' — instância '+String(entry.inst||1));
        }
      }
      if(failed.length){
        setDraftUiBusy(false,'Não foi possível restaurar: '+failed.join('; ')+'. O rascunho foi preservado. Tente RECUPERAR novamente.');
        draftOverlay.classList.add('open');
        return false;
      }
      await sleep(250);
      startupDraft=null;
      draftDecisionPending=false;
      draftOverlay.classList.remove('open');
      setDraftUiBusy(false,'');
      scheduleStatus(50);
      return true;
    }catch(e){
      setDraftUiBusy(false,'A recuperação falhou e o rascunho foi preservado. Tente novamente.');
      draftOverlay.classList.add('open');
      return false;
    }finally{
      draftRestoring=false;
    }
  }

  function checkDraftOnLoad(){
    const d=startupDraft||readDraft();
    if(d){
      startupDraft=d;
      draftDecisionPending=true;
      draftOverlay.classList.add('open');
      setDraftUiBusy(false,'');
    }else{
      draftDecisionPending=false;
    }
  }

  document.getElementById('v51DraftRecover').onclick=()=>{
    const d=startupDraft||readDraft();
    if(d)restoreDraft(d);
    else{draftDecisionPending=false;draftOverlay.classList.remove('open');}
  };
  document.getElementById('v51DraftDiscard').onclick=()=>{
    if(draftRestoring)return;
    window.__rpropV51ClearDraft();
    startupDraft=null;
    draftDecisionPending=false;
    try{localStorage.removeItem('r_proposta_facil_v1_1');}catch(e){}
    location.reload();
  };

  window.addEventListener('message',e=>{
    const m=e.data;
    if(!m||m.__rpropV51!==true)return;
    if(m.type==='STATE_CHANGED'&&!editorIsOpen()){
      // Only a real user interaction may start/reset the draft clock.
      // Synthetic changes caused by page initialization are ignored unless they follow
      // a recent trusted user change (mirrors, calculations, ViaCEP, etc.).
      if(m.userDriven===true){
        lastTrustedFormChange=Date.now();
        scheduleDraft();
      }else if(lastTrustedFormChange && Date.now()-lastTrustedFormChange<5000){
        scheduleDraft();
      }
      scheduleStatus();
    }
  },false);
  document.addEventListener('click',e=>{
    if(e.target&&e.target.closest&&e.target.closest('.instbtn.add,.instbtn.danger')){
      lastTrustedFormChange=Date.now();
      setTimeout(()=>{scheduleDraft();scheduleStatus();if(admActive&&admOrigin==='normal')setAdmOnNormalFrames(true);},250);
    }
  },true);

  // New iframes created while ADM is active inherit the same editor permission source.
  const stage=document.getElementById('stage');
  if(stage){new MutationObserver(muts=>{if(!admActive||admOrigin!=='normal')return;muts.forEach(mu=>mu.addedNodes.forEach(n=>{if(n.nodeType!==1)return;const frames=n.matches&&n.matches('iframe')?[n]:Array.from(n.querySelectorAll?n.querySelectorAll('iframe'):[]);frames.forEach(f=>f.addEventListener('load',()=>setTimeout(()=>setAdmOnNormalFrames(true),80),{once:true}));}));}).observe(stage,{childList:true,subtree:true});}

  // Editor visibility suppresses the normal ✓/⚠ indicators.
  const edOverlay=document.getElementById('editorOverlay');
  if(edOverlay){new MutationObserver(()=>scheduleStatus(50)).observe(edOverlay,{attributes:true,attributeFilter:['class']});}

  installAdmButtons();
  setTimeout(()=>{checkDraftOnLoad();scheduleStatus(100);},450);
})();
