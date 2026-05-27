// ══════════════════════════════════════════════════════════════
// School Bloom v2 — app.js
// EduBloom Suite · AariNAT Company Limited
// Architecture: Firestore only — NO localStorage for entity data
// ══════════════════════════════════════════════════════════════

// ── Firebase Config ────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC3H3P9GrumpnFbqCJAKJGHVKKN6_5mhqY",
  authDomain: "edubloom-school.firebaseapp.com",
  projectId: "edubloom-school",
  storageBucket: "edubloom-school.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── State ──────────────────────────────────────────────────────
let schoolId   = null;
let schoolData = null;   // config doc from Firestore
let SD = {               // in-memory only — never written to localStorage
  students:   [],
  scores:     [],
  payments:   [],
  staff:      [],
  expenses:   [],
};

// ── Sync Queue (offline-first) ─────────────────────────────────
const SQ = {
  q: JSON.parse(localStorage.getItem('sq_v2') || '[]'),
  _syncing: false,
  push(op){ this.q.push(op); localStorage.setItem('sq_v2', JSON.stringify(this.q)); this._trySync(); },
  async _trySync(){
    if(!navigator.onLine || !db || !schoolId || !this.q.length || this._syncing) return;
    this._syncing = true;
    showSyncBadge(true);
    const done = [];
    for(const op of this.q){
      try{
        if(op.t==='addStudent')   await db.collection('students').add({...op.d, schoolId});
        else if(op.t==='addScore')     await db.collection('scores').add({...op.d, schoolId});
        else if(op.t==='addPayment')   await db.collection('payments').add({...op.d, schoolId});
        else if(op.t==='addStaff')     await db.collection('staff').add({...op.d, schoolId});
        else if(op.t==='addExpense')   await db.collection('expenses').add({...op.d, schoolId});
        else if(op.t==='deleteStudent')await db.collection('students').doc(op.id).delete();
        done.push(op);
      }catch(e){ console.warn('SQ op failed:', op.t, e); break; }
    }
    this.q = this.q.filter(o=>!done.includes(o));
    localStorage.setItem('sq_v2', JSON.stringify(this.q));
    this._syncing = false;
    showSyncBadge(this.q.length > 0);
    if(done.length) refreshCurrentSection();
  }
};

window.addEventListener('online',  ()=>{ setStatus(true);  SQ._trySync(); });
window.addEventListener('offline', ()=>{ setStatus(false); });

// ── Helpers ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n||0).toLocaleString('en-NG');
const grade = t => t>=75?'A1':t>=70?'B2':t>=65?'B3':t>=60?'C4':t>=55?'C5':t>=50?'C6':t>=45?'D7':t>=40?'E8':'F9';
const remark = t => t>=50?'Pass':'Fail';

let _toastTimer;
function toast(msg, dur=3000){
  const el=$('toast'); if(!el)return;
  el.textContent=msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('show'), dur);
}

function setStatus(online){
  const dot=$('status-dot'), txt=$('status-txt');
  if(!dot||!txt) return;
  dot.className='status-dot'+(online?'':' offline');
  txt.textContent=online?'Online':'Offline';
}

function showSyncBadge(show){
  const el=$('sync-badge'); if(el) el.style.display=show?'inline':'none';
}

function togglePw(id, el){
  const inp=$(id); if(!inp) return;
  inp.type = inp.type==='password' ? 'text' : 'password';
  el.textContent = inp.type==='password' ? '👁' : '🙈';
}

function openModal(id){ const el=$(id); if(el){ el.classList.add('open'); } }
function closeModal(id){ const el=$(id); if(el){ el.classList.remove('open'); } }

// Close modals on background tap
document.addEventListener('click', e=>{
  if(e.target.classList.contains('modal-bg')) e.target.classList.remove('open');
});

// ── Navigation ─────────────────────────────────────────────────
const NAV_FN = {
  dashboard:  renderDashboard,
  students:   renderStudentList,
  scores:     renderScores,
  fees:       renderFees,
  guarantee:  renderGuarantee,
  attendance: renderAttendance,
  staff:      renderStaff,
  expenses:   renderExpenses,
  settings:   loadSettings,
};

function go(tab){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nlink').forEach(b=>b.classList.remove('on'));
  const sec=$(`sec-${tab}`), btn=document.querySelector(`[data-t="${tab}"]`);
  if(sec) sec.classList.add('on');
  if(btn) btn.classList.add('on');
  if(NAV_FN[tab]) NAV_FN[tab]();
}

function refreshCurrentSection(){
  const active=document.querySelector('.nlink.on');
  if(active){ const t=active.dataset.t; if(NAV_FN[t]) NAV_FN[t](); }
}

