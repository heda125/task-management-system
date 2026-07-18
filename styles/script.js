/* =============================================
   TaskFlow — Task Management System
   Software Engineering Project | Al-Aqsa University
   Student: Heba Al-Daya — 2320223929
   File: script.js  (Application Logic Layer)

   Data model matches the ER Diagram:
     USERS(user_id PK, name, email, password [SHA-256 hashed], role)
     TASKS(task_id PK, user_id FK, category FK, title, priority, status, due_date)
     CATEGORIES(category_id PK, category_name)
   ============================================= */

/* ═══════════════════════════════════════════════════
   SECURITY  —  NFR-1: تشفير كلمات المرور
   نستخدم SHA-256 عبر Web Crypto API (مدمجة بالمتصفّح)
   كلمة المرور لا تُخزَّن أبداً كنص عادي.
   ═══════════════════════════════════════════════════ */
async function hashPassword(plain){
  const data = new TextEncoder().encode(plain);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
              .map(b => b.toString(16).padStart(2,'0'))
              .join('');
}

/* ═══════════════════════════════════════════════════
   DATA LAYER  —  يطابق الـ ER Diagram
   الجداول: USERS / TASKS / CATEGORIES
   ═══════════════════════════════════════════════════ */
const DB = {
  get users()      { return JSON.parse(localStorage.getItem('tf_users')   || '[]'); },
  set users(v)     { localStorage.setItem('tf_users', JSON.stringify(v)); },
  get tasks()      { return JSON.parse(localStorage.getItem('tf_tasks')   || '[]'); },
  set tasks(v)     { localStorage.setItem('tf_tasks', JSON.stringify(v)); },
  get categories() { return JSON.parse(localStorage.getItem('tf_cats')    || '[]'); },
  set categories(v){ localStorage.setItem('tf_cats', JSON.stringify(v)); },
  get session()    { return JSON.parse(localStorage.getItem('tf_session') || 'null'); },
  set session(v)   { v ? localStorage.setItem('tf_session', JSON.stringify(v))
                       : localStorage.removeItem('tf_session'); }
};

/* seed: admin + الفئات الافتراضية */
async function seed(){
  /* ترحيل: النسخ القديمة خزّنت كلمات المرور كنص عادي.
     الهاش دائماً 64 حرفاً — أي قيمة أقصر تعني بيانات قديمة، فنمسحها. */
  const old = DB.users.some(u => !u.password || u.password.length !== 64);
  if(old){
    localStorage.removeItem('tf_users');
    localStorage.removeItem('tf_tasks');
    localStorage.removeItem('tf_session');
  }

  if(!DB.users.length){
    DB.users = [{
      user_id: 1, name:'مدير النظام', email:'admin@taskflow.com',
      password: await hashPassword('admin123'),   // مشفّرة — NFR-1
      role:'admin', active:true
    }];
  }
  if(!DB.categories.length){
    DB.categories = [
      { category_id:1, category_name:'عام'   },
      { category_id:2, category_name:'دراسة' },
      { category_id:3, category_name:'عمل'   },
      { category_id:4, category_name:'شخصي'  },
    ];
  }
}

/* ═══ STATE ═══ */
let me = null;          // المستخدم الحالي (session)
let filter='all', catFilter='all', view='tasks';

/* ═══════════════════════════════════════════════════
   AUTH  —  UC-1 Register / UC-2 Login
   ═══════════════════════════════════════════════════ */
function switchAuth(mode){
  document.getElementById('loginForm').style.display = mode==='login'    ? 'block':'none';
  document.getElementById('regForm').style.display   = mode==='register' ? 'block':'none';
  document.getElementById('resetForm').style.display = mode==='reset'    ? 'block':'none';

  /* التبويبات تظهر فقط في وضع الدخول/التسجيل */
  const tabs = document.querySelector('.auth-tabs');
  tabs.style.display = mode==='reset' ? 'none' : 'flex';

  document.getElementById('tabLogin').classList.toggle('on', mode==='login');
  document.getElementById('tabReg').classList.toggle('on', mode==='register');
  hideErr();
}
function showErr(m){ const e=document.getElementById('authErr'); e.textContent=m; e.classList.add('show'); }
function hideErr(){ document.getElementById('authErr').classList.remove('show'); }

