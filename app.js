import { db, doc, getDoc, setDoc, collection, getDocs, updateDoc } from './firebase.js';

// --- CONFIG ---
const GEMINI_API_KEY = "AIzaSyDN0i4GycJc-_-7wNMEePkNCa185nwHh6E";
const ADMIN_LIST = ["admin", "minhtien45x3"];
const ADMIN_MASTER_PASS = "admin123";

// Quotes Array
const QUOTES = [
    "Hành trình vạn dặm bắt đầu bằng một bước chân. - Lão Tử",
    "Đừng bao giờ bỏ trứng vào cùng một giỏ. - Warren Buffett",
    "Hãy tham lam khi người khác sợ hãi, và hãy sợ hãi khi người khác tham lam.",
    "Trong trading, đúng sai không quan trọng, quan trọng là kiếm bao nhiêu khi đúng và mất bao nhiêu khi sai. - George Soros",
    "Kỷ luật là cầu nối giữa mục tiêu và thành tựu.",
    "Thị trường chuyển tiền từ kẻ thiếu kiên nhẫn sang kẻ kiên nhẫn."
];

// Default Data
const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];
const DEFAULT_WIKI = [{ id: "1", code: "XH01", cat: "Setup", title: "Uptrend", image: "", content: "Higher Highs" }];
const CRITERIA_LIST = [
    { name: "1. XU HƯỚNG", desc: "Trend Market" }, { name: "2. CẢN (KEY LEVEL)", desc: "Support/Resistance" },
    { name: "3. TRENDLINE", desc: "Break/Retest" }, { name: "4. EMA", desc: "Dynamic S/R" },
    { name: "5. HỢP LƯU", desc: "Confluence" }, { name: "6. TÍN HIỆU NẾN", desc: "Rejection/Engulfing" },
    { name: "7. MÔ HÌNH GIÁ", desc: "Pattern" }, { name: "8. FIBONACCI", desc: "Golden Zone" },
    { name: "9. THỜI GIAN", desc: "Session/Timing" }, { name: "10. TỶ LỆ R:R", desc: "Risk Reward" }
];

// State
let journalData = [], wikiData = [], pairsData = [];
let initialCapital = 20000;
let isAdmin = false;
let currentEntryImgBase64 = null, currentAnalysisTabImg = null, currentAnalysisImageBase64 = null;
let chartInst = {};
let selectedAnalysisStrategy = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    startMarquee();
    
    // Auth Check
    const landing = document.getElementById('landing-page');
    if(landing) {
        landing.classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
    }
});

function startMarquee() {
    let idx = 0;
    const el = document.getElementById('dashboard-marquee');
    if(el) {
        // Set ngay câu đầu tiên
        el.innerText = QUOTES[0];
        setInterval(() => {
            idx = (idx + 1) % QUOTES.length;
            el.innerText = QUOTES[idx];
        }, 8000); 
    }
}

// --- DATA LOAD ---
window.loadData = async function() {
    if (!window.currentUser) return;
    document.getElementById('dashboard-marquee').innerText = "Đang đồng bộ dữ liệu...";
    
    isAdmin = ADMIN_LIST.includes(window.currentUser);
    const adminBtn = document.getElementById('btn-admin-panel');
    if(adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';

    try {
        const uRef = doc(db, "users", window.currentUser);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
            const d = uSnap.data();
            journalData = d.journal || [];
            pairsData = d.pairs || DEFAULT_PAIRS;
            initialCapital = d.capital || 20000;
        } else { await saveUserData(); }

        const wRef = doc(db, "system", "wiki_master");
        const wSnap = await getDoc(wRef);
        wikiData = wSnap.exists() ? wSnap.data().items : DEFAULT_WIKI;
        
        initUI();
        document.getElementById('dashboard-marquee').innerText = QUOTES[0];
    } catch (e) { alert("Lỗi tải: " + e.message); window.authLogout(); }
}

async function saveUserData() {
    if(!window.currentUser) return;
    await setDoc(doc(db, "users", window.currentUser), { journal: journalData, pairs: pairsData, capital: initialCapital }, { merge: true });
}
async function saveWikiData() {
    if(!isAdmin) return;
    await setDoc(doc(db, "system", "wiki_master"), { items: wikiData, last_updated: new Date().toISOString() }, { merge: true });
}

