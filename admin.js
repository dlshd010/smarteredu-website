/* SmarterEdu real Supabase-connected admin panel */
(() => {
  const { createClient } = window.supabase || {};
  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const loginForm = document.getElementById('loginForm');
  const loginMsg = document.getElementById('loginMsg');
  const form = document.getElementById('contentForm');
  const formMsg = document.getElementById('formMsg');
  const fileInput = document.getElementById('fFile');
  const fileName = document.getElementById('fileName');
  let client = null;
  let editing = null;

  function showLogin(msg=''){loginView.classList.remove('hidden');appView.classList.add('hidden');loginMsg.textContent=msg}
  function showApp(){loginView.classList.add('hidden');appView.classList.remove('hidden')}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`}
  function message(el,text,ok=false){el.textContent=text;el.style.color=ok?'#08744c':'#a04a00'}

  async function init(){
    if(!createClient || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY){showLogin('Supabase configuration is missing. Check admin-config.js.');return}
    client=createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    const {data:{session}}=await client.auth.getSession();
    if(session) await verifyAdmin(session); else showLogin();
    client.auth.onAuthStateChange(async (_event,session)=>{if(session) await verifyAdmin(session); else showLogin()});
  }

  async function verifyAdmin(session){
    const {data,error}=await client.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();
    if(error || !data){await client.auth.signOut();showLogin('This account is not authorized as a SmarterEdu administrator.');return}
    document.getElementById('adminEmail').textContent=session.user.email||'';showApp();await loadContent();
  }

  loginForm.addEventListener('submit',async e=>{
    e.preventDefault();message(loginMsg,'Signing in…',true);
    const {error}=await client.auth.signInWithPassword({email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPassword').value});
    if(error) message(loginMsg,error.message); else message(loginMsg,'Checking administrator access…',true);
  });
  document.getElementById('logoutBtn').onclick=async()=>{await client.auth.signOut()};

  function go(id){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.side').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelector(`.side[data-tab="${id}"]`)?.classList.add('active')}
  document.querySelectorAll('.side').forEach(b=>b.onclick=()=>go(b.dataset.tab));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='add') resetForm();go(b.dataset.go)});
  fileInput.onchange=()=>fileName.textContent=fileInput.files[0]?.name||'No file selected. Leave empty when editing to keep the current PDF.';

  async function loadContent(){
    const {data,error}=await client.from('premium_content').select('*').order('created_at',{ascending:false});
    if(error){renderError(error.message);return}
    render(data||[]);
  }
  function render(items){
    const pub=items.filter(x=>x.status==='published').length;
    document.getElementById('statPublished').textContent=pub;document.getElementById('statDrafts').textContent=items.length-pub;document.getElementById('statTotal').textContent=items.length;
    const html=items.map(x=>`<div class="product"><div><h3>${esc(x.title)}</h3><p>${esc(x.class_name)} • ${esc(x.subject)}${x.file_path?' • PDF uploaded':' • No PDF'}</p></div><span class="badge ${x.status}">${x.status==='published'?'Published':'Draft'}</span><span class="price">${money(x.price)}</span><div class="actions"><button onclick="window.smEdit('${x.id}')">Edit</button><button onclick="window.smToggle('${x.id}')">${x.status==='published'?'Unpublish':'Publish'}</button><button class="danger" onclick="window.smDelete('${x.id}')">Delete</button></div></div>`).join('')||'<div class="empty">No premium content yet. Click Add Content to create your first product.</div>';
    document.getElementById('dashList').innerHTML=html;document.getElementById('contentList').innerHTML=html;
  }
  function renderError(err){document.getElementById('dashList').innerHTML=`<div class="empty">Could not load content: ${esc(err)}</div>`;document.getElementById('contentList').innerHTML=`<div class="empty">Could not load content: ${esc(err)}</div>`}

  function resetForm(){editing=null;form.reset();document.getElementById('fId').value='';document.getElementById('formHeading').textContent='Add Premium Content';document.getElementById('saveBtn').textContent='Save Content';fileName.textContent='No file selected. Leave empty when editing to keep the current PDF.';message(formMsg,'',true)}
  window.smEdit=async id=>{const {data,error}=await client.from('premium_content').select('*').eq('id',id).single();if(error){alert(error.message);return}editing=data;document.getElementById('fId').value=data.id;document.getElementById('fTitle').value=data.title;document.getElementById('fClass').value=data.class_name;document.getElementById('fSubject').value=data.subject;document.getElementById('fPrice').value=data.price;document.getElementById('fDesc').value=data.description||'';document.getElementById('fStatus').value=data.status;document.getElementById('formHeading').textContent='Edit Premium Content';document.getElementById('saveBtn').textContent='Update Content';fileInput.value='';fileName.textContent=data.file_path?`Current PDF: ${data.file_path.split('/').pop()}`:'No PDF uploaded';message(formMsg,'',true);go('add')};
  window.smToggle=async id=>{const item=(await client.from('premium_content').select('status').eq('id',id).single()).data;if(!item)return;const {error}=await client.from('premium_content').update({status:item.status==='published'?'draft':'published'}).eq('id',id);if(error)alert(error.message);else loadContent()};
  window.smDelete=async id=>{if(!confirm('Delete this premium product? The database record will be removed.'))return;const {data:item}=await client.from('premium_content').select('file_path').eq('id',id).single();const {error}=await client.from('premium_content').delete().eq('id',id);if(error){alert(error.message);return}if(item?.file_path) await client.storage.from('premium-files').remove([item.file_path]);loadContent()};

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const title=document.getElementById('fTitle').value.trim(), className=document.getElementById('fClass').value, subject=document.getElementById('fSubject').value.trim(), price=Number(document.getElementById('fPrice').value), description=document.getElementById('fDesc').value.trim(), status=document.getElementById('fStatus').value, file=fileInput.files[0];
    if(!title||!subject||Number.isNaN(price)){message(formMsg,'Please complete the required fields.');return}
    if(file && file.type!=='application/pdf'){message(formMsg,'Only PDF files are allowed.');return}
    const saveBtn=document.getElementById('saveBtn');saveBtn.disabled=true;saveBtn.textContent='Saving…';message(formMsg,'Saving to Supabase…',true);
    try{
      let filePath=editing?.file_path||null;
      if(file){
        if(file.size>20*1024*1024) throw new Error('PDF is larger than the 20 MB bucket limit.');
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        filePath=`${crypto.randomUUID()}-${safe}`;
        const up=await client.storage.from('premium-files').upload(filePath,file,{contentType:'application/pdf',upsert:false});
        if(up.error) throw up.error;
        if(editing?.file_path) await client.storage.from('premium-files').remove([editing.file_path]);
      }
      const payload={title,class_name:className,subject,description,price,status,file_path:filePath};
      let result;
      if(editing) result=await client.from('premium_content').update(payload).eq('id',editing.id);
      else result=await client.from('premium_content').insert(payload);
      if(result.error) throw result.error;
      message(formMsg,'Saved successfully.',true);resetForm();await loadContent();go('content');
    }catch(err){message(formMsg,err.message||'Something went wrong.');}
    finally{saveBtn.disabled=false;saveBtn.textContent=editing?'Update Content':'Save Content'}
  });
  init();
})();