// ── LOGIN ──────────────────────────────────────────────────────
async function doLogin(){
  const id  = $('login-id')?.value.trim().toUpperCase();
  const pw  = $('login-pw')?.value.trim();
  const btn = $('login-btn');
  const err = $('login-err');
  if(!id || !pw){ showErr('Enter your School ID and password.'); return; }
  btn.textContent='Checking...'; btn.disabled=true;
  err.style.display='none';
  try{
    const snap = await db.collection('schools').where('schoolId','==',id).limit(1).get();
    if(snap.empty){ showErr('School ID not found.'); reset(); return; }
    const doc  = snap.docs[0];
    const data = doc.data();
    if(data.config?.password !== pw){ showErr('Wrong password.'); reset(); return; }
    schoolId   = id;
    schoolData = data;
    localStorage.setItem('sb2_school', id);
    await bootApp();
  }catch(e){
    // Offline fallback
    const cached = localStorage.getItem('sb2_school');
    if(cached && cached===id){
      schoolId = id;
      schoolData = JSON.parse(localStorage.getItem('sb2_config')||'{}');
      await bootApp(true);
    } else {
      showErr('Cannot connect. Check internet.');
    }
  }
  reset();
  function reset(){ btn.textContent='🔓 Login'; btn.disabled=false; }
  function showErr(msg){ err.textContent=msg; err.style.display='block'; }
}

function doLogout(){
  if(!confirm('Logout?')) return;
  schoolId=null; schoolData=null;
  SD={students:[],scores:[],payments:[],staff:[],expenses:[]};
  $('login-id').value=''; $('login-pw').value='';
  $('app').style.display='none';
  $('login-screen').style.display='flex';
}

// ── BOOT ───────────────────────────────────────────────────────
async function bootApp(offlineMode=false){
  $('login-screen').style.display='none';
  $('app').style.display='flex';
  $('school-name-display').textContent = schoolData?.schoolName || schoolId;
  setStatus(navigator.onLine);
  if(!offlineMode) await loadAllData();
  renderDashboard();
  SQ._trySync();
}

async function loadAllData(){
  try{
    const [stuSnap, scSnap, paySnap, stfSnap, expSnap] = await Promise.all([
      db.collection('students').where('schoolId','==',schoolId).get(),
      db.collection('scores').where('schoolId','==',schoolId).get(),
      db.collection('payments').where('schoolId','==',schoolId).get(),
      db.collection('staff').where('schoolId','==',schoolId).get(),
      db.collection('expenses').where('schoolId','==',schoolId).get(),
    ]);
    SD.students = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
    SD.scores   = scSnap.docs.map(d=>({id:d.id,...d.data()}));
    SD.payments = paySnap.docs.map(d=>({id:d.id,...d.data()}));
    SD.staff    = stfSnap.docs.map(d=>({id:d.id,...d.data()}));
    SD.expenses = expSnap.docs.map(d=>({id:d.id,...d.data()}));
    // Cache config for offline login
    localStorage.setItem('sb2_config', JSON.stringify(schoolData||{}));
  }catch(e){ console.warn('loadAllData failed:', e); }
}

// ── DASHBOARD ──────────────────────────────────────────────────
function renderDashboard(){
  const el=$('dashboard-content'); if(!el) return;
  const term = schoolData?.config?.currentTerm||'Term 1';
  const session = schoolData?.config?.currentSession||'';
  const totalStudents = SD.students.filter(s=>s.status!=='withdrawn').length;
  const termPayments  = SD.payments.filter(p=>p.term===term);
  const totalFees     = termPayments.reduce((s,p)=>s+(p.amount||0),0);
  const totalExpenses = SD.expenses.filter(e=>{
    const d=e.date?.toDate?e.date.toDate():new Date(e.date||0);
    return d.getFullYear()===new Date().getFullYear();
  }).reduce((s,e)=>s+(e.amount||0),0);
  const classes=[...new Set(SD.students.map(s=>s.classArm||s.class||'').filter(Boolean))].sort();

  el.innerHTML=`
    <div style="padding:0.5rem 0 1rem;">
      <div style="font-size:1.1rem;font-weight:700;">👋 Welcome back</div>
      <div style="font-size:0.8rem;color:var(--sub);margin-top:2px;">${esc(schoolData?.schoolName||schoolId)} · ${esc(term)} ${esc(session)}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val" style="color:var(--brand);">${totalStudents}</div><div class="stat-lbl">Students</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--money);">₦${fmt(totalFees)}</div><div class="stat-lbl">Fees (${term})</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--danger);">₦${fmt(totalExpenses)}</div><div class="stat-lbl">Expenses (Year)</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--brand2);">${SD.staff.length}</div><div class="stat-lbl">Staff</div></div>
    </div>
    ${classes.length?`
    <div class="card">
      <div class="ct" style="font-size:0.85rem;">📚 Classes</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:0.3rem;">
        ${classes.map(c=>{
          const count=SD.students.filter(s=>(s.classArm||s.class)===c&&s.status!=='withdrawn').length;
          return`<div style="background:var(--card2);border-radius:8px;padding:5px 12px;font-size:0.78rem;">
            <span style="font-weight:600;">${esc(c)}</span>
            <span style="color:var(--sub);margin-left:5px;">${count} students</span>
          </div>`;
        }).join('')}
      </div>
    </div>`:''}
    ${SQ.q.length?`<div class="card" style="border-color:var(--warn);"><div style="font-size:0.82rem;color:var(--warn);">⏳ ${SQ.q.length} action(s) queued offline — will sync when online.</div></div>`:''}
  `;
}

// ── STUDENTS ───────────────────────────────────────────────────
let _studentFilter = '';
let _classFilter   = '';

