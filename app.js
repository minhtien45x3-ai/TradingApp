import { db, doc, getDoc, setDoc, collection, getDocs, updateDoc } from './firebase.js';

// --- 1. CẤU HÌNH ---
const GEMINI_API_KEY = "AIzaSyDN0i4GycJc-_-7wNMEePkNCa185nwHh6E";
const ADMIN_LIST = ["admin", "minhtien45x3"];
const ADMIN_MASTER_PASS = "admin123"; // Pass cứu hộ khi quên mật khẩu

// --- 2. GLOBAL STATE ---
let journalData = [], wikiData = [], initialCapital = 20000;
let currentEntryImg = null, currentAnalysisImg = null, chartInst = {};
let isAdmin = false;
let currentBgTheme = 'bg-theme-default';
let currentFilter = 'all';
let currentAnalysisImageBase64 = null;
let currentAnalysisTabImg = null;
let selectedAnalysisStrategy = null;

const DEFAULT_WIKI = [{ id: "1", code: "XH01", cat: "Setup", title: "Uptrend", image: "", content: "Higher Highs" }];
const CRITERIA_LIST = [{name:"XU HƯỚNG",desc:"Cấu trúc"},{name:"CẢN",desc:"Phản ứng"},{name:"NẾN",desc:"Đảo chiều"},{name:"R:R",desc:"Tỷ lệ"}];
const ALL_THEMES = ['bg-theme-default', 'bg-theme-galaxy', 'bg-theme-emerald', 'bg-theme-midnight', 'bg-theme-sunset', 'bg-theme-aurora', 'bg-theme-nebula', 'bg-theme-oceanic', 'bg-theme-forest'];