async function doRegister(){
  const name = document.getElementById('rgName').value.trim();
  const mail = document.getElementById('rgEmail').value.trim().toLowerCase();
  const pass = document.getElementById('rgPass').value;

  if(!name || !mail || !pass) return showErr('املئي جميع الحقول');
  if(!/^\S+@\S+\.\S+$/.test(mail)) return showErr('البريد الإلكتروني غير صالح');
  if(pass.length < 6) return showErr('كلمة المرور 6 أحرف على الأقل');

  const users = DB.users;
  if(users.some(u => u.email === mail)) return showErr('البريد مسجّل مسبقاً');   // Alternative Flow

  const u = {
    user_id: Date.now(),
    name, email: mail,
    password: await hashPassword(pass),          // تُخزَّن مشفّرة — NFR-1
    role: 'user', active: true
  };
  users.push(u);
  DB.users = users;
  DB.session = u.user_id;                                                        // Postcondition
  hideErr(); enterApp();
  toast('تم إنشاء الحساب');
}

async function doLogin(){
  const mail = document.getElementById('liEmail').value.trim().toLowerCase();
  const pass = document.getElementById('liPass').value;
  if(!mail || !pass) return showErr('املئي جميع الحقول');

  const hashed = await hashPassword(pass);                    // نشفّر المُدخَل ونقارن الهاش
  const u = DB.users.find(x => x.email===mail && x.password===hashed);
  if(!u)         return showErr('البريد أو كلمة المرور غير صحيحة');              // Alternative Flow
  if(!u.active)  return showErr('هذا الحساب معطّل. راجعي المدير');

  DB.session = u.user_id;                                                        // Create session
  hideErr(); enterApp();
}