function renderStudentList(){
  const classes=[...new Set(SD.students.map(s=>s.classArm||s.class||'').filter(Boolean))].sort();
  // Class filter bar
  const bar=$('class-filter-bar');
  if(bar){
    bar.innerHTML=`<button onclick="setClassFilter('')" class="btn-sm" style="${!_classFilter?'background:var(--brand);color:#fff;border-color:var(--brand);':''}">All</button>`
      +classes.map(c=>`<button onclick="setClassFilter('${esc(c)}')" class="btn-sm" style="${_classFilter===c?'background:var(--brand);color:#fff;border-color:var(--brand);':''}">${esc(c)}</button>`).join('');
  }
  filterStudents();
}

function setClassFilter(c){ _classFilter=c; renderStudentList(); }

function filterStudents(){
  const q=($('student-search')?.value||'').toLowerCase();
  const list=$('students-list'); if(!list) return;
  let students=SD.students.filter(s=>s.status!=='withdrawn');
  if(_classFilter) students=students.filter(s=>(s.classArm||s.class)===_classFilter);
  if(q) students=students.filter(s=>(s.name||s.fullName||'').toLowerCase().includes(q));
  if(!students.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">🎓</div>No students found.</div>`; return;
  }
  list.innerHTML=students.map(s=>`
    <div class="list-item">
      <div class="info">
        <div class="name">${esc(s.name||s.fullName)}</div>
        <div class="meta">${esc(s.classArm||s.class||'')} · ${esc(s.level||'')} · ${s.gender==='M'?'♂':'♀'}</div>
        ${s.parentPhone?`<div class="meta">📱 ${esc(s.parentPhone)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
        <span class="chip chip-blue">${esc(s.classArm||s.class||'—')}</span>
        <button class="btn-danger" onclick="deleteStudent('${s.id}','${esc(s.name||s.fullName)}')">🗑</button>
      </div>
    </div>`).join('');
}

async function saveStudent(){
  const name  = $('s-name')?.value.trim();
  const cls   = $('s-class')?.value.trim();
  const level = $('s-level')?.value;
  const gender= $('s-gender')?.value;
  const phone = $('s-parent-phone')?.value.trim();
  const admNo = $('s-admission')?.value.trim();
  if(!name||!cls) return toast('Name and Class are required.');
  const d={name, classArm:cls, level, gender, parentPhone:phone, admissionNumber:admNo,
            enrolledAt:new Date(), status:'active', schoolId};
  const tempId='pending_'+Date.now();
  if(navigator.onLine && db){
    try{
      const ref=await db.collection('students').add(d);
      SD.students.push({id:ref.id,...d});
    }catch(e){ SQ.push({t:'addStudent',d}); SD.students.push({id:tempId,...d}); }
  } else { SQ.push({t:'addStudent',d}); SD.students.push({id:tempId,...d}); }
  closeModal('modal-add-student');
  $('s-name').value=''; $('s-class').value=''; $('s-parent-phone').value=''; $('s-admission').value='';
  toast(`✅ ${name} added!`);
  renderStudentList(); renderDashboard();
}

async function deleteStudent(id, name){
  if(!confirm(`Remove "${name}"? This cannot be undone.`)) return;
  if(navigator.onLine && db && !id.startsWith('pending_')){
    try{ await db.collection('students').doc(id).delete(); }
    catch(e){ SQ.push({t:'deleteStudent',id}); }
  } else if(!id.startsWith('pending_')){ SQ.push({t:'deleteStudent',id}); }
  SD.students=SD.students.filter(s=>s.id!==id);
  toast(`🗑 ${name} removed.`); renderStudentList(); renderDashboard();
}

// ── SCORES ─────────────────────────────────────────────────────
function renderScores(){
  const clsFilter=$('scores-filter-class')?.value||'';
  const subFilter=$('scores-filter-subject')?.value||'';
  const termFilter=$('scores-filter-term')?.value||'Term 1';
  const list=$('scores-list'); if(!list) return;

  // Populate filters
  const classes=[...new Set(SD.students.map(s=>s.classArm||s.class||'').filter(Boolean))].sort();
  const subjects=[...new Set(SD.scores.map(s=>s.subject||'').filter(Boolean))].sort();
  const cSel=$('scores-filter-class');
  if(cSel && cSel.options.length<=1) classes.forEach(c=>{ const o=new Option(c,c); cSel.add(o); });
  const sSel=$('scores-filter-subject');
  if(sSel && sSel.options.length<=1) subjects.forEach(s=>{ const o=new Option(s,s); sSel.add(o); });

  let scores=SD.scores.filter(s=>s.term===termFilter);
  if(clsFilter) scores=scores.filter(s=>{
    const stu=SD.students.find(x=>x.id===s.studentId);
    return (stu?.classArm||stu?.class)===clsFilter;
  });
  if(subFilter) scores=scores.filter(s=>s.subject===subFilter);

  if(!scores.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">📝</div>No scores for this filter.</div>`; return;
  }
  list.innerHTML=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Student</th><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
    <tbody>${scores.map(s=>{
      const total=(s.CA||s.ca||0)+(s.exam||0);
      const g=grade(total);
      const color=total>=50?'var(--success)':total>=40?'var(--warn)':'var(--danger)';
      return`<tr>
        <td>${esc(s.studentName||'—')}</td>
        <td>${esc(s.subject)}</td>
        <td>${s.CA||s.ca||0}</td>
        <td>${s.exam||0}</td>
        <td style="font-weight:700;color:${color};">${total}</td>
        <td><span class="chip ${total>=50?'chip-green':total>=40?'chip-yellow':'chip-red'}">${g}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function previewTotal(){
  const ca=parseInt($('sc-ca')?.value)||0;
  const ex=parseInt($('sc-exam')?.value)||0;
  const tot=ca+ex;
  const el=$('sc-total-preview');
  if(el) el.textContent=`Total: ${tot}/100 — ${grade(tot)} (${remark(tot)})`;
}

async function saveScore(){
  const sid=$('sc-student')?.value;
  const sub=$('sc-subject')?.value.trim();
  const term=$('sc-term')?.value;
  const ca=parseInt($('sc-ca')?.value)||0;
  const exam=parseInt($('sc-exam')?.value)||0;
  if(!sid||!sub) return toast('Select student and enter subject.');
  if(ca>40||exam>60) return toast('CA max 40, Exam max 60.');
  const stu=SD.students.find(s=>s.id===sid);
  const total=ca+exam;
  const d={schoolId, studentId:sid, studentName:stu?.name||stu?.fullName||'',
            classArm:stu?.classArm||stu?.class||'', subject:sub, term,
            session:schoolData?.config?.currentSession||'',
            CA:ca, exam, total, grade:grade(total), remark:remark(total),
            recordedAt:new Date()};
  try{
    if(navigator.onLine&&db){ const ref=await db.collection('scores').add(d); SD.scores.push({id:ref.id,...d}); }
    else { SQ.push({t:'addScore',d}); SD.scores.push({id:'p_'+Date.now(),...d}); }
    closeModal('modal-add-score');
    $('sc-subject').value=''; $('sc-ca').value=''; $('sc-exam').value='';
    $('sc-total-preview').textContent='';
    toast(`✅ Score saved — ${total}/100`); renderScores();
  }catch(e){ toast('Error: '+e.message); }
}

// ── FEES ───────────────────────────────────────────────────────
function renderFees(){
  populateStudentDropdown('pay-student');
  filterFees();
  const term=schoolData?.config?.currentTerm||'Term 1';
  const termPay=SD.payments.filter(p=>p.term===term);
  const total=termPay.reduce((s,p)=>s+(p.amount||0),0);
  const payers=new Set(termPay.map(p=>p.studentId)).size;
  const el=$('fees-summary');
  if(el) el.innerHTML=[
    ['₦'+fmt(total),'Collected ('+term+')','var(--money)'],
    [payers,'Students Paid','var(--brand)'],
    [SD.students.filter(s=>s.status!=='withdrawn').length-payers,'Unpaid','var(--danger)'],
  ].map(([v,l,c])=>`<div class="stat-card"><div class="stat-val" style="color:${c};">${v}</div><div class="stat-lbl">${l}</div></div>`).join('');
}

function filterFees(){
  const q=($('fees-search')?.value||'').toLowerCase();
  const list=$('fees-list'); if(!list) return;
  let pays=SD.payments.slice().sort((a,b)=>new Date(b.paymentDate||b.createdAt||0)-new Date(a.paymentDate||a.createdAt||0));
  if(q) pays=pays.filter(p=>(p.studentName||'').toLowerCase().includes(q));
  if(!pays.length){ list.innerHTML=`<div class="empty"><div class="empty-icon">💰</div>No payments recorded.</div>`; return; }
  list.innerHTML=pays.map(p=>`
    <div class="list-item">
      <div class="info">
        <div class="name">${esc(p.studentName||'—')}</div>
        <div class="meta">${esc(p.term||'')} · ${esc(p.method||'')} · ${esc(p.receivedBy||'')}</div>
        ${p.receiptNumber?`<div class="meta">🧾 ${esc(p.receiptNumber)}</div>`:''}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;color:var(--money);">₦${fmt(p.amount)}</div>
        <div style="font-size:0.7rem;color:var(--sub);">${p.paymentDate?new Date(p.paymentDate?.toDate?p.paymentDate.toDate():p.paymentDate).toLocaleDateString():''}</div>
      </div>
    </div>`).join('');
}

async function savePayment(){
  const sid=$('pay-student')?.value;
  const amount=parseFloat($('pay-amount')?.value)||0;
  const term=$('pay-term')?.value;
  const method=$('pay-method')?.value;
  const by=$('pay-received-by')?.value.trim();
  const receipt=$('pay-receipt')?.value.trim();
  if(!sid||!amount||!by) return toast('Student, amount and received-by are required.');
  const stu=SD.students.find(s=>s.id===sid);
  const d={schoolId, studentId:sid, studentName:stu?.name||stu?.fullName||'',
            classArm:stu?.classArm||stu?.class||'',
            term, session:schoolData?.config?.currentSession||'',
            amount, method, receivedBy:by, receiptNumber:receipt,
            paymentDate:new Date(), createdAt:new Date()};
  try{
    if(navigator.onLine&&db){ const ref=await db.collection('payments').add(d); SD.payments.push({id:ref.id,...d}); }
    else { SQ.push({t:'addPayment',d}); SD.payments.push({id:'p_'+Date.now(),...d}); }
    closeModal('modal-add-payment');
    $('pay-amount').value=''; $('pay-received-by').value=''; $('pay-receipt').value='';
    toast(`✅ ₦${fmt(amount)} recorded for ${stu?.name||stu?.fullName||''}`);
    renderFees();
  }catch(e){ toast('Error: '+e.message); }
}

// ── GUARANTEE ──────────────────────────────────────────────────
async function renderGuarantee(){
  populateStudentDropdown('g-student');
  const list=$('guarantee-list'); if(!list) return;
  list.innerHTML=`<div class="empty"><div class="empty-icon">⏳</div>Loading...</div>`;
  const statusF=$('g-filter-status')?.value||'';
  const termF=$('g-filter-term')?.value||'';
  try{
    let q=db.collection('exam_enrollments').where('schoolId','==',schoolId);
    if(statusF) q=q.where('status','==',statusF);
    if(termF)   q=q.where('term','==',termF);
    const snap=await q.get();
    const enrollments=snap.docs.map(d=>({id:d.id,...d.data()}));

    // Summary
    const total=enrollments.length;
    const active=enrollments.filter(e=>e.status==='active').length;
    const passed=enrollments.filter(e=>e.status==='passed').length;
    const refundDue=enrollments.filter(e=>e.status==='failed'&&e.refundEligible).length;
    const revenue=enrollments.reduce((s,e)=>s+(e.amountPaid||0),0);
    const liability=enrollments.filter(e=>e.refundEligible&&e.status!=='refunded').reduce((s,e)=>s+(e.refundAmount||0),0);
    const sumEl=$('guarantee-summary');
    if(sumEl) sumEl.innerHTML=[
      [total,'Total Enrolled','var(--brand)'],
      [active,'Active','var(--sub)'],
      [passed,'Passed ✅','var(--success)'],
      [refundDue,'Refund Due ⚠️','var(--danger)'],
      ['₦'+fmt(revenue),'Revenue','var(--money)'],
      ['₦'+fmt(liability),'Liability','var(--warn)'],
    ].map(([v,l,c])=>`<div class="stat-card"><div class="stat-val" style="color:${c};">${v}</div><div class="stat-lbl">${l}</div></div>`).join('');

    if(!enrollments.length){
      list.innerHTML=`<div class="empty"><div class="empty-icon">🏆</div>No enrollments yet. Add first above.</div>`; return;
    }
    list.innerHTML=enrollments.map(e=>{
      const sc={active:'chip-blue',passed:'chip-green',failed:'chip-red',refunded:'chip-purple'}[e.status]||'chip-blue';
      const prog=Math.min(e.completionRate||0,100);
      const progColor=prog>=80?'var(--success)':'var(--warn)';
      return`<div class="g-card" style="border-left:3px solid ${e.status==='passed'?'var(--success)':e.status==='failed'?'var(--danger)':'var(--brand)'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div>
            <div class="g-name">${esc(e.studentName)}</div>
            <div class="g-meta">${esc(e.subject)} · ${esc(e.classArm||'')} · ${esc(e.term||'')}</div>
            <div class="g-meta">Target: ${e.targetScore} · Paid: ₦${fmt(e.amountPaid)}</div>
          </div>
          <span class="chip ${sc}">${(e.status||'').toUpperCase()}</span>
        </div>
        <div class="progress-wrap" style="margin-top:8px;"><div class="progress-bar" style="width:${prog}%;background:${progColor};"></div></div>
        <div style="font-size:0.7rem;color:var(--sub);">${prog}% complete · ${e.mocksTaken||0}/3 mocks</div>
        ${e.status==='failed'&&e.refundEligible?`<div class="chip chip-red" style="margin-top:6px;display:inline-block;">⚠️ REFUND DUE — ₦${fmt(e.refundAmount)}</div>`:''}
        <div class="g-actions">
          ${e.status==='active'?`
            <button class="btn-sm" onclick="logMock('${e.id}')">📝 Log Mock</button>
            <button class="btn-sm" onclick="updateCompletion('${e.id}',${prog})">📈 Update %</button>
            <button class="btn-sm" onclick="checkGuaranteeOutcome('${e.id}')">🔄 Check Outcome</button>
          `:''}
          ${e.status==='failed'&&e.refundEligible?`<button class="btn-danger" onclick="markRefunded('${e.id}')">✅ Mark Refunded</button>`:''}
        </div>
      </div>`;
    }).join('');
  }catch(err){ list.innerHTML=`<div class="empty" style="color:var(--danger);">⚠️ Could not load. Check connection.</div>`; }
}

function prefillGuaranteeClass(){
  const sid=$('g-student')?.value;
  if(!sid||!SD.students) return;
  const s=SD.students.find(x=>x.id===sid);
  if(s&&$('g-class')) $('g-class').value=s.classArm||s.class||'';
}

async function enrollGuarantee(){
  const sid=$('g-student')?.value;
  const sub=$('g-subject')?.value.trim();
  const term=$('g-term')?.value;
  const target=parseInt($('g-target')?.value)||50;
  const amount=parseFloat($('g-amount')?.value)||0;
  if(!sid) return toast('Select a student.');
  if(!sub) return toast('Enter subject.');
  if(!amount) return toast('Enter amount paid.');
  if(!navigator.onLine) return toast('Must be online to enroll.');
  const stu=SD.students.find(s=>s.id===sid);
  if(!stu) return toast('Student not found.');
  // Duplicate check
  const existing=await db.collection('exam_enrollments')
    .where('schoolId','==',schoolId).where('studentId','==',sid)
    .where('subject','==',sub).where('term','==',term).get();
  if(!existing.empty) return toast(`${stu.name||stu.fullName} already enrolled for ${sub} this term.`);
  const d={schoolId, studentId:sid, studentName:stu.name||stu.fullName||'',
            classArm:stu.classArm||stu.class||'', subject:sub, term,
            session:schoolData?.config?.currentSession||'',
            targetScore:target, amountPaid:amount,
            refundAmount:Math.round(amount*0.7),
            status:'active', refundEligible:false,
            completionRate:0, mocksTaken:0,
            enrolledAt:new Date(), passedAt:null, refundIssuedAt:null};
  try{
    await db.collection('exam_enrollments').add(d);
    closeModal('modal-enroll-guarantee');
    $('g-subject').value=''; $('g-amount').value='';
    toast(`✅ ${stu.name||stu.fullName} enrolled for ${sub} guarantee!`);
    renderGuarantee();
  }catch(e){ toast('Error: '+e.message); }
}

async function logMock(enrollId){
  if(!confirm('Confirm student has completed a mock exam?')) return;
  try{
    const ref=db.collection('exam_enrollments').doc(enrollId);
    const doc=await ref.get(); if(!doc.exists) return;
    const current=doc.data().mocksTaken||0;
    await ref.update({mocksTaken:current+1, updatedAt:new Date()});
    toast('📝 Mock exam logged!'); renderGuarantee();
  }catch(e){ toast('Error: '+e.message); }
}

async function updateCompletion(enrollId, current){
  const val=prompt(`Current completion: ${current}%\nEnter new completion rate (0–100):`);
  if(val===null) return;
  const n=parseInt(val);
  if(isNaN(n)||n<0||n>100) return toast('Enter a number between 0 and 100.');
  try{
    await db.collection('exam_enrollments').doc(enrollId).update({completionRate:n, updatedAt:new Date()});
    toast(`📈 Completion updated to ${n}%`); renderGuarantee();
  }catch(e){ toast('Error: '+e.message); }
}

async function checkGuaranteeOutcome(enrollId){
  try{
    const ref=db.collection('exam_enrollments').doc(enrollId);
    const doc=await ref.get(); if(!doc.exists) return;
    const e=doc.data();
    const scoreSnap=await db.collection('scores')
      .where('schoolId','==',schoolId).where('studentId','==',e.studentId)
      .where('subject','==',e.subject).where('term','==',e.term).get();
    if(scoreSnap.empty) return toast(`No score recorded for ${e.subject} — ${e.term}. Record score first.`);
    const sd=scoreSnap.docs[0].data();
    const total=sd.total||((sd.CA||sd.ca||0)+(sd.exam||0));
    const passed=total>=(e.targetScore||50);
    const compMet=(e.completionRate||0)>=80;
    const mocksMet=(e.mocksTaken||0)>=3;
    const refundEligible=!passed&&compMet&&mocksMet;
    const update={status:passed?'passed':'failed', refundEligible, finalScore:total, checkedAt:new Date()};
    if(passed) update.passedAt=new Date();
    await ref.update(update);
    if(passed) toast(`🎉 ${e.studentName} PASSED ${e.subject} with ${total}/100!`);
    else if(refundEligible) toast(`⚠️ ${e.studentName} missed target. Refund of ₦${fmt(e.refundAmount)} due.`);
    else toast(`❌ Not refund-eligible: ${!compMet?`only ${e.completionRate||0}% complete`:`only ${e.mocksTaken||0} mocks taken`}`);
    renderGuarantee();
  }catch(err){ toast('Error: '+err.message); }
}

async function markRefunded(enrollId){
  if(!confirm('Confirm refund has been issued to parent?')) return;
  try{
    await db.collection('exam_enrollments').doc(enrollId).update({status:'refunded',refundIssuedAt:new Date()});
    toast('✅ Refund marked as issued.'); renderGuarantee();
  }catch(e){ toast('Error: '+e.message); }
}

// ── ATTENDANCE ──────────────────────────────────────────────────
let _attRecords={};

function openAttendanceModal(){
  const classes=[...new Set(SD.students.map(s=>s.classArm||s.class||'').filter(Boolean))].sort();
  const sel=$('att-class-select');
  if(sel){ sel.innerHTML=classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); }
  const dateEl=$('att-date');
  if(dateEl) dateEl.value=new Date().toISOString().split('T')[0];
  _attRecords={};
  loadAttendanceStudents();
  openModal('modal-take-attendance');
}

function loadAttendanceStudents(){
  const cls=$('att-class-select')?.value;
  const el=$('att-student-list'); if(!el) return;
  const students=SD.students.filter(s=>(s.classArm||s.class)===cls&&s.status!=='withdrawn');
  students.forEach(s=>{ if(!_attRecords[s.id]) _attRecords[s.id]='P'; });
  el.innerHTML=students.map(s=>`
    <div class="att-row">
      <div style="font-size:0.85rem;font-weight:500;">${esc(s.name||s.fullName)}</div>
      <div class="att-btns">
        <button class="att-btn ${_attRecords[s.id]==='P'?'P':''}" onclick="setAtt('${s.id}','P',this)">P</button>
        <button class="att-btn ${_attRecords[s.id]==='A'?'A':''}" onclick="setAtt('${s.id}','A',this)">A</button>
        <button class="att-btn ${_attRecords[s.id]==='L'?'L':''}" onclick="setAtt('${s.id}','L',this)">L</button>
      </div>
    </div>`).join('');
}

function setAtt(sid, status, btn){
  _attRecords[sid]=status;
  const row=btn.closest('.att-row');
  if(row) row.querySelectorAll('.att-btn').forEach(b=>{
    b.classList.remove('P','A','L');
    if(b.textContent===status) b.classList.add(status);
  });
}

async function saveAttendance(){
  const cls=$('att-class-select')?.value;
  const date=$('att-date')?.value;
  const term=schoolData?.config?.currentTerm||'Term 1';
  const session=schoolData?.config?.currentSession||'';
  if(!cls||!date) return toast('Select class and date.');
  if(!navigator.onLine) return toast('Must be online to save attendance.');
  const students=SD.students.filter(s=>(s.classArm||s.class)===cls&&s.status!=='withdrawn');
  const records=students.map(s=>({studentId:s.id, studentName:s.name||s.fullName||'', status:_attRecords[s.id]||'P'}));
  const d={schoolId, classArm:cls, date, term, session, records, takenBy:'Admin', createdAt:new Date()};
  try{
    await db.collection('attendance').add(d);
    closeModal('modal-take-attendance');
    toast(`✅ Attendance saved for ${cls} — ${date}`);
    renderAttendance();
  }catch(e){ toast('Error: '+e.message); }
}

async function renderAttendance(){
  // Populate class dropdown
  const classes=[...new Set(SD.students.map(s=>s.classArm||s.class||'').filter(Boolean))].sort();
  const sel=$('att-filter-class');
  if(sel && sel.options.length<=1) classes.forEach(c=>sel.add(new Option(c,c)));
  const list=$('attendance-list'); if(!list) return;
  const cls=$('att-filter-class')?.value||'';
  const date=$('att-filter-date')?.value||'';
  if(!cls&&!date){ list.innerHTML=`<div class="empty"><div class="empty-icon">📋</div>Select a class or date to view attendance.</div>`; return; }
  list.innerHTML=`<div class="empty">Loading...</div>`;
  try{
    let q=db.collection('attendance').where('schoolId','==',schoolId);
    if(cls)  q=q.where('classArm','==',cls);
    if(date) q=q.where('date','==',date);
    const snap=await q.get();
    const docs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.date<b.date?1:-1);
    if(!docs.length){ list.innerHTML=`<div class="empty"><div class="empty-icon">📋</div>No attendance records found.</div>`; return; }
    list.innerHTML=docs.map(r=>{
      const p=r.records?.filter(x=>x.status==='P').length||0;
      const a=r.records?.filter(x=>x.status==='A').length||0;
      const l=r.records?.filter(x=>x.status==='L').length||0;
      return`<div class="card" style="margin-bottom:0.7rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${esc(r.classArm)}</strong> · <span style="color:var(--sub);font-size:0.8rem;">${esc(r.date)}</span></div>
          <div style="font-size:0.78rem;display:flex;gap:8px;">
            <span style="color:var(--success);">P:${p}</span>
            <span style="color:var(--danger);">A:${a}</span>
            <span style="color:var(--warn);">L:${l}</span>
          </div>
        </div>
        <div style="margin-top:0.5rem;font-size:0.78rem;color:var(--sub);">
          ${r.records?.map(x=>`<span style="margin-right:8px;color:${x.status==='P'?'var(--success)':x.status==='A'?'var(--danger)':'var(--warn)'};">${esc(x.studentName)} (${x.status})</span>`).join('')||''}
        </div>
      </div>`;
    }).join('');
  }catch(e){ list.innerHTML=`<div class="empty" style="color:var(--danger);">⚠️ Could not load. Check connection.</div>`; }
}

// ── STAFF ──────────────────────────────────────────────────────
function renderStaff(){
  const list=$('staff-list'); if(!list) return;
  if(!SD.staff.length){ list.innerHTML=`<div class="empty"><div class="empty-icon">👥</div>No staff added yet.</div>`; return; }
  list.innerHTML=SD.staff.map(s=>`
    <div class="list-item">
      <div class="info">
        <div class="name">${esc(s.name||s.fullName)}</div>
        <div class="meta">${esc(s.role||'')}${s.subjects&&s.subjects.length?' · '+esc(Array.isArray(s.subjects)?s.subjects.join(', '):s.subjects):''}</div>
        ${s.phone?`<div class="meta">📱 ${esc(s.phone)}</div>`:''}
      </div>
      <span class="chip chip-purple">${esc(s.role||'Staff')}</span>
    </div>`).join('');
}

async function saveStaff(){
  const name=$('st-name')?.value.trim();
  const role=$('st-role')?.value;
  const phone=$('st-phone')?.value.trim();
  const subjectsRaw=$('st-subjects')?.value.trim();
  if(!name) return toast('Name is required.');
  const subjects=subjectsRaw?subjectsRaw.split(',').map(s=>s.trim()).filter(Boolean):[];
  const d={schoolId, name, role, phone, subjects, joinedAt:new Date(), status:'active'};
  try{
    if(navigator.onLine&&db){ const ref=await db.collection('staff').add(d); SD.staff.push({id:ref.id,...d}); }
    else { SQ.push({t:'addStaff',d}); SD.staff.push({id:'p_'+Date.now(),...d}); }
    closeModal('modal-add-staff');
    $('st-name').value=''; $('st-phone').value=''; $('st-subjects').value='';
    toast(`✅ ${name} added to staff.`); renderStaff();
  }catch(e){ toast('Error: '+e.message); }
}

// ── EXPENSES ───────────────────────────────────────────────────
function renderExpenses(){
  const list=$('expenses-list'); if(!list) return;
  const total=SD.expenses.reduce((s,e)=>s+(e.amount||0),0);
  const byCategory={};
  SD.expenses.forEach(e=>{ byCategory[e.category]=(byCategory[e.category]||0)+(e.amount||0); });
  const sumEl=$('expenses-summary');
  if(sumEl){
    const cats=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
    sumEl.innerHTML=`<div class="stat-card"><div class="stat-val" style="color:var(--danger);">₦${fmt(total)}</div><div class="stat-lbl">Total Expenses</div></div>`
      +cats.slice(0,3).map(([c,a])=>`<div class="stat-card"><div class="stat-val" style="font-size:1rem;color:var(--warn);">₦${fmt(a)}</div><div class="stat-lbl">${esc(c)}</div></div>`).join('');
  }
  if(!SD.expenses.length){ list.innerHTML=`<div class="empty"><div class="empty-icon">📉</div>No expenses recorded.</div>`; return; }
  const sorted=[...SD.expenses].sort((a,b)=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0));
  list.innerHTML=sorted.map(e=>`
    <div class="list-item">
      <div class="info">
        <div class="name">${esc(e.description||e.category)}</div>
        <div class="meta">${esc(e.category||'')} · ${esc(e.approvedBy||'')}</div>
      </div>
      <div style="font-weight:700;color:var(--danger);">₦${fmt(e.amount)}</div>
    </div>`).join('');
}

async function saveExpense(){
  const category=$('exp-category')?.value;
  const desc=$('exp-desc')?.value.trim();
  const amount=parseFloat($('exp-amount')?.value)||0;
  const approvedBy=$('exp-approved')?.value.trim();
  if(!desc||!amount||!approvedBy) return toast('Description, amount and approver required.');
  const d={schoolId, category, description:desc, amount, approvedBy, date:new Date(), createdAt:new Date()};
  try{
    if(navigator.onLine&&db){ const ref=await db.collection('expenses').add(d); SD.expenses.push({id:ref.id,...d}); }
    else { SQ.push({t:'addExpense',d}); SD.expenses.push({id:'p_'+Date.now(),...d}); }
    closeModal('modal-add-expense');
    $('exp-desc').value=''; $('exp-amount').value=''; $('exp-approved').value='';
    toast(`✅ Expense of ₦${fmt(amount)} recorded.`); renderExpenses(); renderDashboard();
  }catch(e){ toast('Error: '+e.message); }
}

// ── SETTINGS ───────────────────────────────────────────────────
function loadSettings(){
  const c=schoolData?.config||{};
  if($('set-school-name')) $('set-school-name').value=schoolData?.schoolName||'';
  if($('set-term')) $('set-term').value=c.currentTerm||'Term 1';
  if($('set-session')) $('set-session').value=c.currentSession||'';
}

async function saveSettings(){
  if(!navigator.onLine) return toast('Must be online to save settings.');
  const name=$('set-school-name')?.value.trim();
  const term=$('set-term')?.value;
  const session=$('set-session')?.value.trim();
  const pw=$('set-password')?.value;
  try{
    const snap=await db.collection('schools').where('schoolId','==',schoolId).limit(1).get();
    if(snap.empty) return toast('School record not found.');
    const ref=snap.docs[0].ref;
    const update={schoolName:name,'config.currentTerm':term,'config.currentSession':session};
    if(pw) update['config.password']=pw;
    await ref.update(update);
    if(schoolData){ schoolData.schoolName=name; if(schoolData.config){ schoolData.config.currentTerm=term; schoolData.config.currentSession=session; } }
    $('school-name-display').textContent=name||schoolId;
    if($('set-password')) $('set-password').value='';
    toast('✅ Settings saved!');
  }catch(e){ toast('Error: '+e.message); }
}

// ── UTILS ──────────────────────────────────────────────────────
function populateStudentDropdown(selectId){
  const sel=$(selectId); if(!sel) return;
  const current=sel.value;
  sel.innerHTML='<option value="">— Select Student —</option>'
    +[...SD.students].filter(s=>s.status!=='withdrawn')
      .sort((a,b)=>(a.name||a.fullName||'').localeCompare(b.name||b.fullName||''))
      .map(s=>`<option value="${s.id}">${esc(s.name||s.fullName)} — ${esc(s.classArm||s.class||'')}</option>`)
      .join('');
  if(current) sel.value=current;
}

// ── SERVICE WORKER ─────────────────────────────────────────────
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// ── AUTO-LOGIN on reload ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async ()=>{
  setStatus(navigator.onLine);
  const saved=localStorage.getItem('sb2_school');
  if(saved && navigator.onLine){
    $('login-id').value=saved;
  }
});
