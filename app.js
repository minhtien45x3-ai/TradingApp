import { db, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from './firebase.js';

// ... (Giữ nguyên các config ADMIN, DEFAULT_PAIRS, v.v...) ...
const ADMIN_LIST = ["admin", "minhtien45x3"];
const ADMIN_MASTER_PASS = "admin123";
let journalData = [], wikiData = [], libraryData = [], pairsData = [];
let initialCapital = 20000;
let isAdmin = false;
let currentEntryImgBase64 = null, currentAnalysisTabImg = null, currentPracticeItem = null;
let chartInst = {};
let selectedAnalysisStrategy = null;
let currentFilter = 'all';

// ... (Giữ nguyên DEFAULT_WIKI, CRITERIA_LIST, QUOTES, safeSetText, init, startMarquee) ...
const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];
const DEFAULT_WIKI = [{ id: "1", code: "XH01", cat: "Setup", title: "Uptrend", image: "", content: "Higher Highs" }];
const CRITERIA_LIST = [
    { name: "1. XU HƯỚNG", desc: "Trend Market" }, { name: "2. CẢN (KEY LEVEL)", desc: "Support/Resistance" },
    { name: "3. TRENDLINE", desc: "Break/Retest" }, { name: "4. EMA", desc: "Dynamic S/R" },
    { name: "5. HỢP LƯU", desc: "Confluence" }, { name: "6. TÍN HIỆU NẾN", desc: "Rejection/Engulfing" },
    { name: "7. MÔ HÌNH GIÁ", desc: "Pattern" }, { name: "8. FIBONACCI", desc: "Golden Zone" },
    { name: "9. THỜI GIAN", desc: "Session/Timing" }, { name: "10. TỶ LỆ R:R", desc: "Risk Reward" }
];
const QUOTES = ["Hành trình vạn dặm bắt đầu bằng một bước chân.", "Kỷ luật là cầu nối giữa mục tiêu và thành tựu."];
function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

// --- CORE INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if(typeof initTheme === 'function') initTheme();
    if(window.lucide) lucide.createIcons();
    startMarquee();
    const landing = document.getElementById('landing-page');
    if(landing) { landing.classList.remove('hidden'); document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-container').classList.add('hidden'); }
});
function startMarquee() { let idx = 0; safeSetText('dashboard-marquee', QUOTES[0]); setInterval(() => { idx = (idx + 1) % QUOTES.length; safeSetText('dashboard-marquee', QUOTES[idx]); }, 8000); }
function updateMarquee(text) { safeSetText('dashboard-marquee', text); }