/* ── FR-3: استعادة كلمة المرور ── */
async function doReset(){
  const mail  = document.getElementById('rsEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('rsPass').value;
  const pass2 = document.getElementById('rsPass2').value;

  if(!mail || !pass || !pass2)   return showErr('املئي جميع الحقول');
  if(pass.length < 6)            return showErr('كلمة المرور 6 أحرف على الأقل');
  if(pass !== pass2)             return showErr('كلمتا المرور غير متطابقتين');

  const users = DB.users;
  const u = users.find(x => x.email === mail);
  if(!u)        return showErr('لا يوجد حساب بهذا البريد');   // Alternative Flow
  if(!u.active) return showErr('هذا الحساب معطّل. راجعي المدير');

  u.password = await hashPassword(pass);                       // مشفّرة — NFR-1
  DB.users = users;                                            // Postcondition

  ['rsEmail','rsPass','rsPass2'].forEach(id => document.getElementById(id).value='');
  switchAuth('login');
  document.getElementById('liEmail').value = mail;
  toast('تم تغيير كلمة المرور — سجّلي الدخول');
}

function doLogout(){
  DB.session = null; me = null;
  document.getElementById('shell').classList.remove('on');
  document.getElementById('authScreen').style.display = 'flex';
  ['liEmail','liPass','rgName','rgEmail','rgPass'].forEach(id => document.getElementById(id).value='');
  switchAuth('login');
}

function enterApp(){
  me = DB.users.find(u => u.user_id === DB.session);
  if(!me || !me.active){ DB.session=null; return; }

  document.getElementById('authScreen').style.display='none';
  document.getElementById('shell').classList.add('on');

  const isAdmin = me.role==='admin';
  document.getElementById('sbAv').textContent = me.name.charAt(0);
  document.getElementById('sbAv').classList.toggle('admin', isAdmin);
  document.getElementById('sbName').textContent = me.name;
  document.getElementById('sbRole').innerHTML = isAdmin
    ? 'مدير النظام <span class="role-chip">ADMIN</span>' : 'مستخدم';
  document.getElementById('adminNav').style.display = isAdmin ? 'block':'none';

  buildCatNav(); buildCatSelect();
  setView('tasks'); render();
}

/* ═══════════════════════════════════════════════════
   CATEGORIES
   ═══════════════════════════════════════════════════ */
function buildCatNav(){
  const nav = document.getElementById('catNav');
  const cats = DB.categories;
  nav.innerHTML = `
    <div class="sb-item on" onclick="setCat('all',this)">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      جميع المهام <span class="sb-item-count" id="cnt-all">0</span>
    </div>` +
    cats.map(c => `
    <div class="sb-item" onclick="setCat('${esc(c.category_name)}',this)">
      <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      ${esc(c.category_name)} <span class="sb-item-count" data-cnt="${esc(c.category_name)}">0</span>
    </div>`).join('');
}
function buildCatSelect(){
  const sel = document.getElementById('catInp');
  sel.innerHTML = DB.categories.map(c=>`<option value="${esc(c.category_name)}">${esc(c.category_name)}</option>`).join('');
}
function addCategory(){
  const inp = document.getElementById('newCat');
  const n = inp.value.trim();
  if(!n) return toast('اكتبي اسم الفئة');
  const cats = DB.categories;
  if(cats.some(c=>c.category_name===n)) return toast('هذه الفئة موجودة');
  cats.push({ category_id: Date.now(), category_name: n });
  DB.categories = cats;
  inp.value='';
  buildCatNav(); buildCatSelect(); render();
  toast('تمت إضافة الفئة');
}
function delCategory(id){
  const cats = DB.categories;
  const c = cats.find(x=>x.category_id===id);
  if(!c) return;
  const used = DB.tasks.filter(t=>t.category===c.category_name).length;
  if(used) return toast(`لا يمكن الحذف — ${used} مهمة تستخدم هذه الفئة`);
  DB.categories = cats.filter(x=>x.category_id!==id);
  buildCatNav(); buildCatSelect(); render();
  toast('تم حذف الفئة');
}
function renameCategory(id){
  const cats = DB.categories;
  const c = cats.find(x=>x.category_id===id);
  if(!c) return;
  const n = prompt('اسم الفئة الجديد:', c.category_name);
  if(!n || !n.trim()) return;
  const old = c.category_name;
  c.category_name = n.trim();
  DB.categories = cats;
  const ts = DB.tasks;
  ts.forEach(t=>{ if(t.category===old) t.category=c.category_name; });
  DB.tasks = ts;
  buildCatNav(); buildCatSelect(); render();
  toast('تم تعديل الفئة');
}

/* ═══════════════════════════════════════════════════
   TASKS  —  UC-3..UC-6  (كل مستخدم يرى مهامه فقط)
   ═══════════════════════════════════════════════════ */
function myTasks(){ return DB.tasks.filter(t => t.user_id === me.user_id); }

function addTask(){
  const inp = document.getElementById('taskInp');
  const txt = inp.value.trim();
  if(!txt) return toast('اكتبي عنوان المهمة');          // Alternative Flow: title empty

  const ts = DB.tasks;
  ts.unshift({
    task_id:  Date.now(),
    user_id:  me.user_id,                                // FK → USERS
    category: document.getElementById('catInp').value,   // FK → CATEGORIES
    title:    txt,
    description: '',
    priority: document.getElementById('prioInp').value,
    status:   false,
    due_date: document.getElementById('dateInp').value,
    time:     nowTime(),
    editing:  false
  });
  DB.tasks = ts;
  inp.value=''; render();
  toast('تمت إضافة المهمة');
}
function toggleDone(id){
  const ts = DB.tasks; const t = ts.find(x=>x.task_id===id);
  if(t && t.user_id===me.user_id){ t.status=!t.status; DB.tasks=ts; render(); }
}
function delTask(id){
  DB.tasks = DB.tasks.filter(x => !(x.task_id===id && x.user_id===me.user_id));
  render(); toast('تم حذف المهمة');
}
function startEdit(id){
  const ts = DB.tasks;
  ts.forEach(t=>t.editing=false);
  const t = ts.find(x=>x.task_id===id && x.user_id===me.user_id);
  if(t) t.editing=true;
  DB.tasks = ts; render();
  setTimeout(()=>{ const e=document.getElementById('ei-'+id); if(e){e.focus();e.select();} },40);
}
function saveEdit(id){
  const inp = document.getElementById('ei-'+id); if(!inp) return;
  const v = inp.value.trim();
  if(!v) return toast('لا يمكن حفظ مهمة فارغة');
  const ts = DB.tasks; const t = ts.find(x=>x.task_id===id);
  if(t){ t.title=v; t.editing=false; DB.tasks=ts; render(); toast('تم تعديل المهمة'); }
}
function cancelEdit(id){
  const ts = DB.tasks; const t = ts.find(x=>x.task_id===id);
  if(t){ t.editing=false; DB.tasks=ts; render(); }
}
function clearDone(){
  const n = myTasks().filter(t=>t.status).length;
  if(!n){ closeOv('clearOv'); return toast('لا توجد مهام منجزة'); }
  DB.tasks = DB.tasks.filter(t => !(t.user_id===me.user_id && t.status));
  render(); closeOv('clearOv');
  toast(`تم حذف ${n} مهمة منجزة`);
}

/* ═══ FILTER / SORT ═══ */
function setFilter(f, btn){
  filter=f;
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); render();
}
function setCat(c, btn){
  catFilter=c;
  document.querySelectorAll('#catNav .sb-item').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  setView('tasks');
  document.getElementById('topTitle').textContent = c==='all' ? 'جميع المهام' : 'مهام: '+c;
  render();
  autoCloseMenu();
}
function getSorted(arr){
  const s = document.getElementById('sortSel').value;
  const c = [...arr];
  if(s==='oldest') return c.reverse();
  if(s==='prio'){ const o={high:0,medium:1,low:2}; return c.sort((a,b)=>o[a.priority]-o[b.priority]); }
  if(s==='alpha') return c.sort((a,b)=>a.title.localeCompare(b.title,'ar'));
  return c;
}