// --- 3. INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    // Đảm bảo Landing Page hiện, Auth ẩn khi mới vào
    const landing = document.getElementById('landing-page');
    if(landing) {
        landing.classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- 4. CORE DATA LOAD ---
window.loadData = async function() {
    if (!window.currentUser) return;
    updateMarquee("🔄 Đang tải dữ liệu...");
    
    isAdmin = ADMIN_LIST.includes(window.currentUser);
    const adminBtn = document.getElementById('btn-admin-panel');
    if(adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';

    try {
        const uRef = doc(db, "users", window.currentUser);
        const uSnap = await getDoc(uRef);
        
        if (uSnap.exists()) {
            const d = uSnap.data();
            journalData = d.journal || [];
            initialCapital = d.capital || 20000;
            if(d.background) window.setBackground(d.background, false);
        } else {
            // Nếu user đăng nhập thành công nhưng chưa có data -> tạo mới
            await saveUserData();
        }

        const wRef = doc(db, "system", "wiki_master");
        const wSnap = await getDoc(wRef);
        wikiData = wSnap.exists() ? wSnap.data().items : DEFAULT_WIKI;
        
        initUI();
        updateMarquee("✅ Hệ thống sẵn sàng!");
    } catch (e) { 
        console.error(e);
        // Nếu lỗi tải data, quay về màn hình đăng nhập để không bị treo
        alert("Lỗi tải dữ liệu. Vui lòng đăng nhập lại.");
        window.authLogout();
    }
}

async function saveUserData() {
    if(!window.currentUser) return;
    await setDoc(doc(db, "users", window.currentUser), { journal: journalData, capital: initialCapital }, { merge: true });
}
async function saveWikiData() {
    if(!isAdmin) return;
    await setDoc(doc(db, "system", "wiki_master"), { items: wikiData, last_updated: new Date().toISOString() }, { merge: true });
}

function initUI() {
    renderDashboard(); renderJournalList(); populateStrategies(); renderWikiGrid();
    const cap = document.getElementById('real-init-capital');
    if(cap) cap.value = initialCapital;
    updateCapitalCalc();
    
    const btnCreate = document.querySelector('#tab-wiki button[onclick="openWikiEditor()"]');
    if(btnCreate) btnCreate.style.display = isAdmin ? 'flex' : 'none';
    lucide.createIcons();
}

// --- 5. HELPER FUNCTIONS ---
window.updateDailyPnL = function() {
    const today = new Date().toLocaleDateString('vi-VN'); 
    const pnl = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0);
    const el = document.getElementById('journal-pnl-today');
    if(el) {
        el.innerText = (pnl >= 0 ? '+' : '') + `$${pnl.toLocaleString()}`;
        el.className = `text-sm font-mono font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
    }
}

function updateMarquee(text) {
    const el = document.getElementById('dashboard-marquee');
    if(el) el.innerText = text;
}

// --- AUTH LOGIC (FIX LỖI MÀN HÌNH TRỐNG) ---
window.enterSystem = function() {
    // 1. Hiệu ứng biến mất màn hình chào
    const landing = document.getElementById('landing-page');
    landing.classList.add('fade-out-up');

    setTimeout(() => {
        // 2. Ẩn hẳn màn hình chào
        landing.classList.add('hidden'); 
        
        const u = localStorage.getItem('min_sys_current_user');
        if(u) { 
            // 3a. Nếu có user cũ -> Thử tự động đăng nhập
            document.getElementById('login-user').value = u; 
            window.authLogin(true); // Tham số true báo hiệu đây là auto-login
        } else { 
            // 3b. Nếu không -> Hiện màn hình đăng nhập ngay
            document.getElementById('auth-screen').classList.remove('hidden'); 
            document.getElementById('auth-screen').classList.add('fade-in');
        }
    }, 600); // Chờ animation xong
}

window.authLogin = async function(isAuto = false) {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    
    // Nếu auto-login mà không có pass trong ô input (thường là có nếu trình duyệt lưu, nhưng nếu không thì hiện form)
    if(!u) {
        document.getElementById('auth-screen').classList.remove('hidden');
        return;
    }

    // Nếu bấm nút đăng nhập thì bắt buộc phải có pass
    if(!isAuto && !p) return alert("Vui lòng nhập mật khẩu!");

    try {
        const snap = await getDoc(doc(db, "users", u));
        
        // 1. User chưa tồn tại trên Cloud
        if(!snap.exists()) {
            if(isAuto) {
                // Nếu tự động đăng nhập thất bại -> Hiện form để người dùng nhập lại hoặc ĐK
                console.log("Auto-login failed: User not found on Cloud");
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('auth-screen').classList.add('fade-in');
            } else {
                // Nếu người dùng bấm nút -> Báo lỗi
                // Admin Emergency Create
                if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) {
                    await setDoc(doc(db, "users", u), { 
                        username:u, password:p, email:"admin@system", status:"approved", journal:[], capital:20000 
                    });
                    alert("Đã khởi tạo Admin khẩn cấp! Đăng nhập lại ngay.");
                    window.location.reload();
                } else {
                    alert("Tài khoản chưa tồn tại. Vui lòng Đăng Ký!");
                }
            }
            return;
        }
        
        const d = snap.data();

        // 2. Kiểm tra mật khẩu (Chỉ kiểm tra nếu không phải auto-login hoặc nếu trình duyệt tự điền pass)
        // Lưu ý: Auto-login dựa vào localStorage chỉ lưu username, không lưu pass. 
        // Nên thực tế, "Auto-login" ở đây chỉ là "Auto-fill username" và hiện form. 
        // TRỪ KHI: Ta bỏ qua check pass nếu đã có session (nhưng ở đây ta làm đơn giản).
        
        // CƠ CHẾ MỚI: Nếu là Auto-login (isAuto=true), ta KHÔNG đăng nhập ngay mà chỉ hiện form đã điền sẵn user.
        // Trừ khi bạn muốn lưu cả pass vào localStorage (không bảo mật).
        // => Quyết định: Nếu enterSystem gọi, ta luôn hiện form đăng nhập để an toàn, chỉ điền sẵn user.
        
        if (isAuto) {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('auth-screen').classList.add('fade-in');
            return; // Dừng lại để người dùng nhập pass
        }

        // Check pass thường
        let isPassCorrect = (d.password === p);
        if (ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) isPassCorrect = true;

        if (!isPassCorrect) return alert("Sai mật khẩu!");

        // 3. Check status
        if(d.status === 'pending' && !ADMIN_LIST.includes(u)) return alert("Tài khoản đang chờ Admin duyệt!");
        
        // 4. Thành công
        window.currentUser = u;
        localStorage.setItem('min_sys_current_user', u);
        
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        
        window.loadData();

    } catch(e) { 
        alert("Lỗi: " + e.message);
        // Hiện form nếu lỗi
        document.getElementById('auth-screen').classList.remove('hidden');
    }
}

window.authRegister = async function() {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value.trim();
    const e = document.getElementById('reg-email').value.trim();
    if(!u || !p) return;
    try {
        const snap = await getDoc(doc(db, "users", u));
        if(snap.exists()) return alert("Tên này đã tồn tại!");
        
        const status = ADMIN_LIST.includes(u) ? 'approved' : 'pending';
        
        await setDoc(doc(db, "users", u), { username:u, password:p, email:e, status:status, journal:[], capital:20000, created_at: new Date().toISOString() });
        
        alert(status==='approved' ? "Admin ĐK thành công!" : "ĐK thành công, vui lòng chờ duyệt.");
        window.toggleAuth();
    } catch(err) { alert("Lỗi: "+err.message); }
}

window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }

// --- DASHBOARD ---
window.renderDashboard = function() {
    const closed = journalData.filter(t=>t.status!=='OPEN');
    let wins=0, pnl=0; closed.forEach(t=>{ pnl+=parseFloat(t.pnl); if(t.status==='WIN') wins++; });
    const bal = initialCapital + pnl;
    document.getElementById('dash-balance').innerText = `$${bal.toLocaleString()}`;
    document.getElementById('dash-pnl').innerText = `$${pnl.toLocaleString()}`;
    document.getElementById('header-balance').innerText = `$${bal.toLocaleString()}`;
    renderCharts(closed, initialCapital);
}
window.renderCharts = function(data, start) {
    const ctx1=document.getElementById('chart-equity');
    if(ctx1 && window.Chart) {
        let b = start; const pts = [start, ...data.map(t=>b+=parseFloat(t.pnl))];
        if(chartInst.eq) chartInst.eq.destroy();
        chartInst.eq = new Chart(ctx1, {type:'line', data:{labels:pts.map((_,i)=>i), datasets:[{data:pts, borderColor:'#10b981', fill:true, backgroundColor:'rgba(16,185,129,0.1)'}]}, options:{plugins:{legend:false}, scales:{x:{display:false}}}});
    }
}

// --- WIKI & PERMISSIONS ---
window.openWikiEditor = function(id=null) {
    if(!isAdmin) return alert("Chỉ Admin mới được sửa!");
    document.getElementById('wiki-editor-modal').classList.remove('hidden');
    if(id) { const i = wikiData.find(x=>x.id==id); if(i) { document.getElementById('edit-id').value=i.id; document.getElementById('edit-title').value=i.title; document.getElementById('edit-code').value=i.code; document.getElementById('edit-cat').value=i.cat; document.getElementById('edit-image-url').value=i.image; document.getElementById('edit-content').value=i.content; } }
    else { document.getElementById('edit-id').value=""; document.getElementById('edit-title').value=""; }
}
window.saveWiki = function() {
    if(!isAdmin) return;
    const id = document.getElementById('edit-id').value || Date.now().toString();
    const item = { id, title: document.getElementById('edit-title').value, code: document.getElementById('edit-code').value, cat: document.getElementById('edit-cat').value, image: document.getElementById('edit-image-url').value, content: document.getElementById('edit-content').value };
    const idx = wikiData.findIndex(x=>x.id==id);
    if(idx!==-1) wikiData[idx]=item; else wikiData.push(item);
    saveWikiData(); renderWikiGrid(); window.closeModal('wiki-editor-modal');
}
window.viewWikiDetail = function(id) {
    const i = wikiData.find(x=>x.id==id); if(!i) return;
    document.getElementById('view-title').innerText = i.title;
    document.getElementById('view-image').src = i.image;
    document.getElementById('view-content').innerText = i.content;
    const btnEdit = document.getElementById('btn-edit-entry');
    const btnDel = document.getElementById('btn-delete-entry');
    if(isAdmin) {
        btnEdit.style.display='inline-block'; btnDel.style.display='inline-block';
        const ne = btnEdit.cloneNode(true); const nd = btnDel.cloneNode(true);
        btnEdit.parentNode.replaceChild(ne, btnEdit); btnDel.parentNode.replaceChild(nd, btnDel);
        ne.onclick = () => { window.closeModal('wiki-detail-modal'); window.openWikiEditor(id); };
        nd.onclick = () => { if(confirm('Xóa?')) { wikiData=wikiData.filter(x=>x.id!=id); saveWikiData(); renderWikiGrid(); window.closeModal('wiki-detail-modal'); } };
    } else { btnEdit.style.display='none'; btnDel.style.display='none'; }
    document.getElementById('wiki-detail-modal').classList.remove('hidden');
}
window.renderWikiGrid = function() {
    document.getElementById('wiki-grid').innerHTML = wikiData.map(i => `
        <div class="glass-panel p-4 rounded-xl cursor-pointer" onclick="viewWikiDetail('${i.id}')">
            <div class="h-32 bg-black/20 rounded mb-2"><img src="${i.image}" class="w-full h-full object-cover"></div>
            <h4 class="font-bold">${i.title}</h4>
        </div>`).join('');
}

// --- ADMIN PANEL ---
window.openAdminPanel = async () => {
    document.getElementById('admin-modal').classList.remove('hidden');
    const tb = document.getElementById('admin-user-list');
    tb.innerHTML = 'Loading...';
    const s = await getDocs(collection(db, "users"));
    let h = '';
    s.forEach(d => {
        const u = d.data();
        if(u.status === 'pending') h += `<tr><td class="p-2">${u.username}</td><td class="p-2 text-xs">${u.email}</td><td class="p-2"><button onclick="approveUser('${u.username}')" class="bg-green-600 px-2 rounded text-xs text-white font-bold">Duyệt</button></td></tr>`;
    });
    tb.innerHTML = h || '<tr><td colspan="3" class="text-center p-4">Không có yêu cầu nào</td></tr>';
}
window.approveUser = async (u) => { if(confirm("Duyệt tài khoản "+u+"?")) { await updateDoc(doc(db,"users",u),{status:'approved'}); window.openAdminPanel(); } }

// --- AI LOGIC ---
async function callGeminiAPI(prompt, imageBase64 = null) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const parts = [{ text: prompt }]; if (imageBase64) parts.push({ inlineData: { mimeType: "image/png", data: imageBase64.split(',')[1] } });
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) }); const data = await response.json(); if (!response.ok) throw new Error("API Error"); if (!data.candidates) throw new Error("AI Empty"); return data.candidates[0].content.parts[0].text; } catch (error) { throw error; }
}
window.handleAIUpload = function(input) { if (input.files[0]) { const r = new FileReader(); r.onload = (e) => { document.getElementById('ai-preview-img').src = e.target.result; document.getElementById('ai-preview-img').classList.remove('hidden'); document.getElementById('ai-upload-placeholder').classList.add('hidden'); currentAnalysisImageBase64 = e.target.result; }; r.readAsDataURL(input.files[0]); } }
window.runAIAnalysis = async function() { if(!currentAnalysisImageBase64) return alert("Chọn ảnh!"); const btn = document.getElementById('btn-ai-analyze'); btn.innerHTML = "ĐANG XỬ LÝ..."; btn.disabled = true; const pair = document.getElementById('ai-pair-input').value; const prompt = `Phân tích ${pair}. JSON: {pattern_name, score, conclusion}`; try { const txt = await callGeminiAPI(prompt, currentAnalysisImageBase64); const json = JSON.parse(txt.replace(/```json|```/g,'').trim()); document.getElementById('ai-res-pattern').innerText = json.pattern_name; document.getElementById('ai-res-conclusion').innerHTML = marked.parse(json.conclusion); document.getElementById('ai-result-content').classList.remove('hidden'); } catch (e) { alert("Lỗi: "+e.message); } btn.innerHTML = "BẮT ĐẦU"; btn.disabled = false; }
window.resetAI = function() { document.getElementById('ai-result-content').classList.add('hidden'); document.getElementById('ai-result-empty').classList.remove('hidden'); currentAnalysisImageBase64=null; document.getElementById('ai-preview-img').classList.add('hidden'); }

// --- JOURNAL & ANALYSIS ---
window.selectAnalysisStrategy = function(id) { const item = wikiData.find(x=>x.id==id); if(item) { selectedAnalysisStrategy=item; document.getElementById('current-setup-name').innerText=item.title; document.getElementById('ana-theory-img').src=item.image; document.getElementById('ana-theory-content').innerText=item.content; document.getElementById('analysis-empty-state').classList.add('hidden'); } }
window.handleAnalysisUpload = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('ana-real-img').src=e.target.result; document.getElementById('ana-real-img').classList.remove('hidden'); document.getElementById('ana-upload-hint').classList.add('hidden'); currentAnalysisTabImg=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.transferAnalysisToJournal = function() { if(!selectedAnalysisStrategy) return alert("Chưa chọn chiến lược!"); window.switchTab('journal'); window.openEntryModal(); if(currentAnalysisTabImg) { currentEntryImgBase64=currentAnalysisTabImg; document.getElementById('entry-img-preview').src=currentAnalysisTabImg; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); } }
window.openEntryModal = function() { document.getElementById('entry-modal').classList.remove('hidden'); const now=new Date(); document.getElementById('inp-date').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().split('T')[0]; }
window.handleEntryImage = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('entry-img-preview').src=e.target.result; document.getElementById('entry-img-preview').classList.remove('hidden'); currentEntryImgBase64=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.saveEntry = function() {
    const d = document.getElementById('inp-date').value.split('-'); const dateStr = `${d[2]}/${d[1]}/${d[0]}`;
    const p = parseFloat(document.getElementById('inp-risk').value)||0;
    journalData.unshift({ id:Date.now().toString(), date:dateStr, pair: document.getElementById('inp-pair').value, pnl:0, status:'OPEN', risk:p, rr:2, strategy:'Manual', image: currentEntryImgBase64 });
    saveUserData(); renderJournalList(); renderDashboard(); window.closeModal('entry-modal');
    currentEntryImgBase64 = null;
}
window.updateEntryStatus = function(id, status) { const idx = journalData.findIndex(e => e.id.toString() === id.toString()); if(idx !== -1) { journalData[idx].status = status; const r = parseFloat(journalData[idx].risk); if(status === 'WIN') journalData[idx].pnl = r * 2; else if(status === 'LOSS') journalData[idx].pnl = -r; else journalData[idx].pnl = 0; saveUserData(); renderJournalList(); renderDashboard(); } }
window.deleteEntry = (id) => { if(confirm('Xóa?')) { journalData=journalData.filter(x=>x.id!=id); saveUserData(); renderJournalList(); renderDashboard(); } }
window.renderJournalList = function() { document.getElementById('journal-list').innerHTML = journalData.map(t=>`<tr><td class="p-3">${t.date}</td><td class="p-3">${t.pair}</td><td class="p-3 text-right">$${t.pnl}</td><td class="p-3"><button onclick="deleteEntry('${t.id}')">X</button></td></tr>`).join(''); updateDailyPnL(); }

// --- UTILS ---
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.switchTab = (id) => { document.querySelectorAll('main > div').forEach(e=>e.classList.add('hidden')); document.getElementById('tab-'+id).classList.remove('hidden'); if(id==='dashboard') renderDashboard(); };
window.initTheme = () => document.documentElement.classList.add('dark');
window.populateStrategies = () => { document.getElementById('strategy-list-container').innerHTML = wikiData.map(w=>`<div class="p-2 border-b cursor-pointer" onclick="selectAnalysisStrategy('${w.id}')">${w.title}</div>`).join(''); document.getElementById('inp-strategy').innerHTML = wikiData.map(w=>`<option value="${w.code}">${w.code} - ${w.title}</option>`).join(''); };
window.renderPairSelects = () => { const h = ["XAUUSD","BTCUSD","EURUSD","GBPUSD"].map(p=>`<option value="${p}">${p}</option>`).join(''); document.getElementById('ai-pair-input').innerHTML=h; document.getElementById('inp-pair').innerHTML=h; }
window.renderCategoryFilters = () => {}; window.filterWikiCat = () => {}; window.filterWiki = () => renderWikiGrid();
window.previewImage = (url) => { document.getElementById('edit-preview').src = url; if(url) document.getElementById('edit-preview').classList.remove('hidden'); else document.getElementById('edit-preview').classList.add('hidden'); }
window.handleImageUpload = (inp) => { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('edit-preview').src=e.target.result; document.getElementById('edit-preview').classList.remove('hidden'); document.getElementById('edit-image-url').value=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = () => {}; 
window.saveInitialCapital = () => { initialCapital = parseFloat(document.getElementById('real-init-capital').value)||20000; saveUserData(); renderDashboard(); alert("Lưu!"); };
window.updateCapitalCalc = () => {};
window.setBackground = (t) => { document.body.className=`bg-theme-default ${t}`; window.closeModal('bg-settings-modal'); saveUserData(); }
window.openBgModal = () => document.getElementById('bg-settings-modal').classList.remove('hidden');