// --- DATA LOAD ---
window.loadData = async function() {
    if (!window.currentUser) return;
    updateMarquee("Đang đồng bộ dữ liệu...");
    isAdmin = ADMIN_LIST.includes(window.currentUser);
    const adminBtn = document.getElementById('btn-admin-panel'); if(adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
    try {
        const uRef = doc(db, "users", window.currentUser); const uSnap = await getDoc(uRef);
        if (uSnap.exists()) { const d = uSnap.data(); journalData = d.journal || []; pairsData = d.pairs || DEFAULT_PAIRS; initialCapital = d.capital || 20000; } else { await saveUserData(); }
        const wRef = doc(db, "system", "wiki_master"); const wSnap = await getDoc(wRef); wikiData = wSnap.exists() ? wSnap.data().items : DEFAULT_WIKI;
        const lRef = doc(db, "system", "library_master"); const lSnap = await getDoc(lRef); libraryData = lSnap.exists() ? lSnap.data().items : [];
        initUI(); safeSetText('dashboard-marquee', QUOTES[0]);
    } catch (e) { alert("Lỗi tải dữ liệu: " + e.message); }
}
async function saveUserData() { if(!window.currentUser) return; await setDoc(doc(db, "users", window.currentUser), { journal: journalData, pairs: pairsData, capital: initialCapital }, { merge: true }); }
async function saveWikiData() { if(!isAdmin) return; await setDoc(doc(db, "system", "wiki_master"), { items: wikiData, last_updated: new Date().toISOString() }, { merge: true }); }
async function saveLibraryData() { if(!isAdmin) return; await setDoc(doc(db, "system", "library_master"), { items: libraryData, last_updated: new Date().toISOString() }, { merge: true }); }

function initUI() {
    renderDashboard(); renderJournalList(); populateStrategies(); renderWikiGrid(); renderLibraryGrid(); renderPairsList(); renderPairSelects();
    const cap = document.getElementById('real-init-capital'); if(cap) cap.value = initialCapital; updateCapitalCalc();
    // (Render Checklist - giữ nguyên)
    const checklistContainer = document.getElementById('ana-checklist-container');
    if(checklistContainer) { checklistContainer.innerHTML = CRITERIA_LIST.map(c => `<label class="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"><input type="checkbox" class="accent-blue-500 w-5 h-5"><div><p class="text-xs font-bold">${c.name}</p><p class="text-[10px] opacity-70">${c.desc}</p></div></label>`).join(''); }
    const btnCreate = document.querySelector('#tab-wiki button[onclick^="openWikiEditor"]'); if(btnCreate) btnCreate.style.display = isAdmin ? 'flex' : 'none';
    const btnLib = document.querySelector('#tab-library button[onclick^="openWikiEditor"]'); if(btnLib) btnLib.style.display = isAdmin ? 'flex' : 'none';
    if(window.lucide) lucide.createIcons();
    loadRandomTraining(); // Khởi động tab Rèn Luyện lần đầu
}

// --- TRAINING LOGIC (MỚI) ---
window.loadRandomTraining = function() {
    // 1. Lấy dữ liệu gộp từ Wiki và Thư viện
    let allData = [...wikiData, ...libraryData];
    
    // 2. Lọc theo chủ đề người dùng chọn
    const filterCat = document.getElementById('training-filter').value;
    if(filterCat !== 'all') {
        allData = allData.filter(item => item.cat && item.cat.includes(filterCat));
    }

    // 3. Nếu không có dữ liệu
    if(allData.length === 0) {
        document.getElementById('training-image').classList.add('hidden');
        document.getElementById('training-empty').classList.remove('hidden');
        document.getElementById('training-reveal-btn').classList.add('hidden');
        document.getElementById('training-answer-panel').classList.add('hidden');
        return;
    }

    // 4. Chọn ngẫu nhiên 1 câu
    const randomIndex = Math.floor(Math.random() * allData.length);
    currentPracticeItem = allData[randomIndex];

    // 5. Hiển thị UI (Ẩn đáp án, hiện ảnh)
    document.getElementById('training-empty').classList.add('hidden');
    const imgEl = document.getElementById('training-image');
    imgEl.src = currentPracticeItem.image;
    imgEl.classList.remove('hidden');
    
    document.getElementById('training-answer-panel').classList.add('hidden');
    document.getElementById('training-reveal-btn').classList.remove('hidden');
}

window.revealTrainingAnswer = function() {
    if(!currentPracticeItem) return;
    
    // Điền thông tin đáp án
    document.getElementById('training-title').innerText = currentPracticeItem.title;
    document.getElementById('training-code').innerText = currentPracticeItem.code;
    document.getElementById('training-content').innerText = currentPracticeItem.content;
    document.getElementById('training-cat').innerText = currentPracticeItem.cat;

    // Hiệu ứng hiện đáp án
    document.getElementById('training-reveal-btn').classList.add('hidden');
    document.getElementById('training-answer-panel').classList.remove('hidden');
}

// ... (Giữ nguyên các hàm AUTH, DASHBOARD, JOURNAL, PAIRS, MODAL khác của code cũ) ...
// (Đảm bảo copy đầy đủ các hàm authLogin, renderDashboard, renderJournalList... từ phiên bản trước)

window.enterSystem = function() { const landing = document.getElementById('landing-page'); landing.classList.add('fade-out-up'); setTimeout(() => { landing.classList.add('hidden'); const u = localStorage.getItem('min_sys_current_user'); if(u) { document.getElementById('login-user').value = u; showAuthScreen(); } else { showAuthScreen(); } }, 600); }
function showAuthScreen() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('auth-screen').classList.add('fade-in'); document.getElementById('app-container').classList.add('hidden'); }
window.authLogin = async function() { const u = document.getElementById('login-user').value.trim(); const p = document.getElementById('login-pass').value.trim(); if(!u || !p) return alert("Thiếu thông tin!"); try { const userDocRef = doc(db, "users", u); const snap = await getDoc(userDocRef); if(!snap.exists()) { if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) { await setDoc(userDocRef, { username:u, password:p, email:"admin@sys", status:"approved", journal:[], pairs:DEFAULT_PAIRS, capital:20000 }); alert("Đã tạo Admin!"); return; } return alert("Chưa có tài khoản!"); } const d = snap.data(); let passValid = (d.password === p); if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) passValid = true; if(!passValid) return alert("Sai mật khẩu!"); if(d.status === 'pending' && !ADMIN_LIST.includes(u)) return alert("Chờ duyệt!"); window.currentUser = u; localStorage.setItem('min_sys_current_user', u); document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden'); document.getElementById('app-container').classList.add('flex'); window.loadData(); } catch(e) { alert("Lỗi: " + e.message); } }
window.authRegister = async function() { const u = document.getElementById('reg-user').value.trim(); const p = document.getElementById('reg-pass').value.trim(); const e = document.getElementById('reg-email').value.trim(); if(!u || !p) return; try { const snap = await getDoc(doc(db, "users", u)); if(snap.exists()) return alert("Tên tồn tại!"); await setDoc(doc(db, "users", u), { username:u, password:p, email:e, status: ADMIN_LIST.includes(u) ? 'approved':'pending', journal:[], pairs:DEFAULT_PAIRS, capital:20000, created_at:new Date().toISOString() }); alert("Đăng ký thành công!"); window.toggleAuth(); } catch(e) { alert("Lỗi: "+e.message); } }
window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }
window.renderDashboard = function() { if(!journalData) return; const closed = journalData.filter(t=>t.status!=='OPEN'); let wins=0, pnl=0, maxDD=0, peak=initialCapital, bal=initialCapital, monthStats = {}, patternStats = {}; closed.forEach(t=>{ const v = parseFloat(t.pnl); pnl+=v; bal+=v; if(t.status==='WIN') wins++; if(bal > peak) peak = bal; const dd = peak > 0 ? (peak - bal)/peak : 0; if(dd > maxDD) maxDD = dd; const parts = t.date.split('/'); if(parts.length === 3) { const mKey = `${parts[1]}/${parts[2]}`; if(!monthStats[mKey]) monthStats[mKey] = {total:0, win:0, loss:0, pnl:0}; monthStats[mKey].total++; monthStats[mKey].pnl += v; if(t.status==='WIN') monthStats[mKey].win++; else if(t.status==='LOSS') monthStats[mKey].loss++; } const strat = t.strategy || "Unknown"; if(!patternStats[strat]) patternStats[strat] = {pnl:0, win:0, total:0}; patternStats[strat].pnl += v; patternStats[strat].total++; if(t.status==='WIN') patternStats[strat].win++; }); safeSetText('dash-balance', `$${bal.toLocaleString()}`); safeSetText('dash-pnl', `$${pnl.toLocaleString()}`); safeSetText('dash-winrate', `${closed.length ? Math.round((wins/closed.length)*100) : 0}%`); safeSetText('dash-dd', `${(maxDD*100).toFixed(2)}%`); const mBody = document.getElementById('stats-monthly-body'); if(mBody) mBody.innerHTML = Object.entries(monthStats).sort((a,b) => { const [m1, y1] = a[0].split('/'); const [m2, y2] = b[0].split('/'); return new Date(y2, m2) - new Date(y1, m1); }).map(([k,v]) => `<tr class="border-b dark:border-slate-800"><td class="p-3 font-bold text-slate-500">${k}</td><td class="p-3 text-center">${v.total}</td><td class="p-3 text-center text-green-500 font-bold">${v.win}</td><td class="p-3 text-center text-red-500 font-bold">${v.loss}</td><td class="p-3 text-right font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="5" class="p-4 text-center text-slate-500">Trống</td></tr>'; const pBody = document.getElementById('stats-pattern-body'); if(pBody) pBody.innerHTML = Object.entries(patternStats).sort((a,b) => b[1].pnl - a[1].pnl).map(([k,v], i) => `<div class="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-lg"><div class="flex items-center gap-3"><span class="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i===0?'bg-yellow-500 text-black':'bg-slate-300 text-slate-600'}">${i+1}</span><div><p class="text-sm font-bold truncate w-32">${k}</p><p class="text-[10px] text-slate-500">${v.win}/${v.total} wins</p></div></div><span class="font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</span></div>`).join('') || '<div class="text-center text-slate-500">Trống</div>'; renderCharts(closed, initialCapital); }
window.renderCharts = function(data, start) { const ctx1=document.getElementById('chart-equity'); const ctx2=document.getElementById('chart-winloss'); if(chartInst.eq) { chartInst.eq.destroy(); chartInst.eq = null; } if(chartInst.wl) { chartInst.wl.destroy(); chartInst.wl = null; } if(ctx1 && window.Chart) { let b = start; const pts = [start, ...data.map(t=>b+=parseFloat(t.pnl))]; chartInst.eq = new Chart(ctx1, {type:'line', data:{labels:pts.map((_,i)=>i), datasets:[{data:pts, borderColor:'#10b981', fill:true, backgroundColor:'rgba(16,185,129,0.1)', tension:0.4}]}, options:{plugins:{legend:false}, scales:{x:{display:false}, y:{grid:{color:'rgba(255,255,255,0.05)'}}}}}); } if(ctx2 && window.Chart) { let w=0, l=0; data.forEach(t=>t.status==='WIN'?w++:l++); chartInst.wl = new Chart(ctx2, {type:'doughnut', data:{labels:['Win','Loss'], datasets:[{data:[w,l], backgroundColor:['#10b981','#ef4444'], borderWidth:0}]}, options:{cutout:'70%', plugins:{legend:{position:'right', labels:{color:'#94a3b8'}}}}}); } }
window.openWikiEditor = function(id = null, mode = 'wiki') { if (!isAdmin) return alert("Chỉ Admin!"); document.getElementById('wiki-editor-modal').classList.remove('hidden'); document.getElementById('edit-mode').value = mode; document.getElementById('wiki-editor-title').innerText = mode === 'wiki' ? "Editor: Setup" : "Editor: Thư Viện"; const dataSource = mode === 'wiki' ? wikiData : libraryData; const cats = [...new Set(dataSource.map(i => i.cat))]; const dl = document.getElementById('cat-suggestions'); if(dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join(''); const imgPreview = document.getElementById('wiki-image-preview'); const uploadHint = document.getElementById('wiki-upload-hint'); const imgInput = document.getElementById('edit-image-url'); if (id) { const i = dataSource.find(x => x.id == id); if (i) { document.getElementById('edit-id').value = i.id; document.getElementById('edit-title').value = i.title; document.getElementById('edit-code').value = i.code; document.getElementById('edit-cat').value = i.cat; document.getElementById('edit-content').value = i.content; imgInput.value = i.image || ""; if (i.image) { imgPreview.src = i.image; imgPreview.classList.remove('hidden'); if(uploadHint) uploadHint.classList.add('hidden'); } else { imgPreview.classList.add('hidden'); if(uploadHint) uploadHint.classList.remove('hidden'); } } } else { document.getElementById('edit-id').value = ""; document.getElementById('edit-title').value = ""; document.getElementById('edit-code').value = ""; document.getElementById('edit-cat').value = ""; document.getElementById('edit-content').value = ""; imgInput.value = ""; imgPreview.src = ""; imgPreview.classList.add('hidden'); if(uploadHint) uploadHint.classList.remove('hidden'); } }
window.handleWikiImageUpload = function(input) { if (input.files[0]) { const r = new FileReader(); r.onload = (e) => { document.getElementById('wiki-image-preview').src = e.target.result; document.getElementById('wiki-image-preview').classList.remove('hidden'); document.getElementById('edit-image-url').value = e.target.result; document.getElementById('wiki-upload-hint').classList.add('hidden'); }; r.readAsDataURL(input.files[0]); } }
window.saveWiki = function() { if (!isAdmin) return; const id = document.getElementById('edit-id').value || Date.now().toString(); const mode = document.getElementById('edit-mode').value; const item = { id, title: document.getElementById('edit-title').value, code: document.getElementById('edit-code').value, cat: document.getElementById('edit-cat').value, image: document.getElementById('edit-image-url').value, content: document.getElementById('edit-content').value }; if (!item.code || !item.title) return alert("Nhập đủ thông tin!"); if (mode === 'wiki') { const idx = wikiData.findIndex(x => x.id == id); if (idx !== -1) wikiData[idx] = item; else wikiData.push(item); saveWikiData(); renderWikiGrid(); populateStrategies(); } else { const idx = libraryData.findIndex(x => x.id == id); if (idx !== -1) libraryData[idx] = item; else libraryData.push(item); saveLibraryData(); renderLibraryGrid(); } window.closeModal('wiki-editor-modal'); }
window.renderWikiGrid = function() { document.getElementById('wiki-grid').innerHTML = wikiData.map(i => `<div class="glass-panel p-4 cursor-pointer hover:bg-white/5" onclick="viewWikiDetail('${i.id}', 'wiki')"><div class="h-32 bg-black/20 rounded-lg mb-3 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><h4 class="font-bold text-sm truncate">${i.title}</h4><span class="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 mt-1 inline-block">${i.code}</span></div>`).join(''); }
window.renderLibraryGrid = function() { document.getElementById('library-grid').innerHTML = libraryData.map(i => `<div class="glass-panel p-4 cursor-pointer hover:bg-white/5 border border-blue-500/20" onclick="viewWikiDetail('${i.id}', 'library')"><div class="h-32 bg-black/20 rounded-lg mb-3 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><h4 class="font-bold text-sm truncate text-blue-200">${i.title}</h4><span class="text-[10px] bg-blue-900/50 px-2 py-1 rounded text-blue-300 mt-1 inline-block">${i.cat}</span></div>`).join(''); }
window.viewWikiDetail = function(id, mode = 'wiki') { const dataSource = mode === 'wiki' ? wikiData : libraryData; const i = dataSource.find(x => x.id == id); if(!i) return; document.getElementById('view-title').innerText = i.title; document.getElementById('view-image').src = i.image; document.getElementById('view-content').innerText = i.content; const btnEdit = document.getElementById('btn-edit-entry'); const btnDel = document.getElementById('btn-delete-entry'); if(isAdmin) { btnEdit.style.display='inline-block'; btnDel.style.display='inline-block'; const ne = btnEdit.cloneNode(true); const nd = btnDel.cloneNode(true); btnEdit.parentNode.replaceChild(ne, btnEdit); btnDel.parentNode.replaceChild(nd, btnDel); ne.onclick = () => { window.closeModal('wiki-detail-modal'); window.openWikiEditor(id, mode); }; nd.onclick = () => { if(confirm("Xóa?")) { if(mode==='wiki') { wikiData=wikiData.filter(x=>x.id!=id); saveWikiData(); renderWikiGrid(); } else { libraryData=libraryData.filter(x=>x.id!=id); saveLibraryData(); renderLibraryGrid(); } window.closeModal('wiki-detail-modal'); } }; } else { btnEdit.style.display='none'; btnDel.style.display='none'; } document.getElementById('wiki-detail-modal').classList.remove('hidden'); }
window.openAdminPanel = async () => { document.getElementById('admin-modal').classList.remove('hidden'); const tb = document.getElementById('admin-user-list'); tb.innerHTML = 'Loading...'; const s = await getDocs(collection(db, "users")); let h = ''; s.forEach(d => { const u = d.data(); const delBtn = u.username===window.currentUser ? '' : `<button onclick="deleteUser('${u.username}')" class="text-red-500 ml-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`; const appBtn = u.status==='pending' ? `<button onclick="approveUser('${u.username}')" class="bg-green-600 px-2 py-1 rounded text-xs">Duyệt</button>` : `<span class="text-green-500 text-xs">Duyệt</span>`; h += `<tr><td class="p-3">${u.username}</td><td class="p-3 text-right">${appBtn} ${delBtn}</td></tr>`; }); tb.innerHTML = h || 'Trống'; if(window.lucide) lucide.createIcons(); }
window.approveUser = async (u) => { if(confirm("Duyệt?")) { await updateDoc(doc(db,"users",u),{status:'approved'}); window.openAdminPanel(); } }
window.deleteUser = async (u) => { if(confirm("Xóa vĩnh viễn?")) { await deleteDoc(doc(db,"users",u)); window.openAdminPanel(); } }
window.selectAnalysisStrategy = function(id) { const item = wikiData.find(x=>x.id==id); if(item) { selectedAnalysisStrategy=item; document.getElementById('current-setup-name').innerText=item.title; document.getElementById('ana-theory-img').src=item.image; document.getElementById('ana-theory-content').innerText=item.content; document.getElementById('analysis-empty-state').classList.add('hidden'); } }
window.handleAnalysisUpload = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('ana-real-img').src=e.target.result; document.getElementById('ana-real-img').classList.remove('hidden'); document.getElementById('ana-upload-hint').classList.add('hidden'); currentAnalysisTabImg=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.transferAnalysisToJournal = function() { if(!selectedAnalysisStrategy) return alert("Chọn Setup trước!"); window.switchTab('journal'); window.openEntryModal(); if(currentAnalysisTabImg) { currentEntryImgBase64=currentAnalysisTabImg; document.getElementById('entry-img-preview').src=currentAnalysisTabImg; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); } }
window.openEntryModal = function() { document.getElementById('entry-modal').classList.remove('hidden'); const now=new Date(); document.getElementById('inp-date').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().split('T')[0]; if(!currentEntryImgBase64) { document.getElementById('entry-img-preview').classList.add('hidden'); document.getElementById('entry-upload-hint').classList.remove('hidden'); } calcRiskPreview(); }
window.handleEntryImage = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('entry-img-preview').src=e.target.result; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); currentEntryImgBase64=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.saveEntry = function() { const d = document.getElementById('inp-date').value.split('-'); const dateStr = `${d[2]}/${d[1]}/${d[0]}`; const p = parseFloat(document.getElementById('inp-risk').value)||0; const mode = document.getElementById('inp-risk-mode').value; const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,''); const curBal = parseFloat(curBalText) || initialCapital; const riskUSD = mode === '%' ? curBal * (p/100) : p; journalData.unshift({ id:Date.now().toString(), date:dateStr, pair: document.getElementById('inp-pair').value, dir: document.getElementById('inp-dir').value, strategy: document.getElementById('inp-strategy').value, session: document.getElementById('inp-session').value, risk: riskUSD.toFixed(2), rr: document.getElementById('inp-rr').value, status:'OPEN', pnl:0, note: document.getElementById('inp-note').value, image: currentEntryImgBase64 }); saveUserData(); renderJournalList(); renderDashboard(); window.closeModal('entry-modal'); currentEntryImgBase64 = null; }
window.deleteEntry = (id) => { if(confirm('Xóa?')) { journalData=journalData.filter(x=>x.id!=id); saveUserData(); renderJournalList(); renderDashboard(); } }
window.renderPairsList = function() { const el = document.getElementById('pairs-list-container'); if(el) el.innerHTML = pairsData.map(p => `<div class="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold">${p} <button onclick="removePair('${p}')" class="text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button></div>`).join(''); if(window.lucide) lucide.createIcons(); }
window.addNewPair = function() { const el = document.getElementById('new-pair-input'); const val = el.value.trim().toUpperCase(); if(val && !pairsData.includes(val)) { pairsData.push(val); saveUserData(); renderPairsList(); renderPairSelects(); } el.value = ""; }
window.removePair = function(val) { if(confirm('Xóa?')) { pairsData = pairsData.filter(p => p !== val); saveUserData(); renderPairsList(); renderPairSelects(); } }
window.renderPairSelects = function() { const h = pairsData.map(p=>`<option value="${p}">${p}</option>`).join(''); const aiSel = document.getElementById('ai-pair-input'); const inpSel = document.getElementById('inp-pair'); if(aiSel) aiSel.innerHTML=h; if(inpSel) inpSel.innerHTML=h; }
window.updateDailyPnL = function() { const today = new Date().toLocaleDateString('vi-VN'); const pnl = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0); safeSetText('journal-pnl-today', (pnl >= 0 ? '+' : '') + `$${pnl.toLocaleString()}`); }
window.renderJournalList = function() { const list = document.getElementById('journal-list'); if (!list) return; list.innerHTML = journalData.map(t => `<tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"><td class="p-4"><div class="font-bold text-slate-600 dark:text-slate-300 text-xs">${t.date}</div><div class="text-[10px] uppercase text-slate-400 font-bold tracking-wider">${t.session || 'SESSION'}</div></td><td class="p-4 font-bold text-sm"><span class="${t.dir === 'BUY' ? 'text-green-500' : 'text-red-500'}">${t.dir}</span> <span class="text-slate-800 dark:text-slate-200">${t.pair}</span></td><td class="p-4 text-center">${t.image ? `<div class="w-10 h-10 rounded-lg overflow-hidden mx-auto border border-slate-200 dark:border-slate-700 cursor-zoom-in hover:scale-110 transition shadow-sm" onclick="viewImageFull('${t.image}')"><img src="${t.image}" class="w-full h-full object-cover"></div>` : '<span class="text-slate-300 text-xs">-</span>'}</td><td class="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">${t.strategy}</td><td class="p-4 text-center text-xs font-mono text-slate-500">1:${t.rr}</td><td class="p-4 text-center"><select onchange="updateEntryStatus('${t.id}', this.value)" class="bg-transparent text-xs font-bold outline-none cursor-pointer text-center border border-slate-200 dark:border-slate-700 rounded py-1 px-2 shadow-sm focus:border-blue-500 transition ${t.status === 'WIN' ? 'text-green-500' : t.status === 'LOSS' ? 'text-red-500' : 'text-blue-500'}"><option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''} class="text-blue-500 bg-white dark:bg-slate-900">OPEN</option><option value="WIN" ${t.status === 'WIN' ? 'selected' : ''} class="text-green-500 bg-white dark:bg-slate-900">WIN</option><option value="LOSS" ${t.status === 'LOSS' ? 'selected' : ''} class="text-red-500 bg-white dark:bg-slate-900">LOSS</option></select></td><td class="p-4 text-right font-mono font-bold ${parseFloat(t.pnl) > 0 ? 'text-green-500' : parseFloat(t.pnl) < 0 ? 'text-red-500' : 'text-slate-400'}">${parseFloat(t.pnl) > 0 ? '+' : ''}${parseFloat(t.pnl).toLocaleString()}</td><td class="p-4 text-center"><button onclick="deleteEntry('${t.id}')" class="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`).join(''); updateDailyPnL(); if(window.lucide) lucide.createIcons(); }
window.updateEntryStatus = function(id, status) { const idx = journalData.findIndex(e => e.id.toString() === id.toString()); if(idx !== -1) { journalData[idx].status = status; const r = parseFloat(journalData[idx].risk); const rr = parseFloat(journalData[idx].rr); if(status === 'WIN') journalData[idx].pnl = r * rr; else if(status === 'LOSS') journalData[idx].pnl = -r; else journalData[idx].pnl = 0; saveUserData(); renderJournalList(); renderDashboard(); } }
window.populateStrategies = () => { document.getElementById('strategy-list-container').innerHTML = wikiData.map(w=>`<div class="p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800" onclick="selectAnalysisStrategy('${w.id}')"><p class="font-bold text-sm">${w.code}</p><p class="text-xs opacity-70 truncate">${w.title}</p></div>`).join(''); document.getElementById('inp-strategy').innerHTML = wikiData.map(w=>`<option value="${w.code}">${w.code} - ${w.title}</option>`).join(''); };
window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = () => { const v=parseFloat(document.getElementById('inp-risk').value)||0; const mode=document.getElementById('inp-risk-mode').value; const rr=parseFloat(document.getElementById('inp-rr').value)||0; const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,''); const curBal = parseFloat(curBalText) || initialCapital; const r = mode==='%'? curBal*(v/100) : v; }
window.saveInitialCapital = () => { initialCapital = parseFloat(document.getElementById('real-init-capital').value)||20000; saveUserData(); renderDashboard(); alert("Đã lưu!"); };
window.updateCapitalCalc = () => { const start = parseFloat(document.getElementById('cap-sim-start').value)||0; const pct = parseFloat(document.getElementById('cap-risk-pct').value)||1; const rr = parseFloat(document.getElementById('cap-rr').value)||2; const n = 20; let bal = start, html = ''; for(let i=1; i<=n; i++) { const risk = bal*(pct/100); const profit = risk*rr; const end = bal+profit; html += `<tr class="border-b border-slate-200 dark:border-slate-800"><td class="p-2 text-center">${i}</td><td class="p-2 text-right">$${Math.round(bal).toLocaleString()}</td><td class="p-2 text-right text-rose-500 text-xs">-$${Math.round(risk).toLocaleString()}</td><td class="p-2 text-right text-emerald-500 font-bold">+$${Math.round(profit).toLocaleString()}</td><td class="p-3 text-right font-bold">$${Math.round(end).toLocaleString()}</td></tr>`; bal = end; } document.getElementById('cap-projection-list').innerHTML = html; }
window.openBgModal = () => alert("Chế độ iOS Glass được bật mặc định!");
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.switchTab = (id) => { document.querySelectorAll('main > div').forEach(e=>e.classList.add('hidden')); document.getElementById('tab-'+id).classList.remove('hidden'); if(id==='dashboard') renderDashboard(); };
window.initTheme = () => { if(localStorage.theme==='dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }
window.toggleTheme = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; renderCharts(journalData.filter(t=>t.status!=='OPEN'), initialCapital); }