/* ═══ VIEWS ═══ */
function setView(v, btn){
  view=v;
  ['tasks','users','cats','reports'].forEach(x=>{
    document.getElementById('v-'+x).classList.toggle('on', x===v);
  });
  if(btn){
    document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
  }
  const titles = { tasks:'جميع المهام', users:'إدارة المستخدمين', cats:'إدارة الفئات', reports:'التقارير' };
  document.getElementById('topTitle').textContent = titles[v];
  render();
  if(btn) autoCloseMenu();
}

/* ═══════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════ */
function render(){
  if(!me) return;
  const mine = myTasks();

  /* stats */
  const total = mine.length, done = mine.filter(t=>t.status).length;
  const active = total-done, high = mine.filter(t=>t.priority==='high' && !t.status).length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('stTotal').textContent  = total;
  document.getElementById('stDone').textContent   = done;
  document.getElementById('stActive').textContent = active;
  document.getElementById('stHigh').textContent   = high;
  document.getElementById('pctTxt').textContent   = pct+'%';
  document.getElementById('progFill').style.width = pct+'%';   // FR-10 progress bar
  document.getElementById('topSub').textContent   = `${active} قيد التنفيذ · ${done} منجزة`;

  /* category counts */
  const allCnt = document.getElementById('cnt-all');
  if(allCnt) allCnt.textContent = total;
  document.querySelectorAll('[data-cnt]').forEach(el=>{
    el.textContent = mine.filter(t=>t.category===el.dataset.cnt).length;
  });

  if(view==='tasks')   renderTasks(mine);
  if(view==='users')   renderUsers();
  if(view==='cats')    renderCats();
  if(view==='reports') renderReports();
}