function initUI() {
    renderDashboard(); renderJournalList(); populateStrategies(); renderWikiGrid();
    renderPairsList(); renderPairSelects();
    const cap = document.getElementById('real-init-capital'); if(cap) cap.value = initialCapital;
    updateCapitalCalc();
    
    // Checklist
    document.getElementById('ana-checklist-container').innerHTML = CRITERIA_LIST.map(c => `
        <label class="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">
            <input type="checkbox" class="accent-blue-500 w-5 h-5">
            <div><p class="text-xs font-bold">${c.name}</p><p class="text-[10px] opacity-70">${c.desc}</p></div>
        </label>`).join('');

    // Wiki Permission
    const btnCreate = document.querySelector('#tab-wiki button[onclick="openWikiEditor()"]');
    if(btnCreate) btnCreate.style.display = isAdmin ? 'flex' : 'none';
    lucide.createIcons();
}

// --- AUTH ---
window.enterSystem = function() {
    document.getElementById('landing-page').classList.add('fade-out-up');
    setTimeout(() => {
        document.getElementById('landing-page').classList.add('hidden');
        const u = localStorage.getItem('min_sys_current_user');
        if(u) { document.getElementById('login-user').value = u; window.authLogin(true); }
        else { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('auth-screen').classList.add('fade-in'); }
    }, 600);
}
window.authLogin = async function(isAuto=false) {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(isAuto) { if(!u) return; } else { if(!u || !p) return alert("Thiếu thông tin"); }

    try {
        const snap = await getDoc(doc(db, "users", u));
        if(!snap.exists()) {
            if(isAuto) { document.getElementById('auth-screen').classList.remove('hidden'); return; }
            if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) {
                await setDoc(doc(db, "users", u), { username:u, password:p, email:"admin@sys", status:"approved", journal:[], pairs:DEFAULT_PAIRS, capital:20000 });
                alert("Đã khởi tạo Admin!");
            } else return alert("Chưa đăng ký!");
        }
        
        const d = snap.data();
        if(!isAuto && d.password !== p && !(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS)) return alert("Sai mật khẩu");
        if(d.status === 'pending' && !ADMIN_LIST.includes(u)) return alert("Chờ duyệt!");

        window.currentUser = u; localStorage.setItem('min_sys_current_user', u);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        window.loadData();
    } catch(e) { document.getElementById('auth-screen').classList.remove('hidden'); }
}
window.authRegister = async function() {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value.trim();
    const e = document.getElementById('reg-email').value.trim();
    if(!u || !p) return;
    try {
        const snap = await getDoc(doc(db, "users", u));
        if(snap.exists()) return alert("Tồn tại!");
        const status = ADMIN_LIST.includes(u) ? 'approved' : 'pending';
        await setDoc(doc(db, "users", u), { username:u, password:p, email:e, status, journal:[], pairs:DEFAULT_PAIRS, capital:20000, created_at:new Date().toISOString() });
        alert(status==='approved'?"Admin OK":"Chờ duyệt"); window.toggleAuth();
    } catch(e) { alert("Lỗi: "+e.message); }
}
window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }

// --- DASHBOARD & ADVANCED STATS ---
window.renderDashboard = function() {
    const closed = journalData.filter(t => t.status !== 'OPEN').sort((a,b) => a.id - b.id);
    let wins=0, pnl=0, maxDD=0, peak=initialCapital, bal=initialCapital;
    
    // Stats aggregators
    let monthStats = {}; // "MM/YYYY" -> {total, win, loss, pnl}
    let patternStats = {}; // "Setup Name" -> {pnl, win, total}

    closed.forEach(t=>{ 
        const v = parseFloat(t.pnl); pnl+=v; bal+=v;
        if(t.status==='WIN') wins++;
        
        // Drawdown
        if(bal > peak) peak = bal;
        const dd = peak > 0 ? (peak - bal)/peak : 0;
        if(dd > maxDD) maxDD = dd;

        // Monthly Stats
        const parts = t.date.split('/'); // DD/MM/YYYY
        if(parts.length === 3) {
            const mKey = `${parts[1]}/${parts[2]}`;
            if(!monthStats[mKey]) monthStats[mKey] = {total:0, win:0, loss:0, pnl:0};
            monthStats[mKey].total++;
            monthStats[mKey].pnl += v;
            if(t.status==='WIN') monthStats[mKey].win++;
            if(t.status==='LOSS') monthStats[mKey].loss++;
        }

        // Pattern Stats
        const strat = t.strategy || "Unknown";
        if(!patternStats[strat]) patternStats[strat] = {pnl:0, win:0, total:0};
        patternStats[strat].pnl += v;
        patternStats[strat].total++;
        if(t.status==='WIN') patternStats[strat].win++;
    });

    const wr = closed.length ? Math.round((wins/closed.length)*100) : 0;
    
    // Update Main Cards
    document.getElementById('dash-balance').innerText = `$${bal.toLocaleString()}`;
    document.getElementById('dash-pnl').innerText = `$${pnl.toLocaleString()}`;
    document.getElementById('dash-winrate').innerText = `${wr}%`;
    document.getElementById('dash-dd').innerText = `${(maxDD*100).toFixed(2)}%`;
    document.getElementById('header-balance').innerText = `$${bal.toLocaleString()}`;

    // Render Monthly Table
    const mBody = document.getElementById('stats-monthly-body');
    if(mBody) {
        mBody.innerHTML = Object.entries(monthStats).sort((a,b) => {
            const [m1, y1] = a[0].split('/'); const [m2, y2] = b[0].split('/');
            return new Date(y2, m2) - new Date(y1, m1); // Sort newest first
        }).map(([k,v]) => `
            <tr class="border-b dark:border-slate-800">
                <td class="p-3 font-bold text-slate-500">${k}</td>
                <td class="p-3 text-center">${v.total}</td>
                <td class="p-3 text-center text-green-500 font-bold">${v.win}</td>
                <td class="p-3 text-center text-red-500 font-bold">${v.loss}</td>
                <td class="p-3 text-right font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="p-4 text-center text-slate-500">Chưa có dữ liệu</td></tr>';
    }

    // Render Pattern Rankings
    const pBody = document.getElementById('stats-pattern-body');
    if(pBody) {
        const sortedPatterns = Object.entries(patternStats).sort((a,b) => b[1].pnl - a[1].pnl);
        pBody.innerHTML = sortedPatterns.map(([k,v], i) => `
            <div class="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i===0?'bg-yellow-500 text-black':'bg-slate-300 text-slate-600'}">${i+1}</span>
                    <div><p class="text-sm font-bold truncate w-32">${k}</p><p class="text-[10px] text-slate-500">${v.win}/${v.total} wins</p></div>
                </div>
                <span class="font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</span>
            </div>`).join('') || '<div class="text-center text-slate-500 py-4">Chưa có dữ liệu</div>';
    }

    renderCharts(closed, initialCapital);
}

window.renderCharts = function(data, start) {
    const ctx1=document.getElementById('chart-equity');
    const ctx2=document.getElementById('chart-winloss');
    if(ctx1 && window.Chart) {
        let b = start; const pts = [start, ...data.map(t=>b+=parseFloat(t.pnl))];
        if(chartInst.eq) chartInst.eq.destroy();
        chartInst.eq = new Chart(ctx1, {type:'line', data:{labels:pts.map((_,i)=>i), datasets:[{data:pts, borderColor:'#10b981', fill:true, backgroundColor:'rgba(16,185,129,0.1)', tension:0.4}]}, options:{plugins:{legend:false}, scales:{x:{display:false}, y:{grid:{color:'rgba(255,255,255,0.05)'}}}}});
    }
    if(ctx2 && window.Chart) {
        let w=0, l=0; data.forEach(t=>t.status==='WIN'?w++:l++);
        if(chartInst.wl) chartInst.wl.destroy();
        chartInst.wl = new Chart(ctx2, {type:'doughnut', data:{labels:['Win','Loss'], datasets:[{data:[w,l], backgroundColor:['#10b981','#ef4444'], borderWidth:0}]}, options:{cutout:'70%', plugins:{legend:{position:'right', labels:{color:'#94a3b8'}}}}});
    }
}

// --- JOURNAL ---
window.openEntryModal = function() { 
    document.getElementById('entry-modal').classList.remove('hidden'); 
    const now=new Date(); document.getElementById('inp-date').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().split('T')[0];
    // Reset image
    document.getElementById('entry-img-preview').classList.add('hidden'); 
    document.getElementById('entry-upload-hint').classList.remove('hidden'); 
    document.getElementById('inp-note').value = "";
    currentEntryImgBase64 = null;
    calcRiskPreview();
}
window.handleEntryImage = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('entry-img-preview').src=e.target.result; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); currentEntryImgBase64=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.saveEntry = function() {
    const rawDate = document.getElementById('inp-date').value;
    if(!rawDate) return alert("Chọn ngày!");
    const [y, m, d] = rawDate.split('-'); const dateStr = `${d}/${m}/${y}`;
    
    const p = parseFloat(document.getElementById('inp-risk').value)||0;
    const mode = document.getElementById('inp-risk-mode').value;
    const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,'');
    const curBal = parseFloat(curBalText) || initialCapital;
    const riskUSD = mode === '%' ? curBal * (p/100) : p;
    
    journalData.unshift({ 
        id:Date.now().toString(), date:dateStr, 
        pair: document.getElementById('inp-pair').value, 
        dir: document.getElementById('inp-dir').value,
        strategy: document.getElementById('inp-strategy').value,
        risk: riskUSD.toFixed(2), rr: document.getElementById('inp-rr').value,
        status:'OPEN', pnl:0, note: document.getElementById('inp-note').value,
        image: currentEntryImgBase64 
    });
    // Sort by date desc
    journalData.sort((a,b) => {
        const [d1, m1, y1] = a.date.split('/'); const [d2, m2, y2] = b.date.split('/');
        return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
    });

    saveUserData(); renderJournalList(); renderDashboard(); window.closeModal('entry-modal');
}
window.updateEntryStatus = function(id, status) { 
    const idx = journalData.findIndex(e => e.id.toString() === id.toString()); 
    if(idx !== -1) { 
        journalData[idx].status = status; 
        const r = parseFloat(journalData[idx].risk);
        const rr = parseFloat(journalData[idx].rr);
        if(status === 'WIN') journalData[idx].pnl = r * rr; 
        else if(status === 'LOSS') journalData[idx].pnl = -r; 
        else journalData[idx].pnl = 0; 
        saveUserData(); renderJournalList(); renderDashboard(); 
    } 
}
window.deleteEntry = (id) => { if(confirm('Xóa?')) { journalData=journalData.filter(x=>x.id!=id); saveUserData(); renderJournalList(); renderDashboard(); } }
window.renderJournalList = function() { 
    document.getElementById('journal-list').innerHTML = journalData.map(t=>`
        <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="p-4 font-bold text-slate-500 text-xs">${t.date}<br><span class="opacity-50 text-[10px]">${t.session||'SESSION'}</span></td>
            <td class="p-4 font-bold"><span class="${t.dir==='BUY'?'text-green-500':'text-red-500'}">${t.dir}</span> ${t.pair}</td>
            <td class="p-4 text-center">${t.image ? `<img src="${t.image}" class="w-10 h-10 object-cover rounded cursor-pointer mx-auto hover:scale-150 transition shadow-sm border border-slate-200 dark:border-slate-700" onclick="viewImageFull('${t.image}')">` : '-'}</td>
            <td class="p-4 text-xs font-medium">${t.strategy}</td>
            <td class="p-4 text-center text-xs">1:${t.rr}</td>
            <td class="p-4 text-right font-mono font-bold ${parseFloat(t.pnl)>0?'text-green-500':parseFloat(t.pnl)<0?'text-red-500':'text-slate-500'}">${parseFloat(t.pnl)>0?'+':''}${parseFloat(t.pnl).toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="deleteEntry('${t.id}')"><i data-lucide="trash-2" class="w-4 h-4 text-slate-400 hover:text-red-500"></i></button></td>
        </tr>`).join(''); 
    updateDailyPnL(); 
    lucide.createIcons();
}

// --- CAPITAL PAIRS ---
window.renderPairsList = function() {
    document.getElementById('pairs-list-container').innerHTML = pairsData.map(p => `
        <div class="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700">
            ${p} <button onclick="removePair('${p}')" class="text-red-500 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>`).join('');
    lucide.createIcons();
}
window.addNewPair = function() {
    const el = document.getElementById('new-pair-input');
    const val = el.value.trim().toUpperCase();
    if(val && !pairsData.includes(val)) { pairsData.push(val); saveUserData(); renderPairsList(); renderPairSelects(); }
    el.value = "";
}
window.removePair = function(val) {
    if(confirm('Xóa mã này?')) { pairsData = pairsData.filter(p => p !== val); saveUserData(); renderPairsList(); renderPairSelects(); }
}
window.renderPairSelects = function() { 
    const h = pairsData.map(p=>`<option value="${p}">${p}</option>`).join(''); 
    const aiSel = document.getElementById('ai-pair-input');
    const inpSel = document.getElementById('inp-pair');
    if(aiSel) aiSel.innerHTML=h; 
    if(inpSel) inpSel.innerHTML=h; 
}

// --- WIKI & PERMISSIONS ---

window.openWikiEditor = function(id=null) {
    if(!isAdmin) return alert("Chỉ Admin mới được sửa!");
    
    document.getElementById('wiki-editor-modal').classList.remove('hidden');
    
    // Gợi ý danh mục
    const cats = [...new Set(wikiData.map(i => i.cat))];
    const dl = document.getElementById('cat-suggestions');
    if(dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');

    // Reset Form Elements
    const imgPreview = document.getElementById('edit-preview');
    const uploadHint = document.getElementById('wiki-upload-hint');
    
    if(id) { 
        // CHẾ ĐỘ SỬA
        const i = wikiData.find(x=>x.id==id); 
        if(i) { 
            document.getElementById('wiki-editor-title').innerText = "Chỉnh Sửa Wiki";
            document.getElementById('edit-id').value = i.id; 
            document.getElementById('edit-title').value = i.title; 
            document.getElementById('edit-code').value = i.code; 
            document.getElementById('edit-cat').value = i.cat; 
            document.getElementById('edit-content').value = i.content;
            
            // Xử lý ảnh khi sửa
            document.getElementById('edit-image-url').value = i.image; 
            if(i.image) {
                imgPreview.src = i.image;
                imgPreview.classList.remove('hidden');
                if(uploadHint) uploadHint.classList.add('hidden');
            } else {
                imgPreview.classList.add('hidden');
                if(uploadHint) uploadHint.classList.remove('hidden');
            }
        } 
    } else { 
        // CHẾ ĐỘ TẠO MỚI
        document.getElementById('wiki-editor-title').innerText = "Thêm Wiki Mới";
        document.getElementById('edit-id').value = ""; 
        document.getElementById('edit-title').value = ""; 
        document.getElementById('edit-code').value = ""; 
        document.getElementById('edit-cat').value = ""; 
        document.getElementById('edit-image-url').value = ""; 
        document.getElementById('edit-content').value = "";
        
        // Reset ảnh về trạng thái trống
        imgPreview.src = "";
        imgPreview.classList.add('hidden');
        if(uploadHint) uploadHint.classList.remove('hidden');
    }
}

// Hàm xử lý khi chọn ảnh từ máy tính (Dùng chung cho cả Wiki)
window.handleImageUpload = function(inp) { 
    if(inp.files[0]) { 
        const r = new FileReader(); 
        r.onload = (e) => { 
            // Xử lý cho Wiki Editor
            const wikiPreview = document.getElementById('edit-preview');
            const wikiUrl = document.getElementById('edit-image-url');
            const wikiHint = document.getElementById('wiki-upload-hint');
            
            if(wikiPreview && wikiUrl) {
                wikiPreview.src = e.target.result; 
                wikiPreview.classList.remove('hidden'); 
                wikiUrl.value = e.target.result; // Lưu base64 vào input ẩn
                if(wikiHint) wikiHint.classList.add('hidden');
            }
        }; 
        r.readAsDataURL(inp.files[0]); 
    } 
}

window.saveWiki = function() {
    if(!isAdmin) return;
    const id = document.getElementById('edit-id').value || Date.now().toString();
    
    // Lấy dữ liệu từ các trường (bao gồm ảnh từ input ẩn)
    const item = { 
        id, 
        title: document.getElementById('edit-title').value, 
        code: document.getElementById('edit-code').value, 
        cat: document.getElementById('edit-cat').value, 
        image: document.getElementById('edit-image-url').value, // Lấy chuỗi base64 ảnh
        content: document.getElementById('edit-content').value 
    };
    
    if(!item.code || !item.title) return alert("Vui lòng nhập Mã và Tiêu đề!");

    const idx = wikiData.findIndex(x=>x.id==id);
    if(idx!==-1) wikiData[idx]=item; else wikiData.push(item);
    
    saveWikiData(); 
    renderWikiGrid(); 
    populateStrategies(); // Cập nhật lại list ở tab Phân tích
    window.closeModal('wiki-editor-modal');
}

// --- UTILS & OTHERS ---
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.switchTab = (id) => { document.querySelectorAll('main > div').forEach(e=>e.classList.add('hidden')); document.getElementById('tab-'+id).classList.remove('hidden'); if(id==='dashboard') renderDashboard(); };
window.initTheme = () => { if(localStorage.theme==='dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }
window.toggleTheme = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; renderCharts(journalData.filter(t=>t.status!=='OPEN'), initialCapital); }
window.populateStrategies = () => { document.getElementById('strategy-list-container').innerHTML = wikiData.map(w=>`<div class="p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800" onclick="selectAnalysisStrategy('${w.id}')"><p class="font-bold text-sm">${w.code}</p><p class="text-xs opacity-70 truncate">${w.title}</p></div>`).join(''); document.getElementById('inp-strategy').innerHTML = wikiData.map(w=>`<option value="${w.code}">${w.code} - ${w.title}</option>`).join(''); };
window.previewImage = (url) => { document.getElementById('edit-preview').src = url; if(url) document.getElementById('edit-preview').classList.remove('hidden'); else document.getElementById('edit-preview').classList.add('hidden'); }
window.handleImageUpload = (inp) => { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('edit-preview').src=e.target.result; document.getElementById('edit-preview').classList.remove('hidden'); document.getElementById('edit-image-url').value=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = () => { 
    const v=parseFloat(document.getElementById('inp-risk').value)||0; 
    const mode=document.getElementById('inp-risk-mode').value; 
    const rr=parseFloat(document.getElementById('inp-rr').value)||0; 
    const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,'');
    const curBal = parseFloat(curBalText) || initialCapital;
    const r = mode==='%'? curBal*(v/100) : v; 
    document.getElementById('risk-preview').innerText=`Risk: $${r.toFixed(1)}`; 
    document.getElementById('reward-preview').innerText=`Reward: $${(r*rr).toFixed(1)}`; 
}
window.saveInitialCapital = () => { initialCapital = parseFloat(document.getElementById('real-init-capital').value)||20000; saveUserData(); renderDashboard(); alert("Đã lưu!"); };
window.updateCapitalCalc = () => {
    const start = parseFloat(document.getElementById('cap-sim-start').value)||0; const pct = parseFloat(document.getElementById('cap-risk-pct').value)||1; const rr = parseFloat(document.getElementById('cap-rr').value)||2; const n = 20; let bal = start, html = ''; for(let i=1; i<=n; i++) { const risk = bal*(pct/100); const profit = risk*rr; const end = bal+profit; html += `<tr class="border-b border-slate-200 dark:border-slate-800"><td class="p-2 text-center">${i}</td><td class="p-2 text-right">$${Math.round(bal).toLocaleString()}</td><td class="p-2 text-right text-rose-500 text-xs">-$${Math.round(risk).toLocaleString()}</td><td class="p-2 text-right text-emerald-500 font-bold">+$${Math.round(profit).toLocaleString()}</td><td class="p-3 text-right font-bold">$${Math.round(end).toLocaleString()}</td></tr>`; bal = end; } document.getElementById('cap-projection-list').innerHTML = html;
}
window.openBgModal = () => alert("Chế độ iOS Glass được bật mặc định!");

// AI Logic
async function callGeminiAPI(prompt, imageBase64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const parts = [{ text: prompt }]; if (imageBase64) parts.push({ inlineData: { mimeType: "image/png", data: imageBase64.split(',')[1] } });
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) }); const data = await response.json(); if (!response.ok) throw new Error("API Error"); return data.candidates[0].content.parts[0].text; } catch (error) { throw error; }
}
window.handleAIUpload = function(input) { if (input.files[0]) { const r = new FileReader(); r.onload = (e) => { document.getElementById('ai-preview-img').src = e.target.result; document.getElementById('ai-preview-img').classList.remove('hidden'); document.getElementById('ai-upload-placeholder').classList.add('hidden'); currentAnalysisImageBase64 = e.target.result; }; r.readAsDataURL(input.files[0]); } }
window.runAIAnalysis = async function() { if(!currentAnalysisImageBase64) return alert("Chọn ảnh!"); const btn = document.getElementById('btn-ai-analyze'); btn.innerHTML = "ĐANG XỬ LÝ..."; btn.disabled = true; const pair = document.getElementById('ai-pair-input').value; const prompt = `Phân tích ${pair}. JSON: {pattern_name, score, conclusion}`; try { const txt = await callGeminiAPI(prompt, currentAnalysisImageBase64); const json = JSON.parse(txt.replace(/```json|```/g,'').trim()); document.getElementById('ai-res-pattern').innerText = json.pattern_name; document.getElementById('ai-res-conclusion').innerHTML = marked.parse(json.conclusion); document.getElementById('ai-result-content').classList.remove('hidden'); } catch (e) { alert("Lỗi: "+e.message); } btn.innerHTML = "BẮT ĐẦU"; btn.disabled = false; }
window.resetAI = function() { document.getElementById('ai-result-content').classList.add('hidden'); document.getElementById('ai-result-empty').classList.remove('hidden'); currentAnalysisImageBase64=null; document.getElementById('ai-preview-img').classList.add('hidden'); document.getElementById('ai-upload-placeholder').classList.remove('hidden'); }

// Admin
window.openAdminPanel = async () => {
    document.getElementById('admin-modal').classList.remove('hidden');
    const tb = document.getElementById('admin-user-list'); tb.innerHTML = 'Loading...';
    const s = await getDocs(collection(db, "users"));
    let h = '';
    s.forEach(d => {
        const u = d.data();
        if(u.status === 'pending') h += `<tr><td class="p-3">${u.username}</td><td class="p-3 text-right"><button onclick="approveUser('${u.username}')" class="px-3 py-1 bg-green-600 rounded text-xs font-bold text-white">DUYỆT</button></td></tr>`;
    });
    tb.innerHTML = h || '<tr><td colspan="2" class="p-4 text-center text-slate-500">Trống</td></tr>';
}
window.approveUser = async (u) => { if(confirm("Duyệt?")) { await updateDoc(doc(db,"users",u),{status:'approved'}); window.openAdminPanel(); } }

// Link Analysis to Journal
window.selectAnalysisStrategy = function(id) { const item = wikiData.find(x=>x.id==id); if(item) { selectedAnalysisStrategy=item; document.getElementById('current-setup-name').innerText=item.title; document.getElementById('ana-theory-img').src=item.image; document.getElementById('ana-theory-content').innerText=item.content; document.getElementById('analysis-empty-state').classList.add('hidden'); } }
window.handleAnalysisUpload = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('ana-real-img').src=e.target.result; document.getElementById('ana-real-img').classList.remove('hidden'); document.getElementById('ana-upload-hint').classList.add('hidden'); currentAnalysisTabImg=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.transferAnalysisToJournal = function() { if(!selectedAnalysisStrategy) return alert("Chưa chọn chiến lược!"); window.switchTab('journal'); window.openEntryModal(); if(currentAnalysisTabImg) { currentEntryImgBase64=currentAnalysisTabImg; document.getElementById('entry-img-preview').src=currentAnalysisTabImg; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); } }