function renderTasks(mine){
  const list = document.getElementById('taskList');
  const q = document.getElementById('searchInp').value.trim().toLowerCase();

  let vis = mine.filter(t=>{
    if(catFilter!=='all' && t.category!==catFilter) return false;
    if(filter==='active' && t.status)  return false;
    if(filter==='done'   && !t.status) return false;
    if(q && !t.title.toLowerCase().includes(q)) return false;   // FR-11 search
    return true;
  });
  vis = getSorted(vis);
  document.getElementById('resultsTxt').textContent = `عرض ${vis.length} من ${mine.length} مهمة`;

  if(!vis.length){
    const msgs = {
      all:   {t:'لا توجد مهام بعد',        s:'أضيفي مهمتك الأولى من الأعلى'},
      active:{t:'لا توجد مهام قيد التنفيذ', s:'أنجزتِ كل مهامك'},
      done:  {t:'لا توجد مهام منجزة',       s:'أنجزي مهمة لتظهر هنا'},
    };
    const m = msgs[filter] || msgs.all;
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
      <div class="empty-title">${m.t}</div><div class="empty-sub">${m.s}</div></div>`;
    return;
  }

  const pl = {high:'عالية',medium:'متوسطة',low:'منخفضة'};
  const pc = {high:'tag-high',medium:'tag-medium',low:'tag-low'};

  list.innerHTML = vis.map(t=>{
    if(t.editing) return `
    <div class="task-card">
      <div class="edit-row">
        <input class="edit-inp" id="ei-${t.task_id}" value="${esc(t.title)}"
          onkeydown="if(event.key==='Enter')saveEdit(${t.task_id});if(event.key==='Escape')cancelEdit(${t.task_id})">
        <button class="btn-sv" onclick="saveEdit(${t.task_id})">حفظ</button>
        <button class="btn-cx" onclick="cancelEdit(${t.task_id})">إلغاء</button>
      </div>
    </div>`;
    return `
    <div class="task-card prio-${t.priority} ${t.status?'done-card':''}">
      <div class="chk ${t.status?'ticked':''}" onclick="toggleDone(${t.task_id})">
        <svg class="chk-svg" viewBox="0 0 14 14"><polyline points="2,7 6,11 12,3"/></svg>
      </div>
      <div class="task-body">
        <div class="task-txt">${esc(t.title)}</div>
        <div class="task-meta">
          <span class="tag tag-cat">${esc(t.category)}</span>
          <span class="tag ${pc[t.priority]}">${pl[t.priority]}</span>
          ${t.due_date ? `<span class="tag tag-low">${esc(t.due_date)}</span>` : ''}
          <span class="task-time">${t.time}</span>
        </div>
      </div>
      <div class="task-acts">
        <button class="act act-edit" onclick="startEdit(${t.task_id})" title="تعديل">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="act act-del" onclick="delTask(${t.task_id})" title="حذف">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ── UC-7 Manage Users ── */
function renderUsers(){
  const body = document.getElementById('usersBody');
  body.innerHTML = DB.users.map(u=>{
    const n = DB.tasks.filter(t=>t.user_id===u.user_id).length;
    const isMe = u.user_id===me.user_id;
    return `<tr>
      <td>
        <div class="u-cell">
          <div class="u-av ${u.role==='admin'?'admin':''}">${esc(u.name.charAt(0))}</div>
          <div><div class="u-name">${esc(u.name)}${isMe?' (أنتِ)':''}</div><div class="u-mail">${esc(u.email)}</div></div>
        </div>
      </td>
      <td data-label="الدور"><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role==='admin'?'مدير':'مستخدم'}</span></td>
      <td data-label="المهام">${n}</td>
      <td data-label="الحالة"><span class="badge ${u.active?'badge-on':'badge-off'}">${u.active?'نشط':'معطّل'}</span></td>
      <td data-label="إجراءات">
        ${isMe ? '<span style="font-size:.72rem;color:var(--muted)">—</span>' : `
          <button class="mini-btn ${u.active?'danger':'ok'}" onclick="toggleUser(${u.user_id})">
            ${u.active?'تعطيل':'تفعيل'}
          </button>
          <button class="mini-btn danger" onclick="delUser(${u.user_id})">حذف</button>`}
      </td>
    </tr>`;
  }).join('');
}
function toggleUser(id){
  const us = DB.users; const u = us.find(x=>x.user_id===id);
  if(!u || u.user_id===me.user_id) return;
  u.active = !u.active; DB.users = us; render();
  toast(u.active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
}
function delUser(id){
  if(id===me.user_id) return;
  const u = DB.users.find(x=>x.user_id===id);
  if(!u) return;
  if(!confirm(`حذف حساب "${u.name}" وجميع مهامه؟`)) return;
  DB.users = DB.users.filter(x=>x.user_id!==id);
  DB.tasks = DB.tasks.filter(t=>t.user_id!==id);
  render(); toast('تم حذف الحساب');
}

/* ── UC-8 Manage Categories ── */
function renderCats(){
  const body = document.getElementById('catsBody');
  body.innerHTML = DB.categories.map(c=>{
    const n = DB.tasks.filter(t=>t.category===c.category_name).length;
    return `<tr>
      <td style="font-weight:800;color:var(--navy)">${esc(c.category_name)}</td>
      <td data-label="المعرّف" style="color:var(--muted);font-size:.76rem">${c.category_id}</td>
      <td data-label="عدد المهام">${n}</td>
      <td data-label="إجراءات">
        <button class="mini-btn" onclick="renameCategory(${c.category_id})">تعديل</button>
        <button class="mini-btn danger" onclick="delCategory(${c.category_id})">حذف</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── FR-17 Reports ── */
function renderReports(){
  const users = DB.users, tasks = DB.tasks, cats = DB.categories;
  const done = tasks.filter(t=>t.status).length;
  const pct  = tasks.length ? Math.round(done/tasks.length*100) : 0;

  document.getElementById('repGrid').innerHTML = `
    <div class="rep-card"><div class="rep-val">${users.length}</div><div class="rep-lbl">المستخدمون</div></div>
    <div class="rep-card"><div class="rep-val">${tasks.length}</div><div class="rep-lbl">إجمالي المهام</div></div>
    <div class="rep-card"><div class="rep-val">${done}</div><div class="rep-lbl">المهام المنجزة</div></div>
    <div class="rep-card"><div class="rep-val">${cats.length}</div><div class="rep-lbl">الفئات</div></div>
    <div class="rep-card">
      <div class="rep-val">${pct}%</div><div class="rep-lbl">نسبة الإنجاز العامة</div>
      <div class="rep-bar"><div class="rep-bar-fill" style="width:${pct}%"></div></div>
    </div>`;

  document.getElementById('repBody').innerHTML = users.map(u=>{
    const ut = tasks.filter(t=>t.user_id===u.user_id);
    const ud = ut.filter(t=>t.status).length;
    const up = ut.length ? Math.round(ud/ut.length*100) : 0;
    return `<tr>
      <td><div class="u-cell">
        <div class="u-av ${u.role==='admin'?'admin':''}">${esc(u.name.charAt(0))}</div>
        <div class="u-name">${esc(u.name)}</div>
      </div></td>
      <td data-label="الإجمالي">${ut.length}</td>
      <td data-label="المنجزة">${ud}</td>
      <td data-label="نسبة الإنجاز" style="min-width:110px">
        <div style="font-weight:800;color:var(--navy);font-size:.8rem">${up}%</div>
        <div class="rep-bar"><div class="rep-bar-fill" style="width:${up}%"></div></div>
      </td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════
   MOBILE MENU  —  NFR-7 responsive
   ═══════════════════════════════════════════════════ */
function toggleMenu(){
  const sb = document.getElementById('sidebar');
  const sc = document.getElementById('scrim');
  const open = sb.classList.toggle('open');
  sc.classList.toggle('on', open);
  const main = document.querySelector('.main');
  if(main) main.style.overflow = open ? 'hidden' : 'auto';
}
function closeMenu(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.remove('on');
  const main = document.querySelector('.main');
  if(main) main.style.overflow = 'auto';   // نضمن رجوع التمرير دائماً
}
/* تُغلق القائمة تلقائياً عند اختيار عنصر على الموبايل */
function autoCloseMenu(){ if(window.innerWidth <= 768) closeMenu(); }

/* ESC يغلق القائمة */
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMenu(); });
/* عند تكبير الشاشة تُغلق القائمة */
window.addEventListener('resize', ()=>{ if(window.innerWidth > 768) closeMenu(); });

/* ═══ HELPERS ═══ */
function nowTime(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
let tTimer;
function toast(m){
  const el=document.getElementById('toast');
  document.getElementById('toastTxt').textContent=m;
  el.classList.add('show'); clearTimeout(tTimer);
  tTimer=setTimeout(()=>el.classList.remove('show'),2400);
}
function openClearModal(){ document.getElementById('clearOv').classList.add('on'); }
function closeOv(id){ document.getElementById(id).classList.remove('on'); }
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('on'); });
});

/* ═══ INIT ═══ */
document.getElementById('taskInp').addEventListener('keydown', e=>{ if(e.key==='Enter') addTask(); });
document.getElementById('newCat') .addEventListener('keydown', e=>{ if(e.key==='Enter') addCategory(); });
document.getElementById('liPass') .addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
document.getElementById('rgPass') .addEventListener('keydown', e=>{ if(e.key==='Enter') doRegister(); });
document.getElementById('rsPass2').addEventListener('keydown', e=>{ if(e.key==='Enter') doReset(); });

/* التهيئة: نُنشئ حساب المدير (بكلمة مرور مشفّرة) ثم نستأنف الجلسة إن وُجدت */
(async function init(){
  await seed();
  if(DB.session) enterApp();
})();