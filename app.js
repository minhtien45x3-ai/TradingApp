import { db, doc, getDoc, setDoc } from './firebase.js';

// --- 1. CONFIG & CONSTANTS ---
// API Key Gemini (Hãy bảo mật key này)
const GEMINI_API_KEY = "AIzaSyA5rkECrtH8rEVgFyhq80dz6XGAKYwTQYc"; 

const DEFAULT_WIKI = [
    { id: "XH01", code: "XH01", cat: "Xu Hướng", title: "Uptrend & Downtrend", image: "https://placehold.co/800x400/1e293b/10b981?text=XuHuong", content: "Đỉnh sau cao hơn đỉnh trước (HH), đáy sau cao hơn đáy trước (HL)." },
    { id: "BB02", code: "BB02", cat: "Setup", title: "Bounce Breakout", image: "https://placehold.co/800x400/1e293b/10b981?text=Setup", content: "Mua khi giá quay lại test vùng phá vỡ (Retest)." }
];
const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];

// --- 2. STATE ---
let journalData = [];
let wikiData = [];
let pairsData = [];
let initialCapital = 20000;
let currentBgTheme = 'bg-theme-default';
let currentFilter = 'all';
let currentAnalysisImageBase64 = null;
let currentEntryImgBase64 = null; // Biến tạm lưu ảnh lệnh
let chartInstances = {};

// --- 3. INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    const storedUser = localStorage.getItem('min_sys_current_user');
    if(storedUser) document.getElementById('login-user').value = storedUser;
});

// --- 4. LOAD & SAVE DATA ---
window.loadData = async function() {
    if (!window.currentUser) return;
    const marquee = document.getElementById('dynamic-quote');
    if(marquee) marquee.innerText = "🔄 Đang tải dữ liệu...";
    
    try {
        const userRef = doc(db, "users", window.currentUser);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            journalData = data.journal || [];
            wikiData = data.wiki || DEFAULT_WIKI;
            pairsData = data.pairs || DEFAULT_PAIRS;
            initialCapital = data.capital || 20000;
            if(data.background) window.setBackground(data.background, false);
        } else {
            saveDataToCloud();
        }
        
        initUI();
        if(marquee) marquee.innerText = "✅ Đã sẵn sàng!";
    } catch (error) {
        console.error("Load Error:", error);
        alert("Lỗi tải: " + error.message);
    }
}

async function saveDataToCloud() {
    if (!window.currentUser) return;
    try {
        await setDoc(doc(db, "users", window.currentUser), {
            journal: journalData,
            wiki: wikiData,
            pairs: pairsData,
            capital: initialCapital,
            background: currentBgTheme,
            last_updated: new Date().toISOString()
        }, { merge: true });
    } catch (e) { console.error("Save Error:", e); }
}

function initUI() {
    renderWikiGrid();
    renderCategoryFilters();
    renderDashboard();
    populateStrategies();
    renderPairSelects();
    renderJournalList();
    initQuote();
    
    // Init Capital UI values
    const capInput = document.getElementById('real-init-capital');
    const simStart = document.getElementById('cap-sim-start');
    if(capInput) capInput.value = initialCapital;
    if(simStart) simStart.value = initialCapital;
    updateCapitalCalc(); // Run calc once
    
    lucide.createIcons();
}

// --- 5. AI GEMINI LOGIC ---
async function callGeminiAPI(prompt, imageBase64 = null) {
    const model = imageBase64 ? "gemini-1.5-flash" : "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const parts = [{ text: prompt }];
    if (imageBase64) {
        const cleanBase64 = imageBase64.split(',')[1];
        parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
    }
    
    const response = await fetch(url, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ contents: [{ parts }] }) 
    });
    
    if (!response.ok) throw new Error("Gemini API Error: " + response.statusText);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

window.handleAIUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('ai-preview-img');
            img.src = e.target.result;
            img.classList.remove('hidden');
            document.getElementById('ai-upload-placeholder').classList.add('hidden');
            currentAnalysisImageBase64 = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

window.runAIAnalysis = async function() {
    if(!currentAnalysisImageBase64) return alert("Vui lòng chọn ảnh biểu đồ!");
    
    const btn = document.getElementById('btn-ai-analyze');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> ĐANG PHÂN TÍCH...`;
    btn.disabled = true;
    
    const pair = document.getElementById('ai-pair-input').value || "Unknown";
    const tf = document.getElementById('ai-tf-input').value;
    
    const prompt = `Phân tích biểu đồ ${pair} khung ${tf}. Hãy đóng vai một chuyên gia Trading Price Action. Tôi cần output là JSON thuần túy (không markdown) với cấu trúc: { "pattern_name": "Tên mẫu hình (Tiếng Việt)", "score": 85, "conclusion": "Kết luận chi tiết và lời khuyên giao dịch (Tiếng Việt, dùng markdown)" }. Hãy nhận diện xu hướng, cản và tín hiệu nến.`;
    
    try {
        const text = await callGeminiAPI(prompt, currentAnalysisImageBase64);
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        
        document.getElementById('ai-res-pattern').innerText = result.pattern_name;
        document.getElementById('ai-res-score').innerText = result.score + "%";
        document.getElementById('ai-res-time').innerText = new Date().toLocaleTimeString();
        document.getElementById('ai-res-conclusion').innerHTML = marked.parse(result.conclusion);
        
        document.getElementById('ai-result-empty').classList.add('hidden');
        document.getElementById('ai-result-content').classList.remove('hidden');
    } catch (e) {
        alert("Lỗi phân tích: " + e.message);
        console.error(e);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
    }
}

window.resetAI = function() {
    document.getElementById('ai-result-content').classList.add('hidden');
    document.getElementById('ai-result-empty').classList.remove('hidden');
    document.getElementById('ai-upload-input').value = "";
    document.getElementById('ai-preview-img').classList.add('hidden');
    document.getElementById('ai-upload-placeholder').classList.remove('hidden');
    currentAnalysisImageBase64 = null;
}

// --- 6. CAPITAL MANAGEMENT LOGIC ---
window.saveInitialCapital = function() {
    const val = parseFloat(document.getElementById('real-init-capital').value);
    if(isNaN(val) || val < 0) return alert("Vốn không hợp lệ!");
    initialCapital = val;
    saveDataToCloud();
    renderDashboard();
    document.getElementById('cap-sim-start').value = val;
    updateCapitalCalc();
    alert("Đã lưu Vốn Gốc mới!");
}

window.updateCapitalCalc = function() {
    const startBal = parseFloat(document.getElementById('cap-sim-start').value) || 0;
    const riskPct = parseFloat(document.getElementById('cap-risk-pct').value) || 1;
    const rr = parseFloat(document.getElementById('cap-rr').value) || 2;
    const count = parseInt(document.getElementById('cap-sim-count').value) || 20;
    
    let bal = startBal;
    let html = '';
    
    for(let i=1; i<=count; i++) {
        const riskAmount = bal * (riskPct / 100);
        const profitAmount = riskAmount * rr;
        const endBal = bal + profitAmount; 
        
        html += `
            <tr class="border-b dark:border-slate-800">
                <td class="p-3 text-center text-slate-500">${i}</td>
                <td class="p-3 text-right text-slate-600 dark:text-slate-400">$${Math.round(bal).toLocaleString()}</td>
                <td class="p-3 text-right text-rose-500 text-xs">-$${Math.round(riskAmount).toLocaleString()}</td>
                <td class="p-3 text-right text-emerald-500 font-bold">+$${Math.round(profitAmount).toLocaleString()}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-white">$${Math.round(endBal).toLocaleString()}</td>
            </tr>
        `;
        bal = endBal;
    }
    document.getElementById('cap-projection-list').innerHTML = html;
}

// --- 7. JOURNAL LOGIC (CRUD + ẢNH) ---
window.openEntryModal = function() { 
    document.getElementById('entry-modal').classList.remove('hidden'); 
    // Reset Form
    document.getElementById('entry-img-preview').src = "";
    document.getElementById('entry-img-preview').classList.add('hidden');
    document.getElementById('entry-upload-hint').classList.remove('hidden');
    document.getElementById('inp-note').value = "";
    currentEntryImgBase64 = null;
    calcRiskPreview();
}

window.handleEntryImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            const img = document.getElementById('entry-img-preview');
            img.src = base64;
            img.classList.remove('hidden');
            document.getElementById('entry-upload-hint').classList.add('hidden');
            currentEntryImgBase64 = base64;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

window.saveEntry = function() {
    const pair = document.getElementById('inp-pair').value;
    const dir = document.getElementById('inp-dir').value;
    const session = document.getElementById('inp-session').value;
    const strat = document.getElementById('inp-strategy').value;
    const riskVal = parseFloat(document.getElementById('inp-risk').value);
    const riskMode = document.getElementById('inp-risk-mode').value;
    const rr = parseFloat(document.getElementById('inp-rr').value);
    const note = document.getElementById('inp-note').value;

    if(!pair) return alert("Chọn cặp tiền!");
    if(isNaN(riskVal) || riskVal <= 0) return alert("Rủi ro sai!");

    let finalRiskUSD = riskMode === '%' ? getCurrentBalance() * (riskVal / 100) : riskVal;

    const newEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('vi-VN'),
        pair, dir, session, strategy: strat,
        risk: finalRiskUSD.toFixed(2),
        rr, status: 'OPEN', pnl: 0, 
        note,
        image: currentEntryImgBase64 // LƯU ẢNH
    };

    journalData.unshift(newEntry);
    saveDataToCloud();
    renderJournalList();
    renderDashboard();
    window.closeModal('entry-modal');
}

window.updateEntryStatus = function(id, newStatus) {
    const idx = journalData.findIndex(e => e.id.toString() === id.toString());
    if(idx !== -1) {
        journalData[idx].status = newStatus;
        const risk = parseFloat(journalData[idx].risk) || 0;
        const rr = parseFloat(journalData[idx].rr) || 0;
        if(newStatus === 'WIN') journalData[idx].pnl = risk * rr;
        else if(newStatus === 'LOSS') journalData[idx].pnl = -risk;
        else journalData[idx].pnl = 0;
        saveDataToCloud();
        renderJournalList();
        renderDashboard();
    }
}

window.deleteEntry = function(id) {
    if(confirm('Xóa lệnh?')) {
        journalData = journalData.filter(e => e.id.toString() !== id.toString());
        saveDataToCloud();
        renderJournalList();
        renderDashboard();
    }
}

window.renderJournalList = function() {
    const list = document.getElementById('journal-list');
    if(!list) return;
    list.innerHTML = journalData.map(t => {
        const statusColor = t.status === 'WIN' ? 'text-emerald-500' : (t.status === 'LOSS' ? 'text-rose-500' : 'text-blue-500');
        const pnlVal = parseFloat(t.pnl);
        const pnlColor = pnlVal > 0 ? 'text-emerald-500' : (pnlVal < 0 ? 'text-rose-500' : 'text-slate-500');
        
        // Cột hiển thị hình ảnh
        const imageCell = t.image 
            ? `<div class="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer hover:scale-110 transition mx-auto" onclick="viewImageFull('${t.image}')"><img src="${t.image}" class="w-full h-full object-cover"></div>`
            : `<span class="text-slate-300 text-xs">-</span>`;

        return `
        <tr class="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 group">
            <td class="p-4 text-center text-xs text-slate-500"><div>${t.date}</div><div>${t.session}</div></td>
            <td class="p-4 text-center">${imageCell}</td>
            <td class="p-4 text-center font-bold text-slate-800 dark:text-white">${t.pair} <span class="block text-[10px] ${t.dir==='BUY'?'text-emerald-500':'text-rose-500'} font-extrabold">${t.dir}</span></td>
            <td class="p-4 text-center text-xs text-slate-500 truncate max-w-[120px]" title="${t.strategy}">${t.strategy}</td>
            <td class="p-4 text-center text-xs font-mono text-slate-600 dark:text-slate-300">-$${t.risk} | 1:${t.rr}</td>
            <td class="p-4 text-center">
                <select onchange="updateEntryStatus('${t.id}', this.value)" class="bg-transparent text-xs font-bold outline-none cursor-pointer ${statusColor} text-center border rounded border-slate-200 dark:border-slate-700 p-1 hover:border-emerald-500 transition">
                    <option value="OPEN" ${t.status==='OPEN'?'selected':''}>OPEN</option>
                    <option value="WIN" ${t.status==='WIN'?'selected':''}>WIN</option>
                    <option value="LOSS" ${t.status==='LOSS'?'selected':''}>LOSS</option>
                </select>
            </td>
            <td class="p-4 text-right font-bold ${pnlColor} font-mono">${pnlVal > 0 ? '+' : ''}${pnlVal.toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="deleteEntry('${t.id}')" class="text-slate-400 hover:text-rose-500 opacity-50 group-hover:opacity-100 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        </tr>`;
    }).join('');
    lucide.createIcons();
    updateDailyPnL();
}

function updateDailyPnL() {
    const today = new Date().toLocaleDateString('vi-VN');
    const todayPnL = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0);
    const el = document.getElementById('journal-pnl-today');
    if(el) {
        el.innerText = (todayPnL >= 0 ? '+' : '') + `$${todayPnL.toFixed(2)}`;
        el.className = `text-sm font-mono font-bold ${todayPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
    }
}

// --- 8. WIKI LOGIC ---
window.openWikiEditor = function(id = null) {
    const cats = [...new Set(wikiData.map(i => i.cat))];
    document.getElementById('cat-suggestions').innerHTML = cats.map(c => `<option value="${c}">`).join('');
    if (id) {
        const item = wikiData.find(i => i.id.toString() === id.toString());
        if(item) {
            document.getElementById('wiki-editor-title').innerText = "Chỉnh Sửa Wiki";
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-code').value = item.code;
            document.getElementById('edit-cat').value = item.cat;
            document.getElementById('edit-title').value = item.title;
            document.getElementById('edit-image-url').value = item.image;
            document.getElementById('edit-content').value = item.content;
            window.previewImage(item.image);
        }
    } else {
        document.getElementById('wiki-editor-title').innerText = "Tạo Mới Wiki";
        document.getElementById('edit-id').value = "";
        document.getElementById('edit-code').value = "";
        document.getElementById('edit-cat').value = "";
        document.getElementById('edit-title').value = "";
        document.getElementById('edit-image-url').value = "";
        document.getElementById('edit-content').value = "";
        document.getElementById('edit-preview').classList.add('hidden');
    }
    document.getElementById('wiki-editor-modal').classList.remove('hidden');
}
window.saveWiki = function() {
    const idInput = document.getElementById('edit-id').value;
    const code = document.getElementById('edit-code').value;
    const cat = document.getElementById('edit-cat').value;
    const title = document.getElementById('edit-title').value;
    const image = document.getElementById('edit-image-url').value;
    const content = document.getElementById('edit-content').value;
    if (!code || !cat || !title) return alert("Điền đủ thông tin!");
    const isNew = !idInput;
    const id = isNew ? Date.now().toString() : idInput;
    const newItem = { id, code, cat, title, image, content };
    if (isNew) wikiData.push(newItem);
    else {
        const idx = wikiData.findIndex(i => i.id.toString() === id.toString());
        if(idx !== -1) wikiData[idx] = newItem;
    }
    saveDataToCloud();
    renderWikiGrid();
    populateStrategies();
    window.closeModal('wiki-editor-modal');
    alert(isNew ? "Đã tạo!" : "Đã lưu!");
}
window.deleteWikiItem = function(id) {
    if(confirm("Xóa mục này?")) {
        wikiData = wikiData.filter(i => i.id.toString() !== id.toString());
        saveDataToCloud();
        renderWikiGrid();
        populateStrategies();
        window.closeModal('wiki-detail-modal');
    }
}
window.viewWikiDetail = function(id) {
    const item = wikiData.find(x => x.id.toString() === id.toString());
    if(item) {
        currentViewedWikiId = id;
        document.getElementById('view-title').innerText = item.title;
        document.getElementById('view-image').src = item.image || '';
        document.getElementById('view-content').innerText = item.content;
        const btnEdit = document.getElementById('btn-edit-entry');
        const btnDel = document.getElementById('btn-delete-entry');
        const newEdit = btnEdit.cloneNode(true);
        const newDel = btnDel.cloneNode(true);
        btnEdit.parentNode.replaceChild(newEdit, btnEdit);
        btnDel.parentNode.replaceChild(newDel, btnDel);
        newEdit.onclick = () => { window.closeModal('wiki-detail-modal'); window.openWikiEditor(id); };
        newDel.onclick = () => window.deleteWikiItem(id);
        document.getElementById('wiki-ai-container').classList.add('hidden');
        document.getElementById('wiki-detail-modal').classList.remove('hidden');
    }
}
window.renderWikiGrid = function() {
    const grid = document.getElementById('wiki-grid');
    const term = document.getElementById('wiki-search').value.toLowerCase();
    if (!Array.isArray(wikiData)) wikiData = [];
    const filtered = wikiData.filter(i => (currentFilter === 'all' || i.cat === currentFilter) && (i.title.toLowerCase().includes(term) || i.code.toLowerCase().includes(term)));
    grid.innerHTML = filtered.map(item => `
        <div class="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 cursor-pointer group hover:shadow-lg transition" onclick="viewWikiDetail('${item.id}')">
            <div class="flex justify-between mb-2"><span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">${item.code}</span><span class="text-[10px] text-slate-500 uppercase font-bold">${item.cat}</span></div>
            <div class="h-36 bg-slate-100 dark:bg-slate-900 rounded mb-3 overflow-hidden border border-slate-100 dark:border-slate-700">${item.image ? `<img src="${item.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">` : `<div class="w-full h-full flex items-center justify-center text-slate-400"><i data-lucide="image"></i></div>`}</div>
            <h4 class="font-bold text-slate-800 dark:text-white text-sm line-clamp-1 group-hover:text-emerald-500 transition">${item.title}</h4>
        </div>`).join('');
    lucide.createIcons();
}

// --- 9. HELPERS & AUTH ---
window.authRegister = async function() {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;
    if(!user || !pass) return alert("Điền đủ thông tin!");
    try {
        const userRef = doc(db, "users", user);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) return alert("Tài khoản đã tồn tại!");
        const users = JSON.parse(localStorage.getItem('min_sys_users_db') || '[]');
        users.push({ username: user, password: pass });
        localStorage.setItem('min_sys_users_db', JSON.stringify(users));
        await setDoc(doc(db, "users", user), { username: user, created_at: new Date().toISOString(), journal: [], wiki: DEFAULT_WIKI, capital: 20000, pairs: DEFAULT_PAIRS, background: 'bg-theme-default' });
        alert("Đăng ký thành công!"); window.toggleAuth();
    } catch (e) { alert("Lỗi: " + e.message); }
}
window.authLogin = async function() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const users = JSON.parse(localStorage.getItem('min_sys_users_db') || '[]');
    const valid = users.find(u => u.username === user && u.password === pass);
    if(valid || user) { 
        window.currentUser = user; localStorage.setItem('min_sys_current_user', user);
        document.getElementById('current-username').innerText = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        window.loadData();
    } else { alert("Sai thông tin!"); }
}
window.authLogout = function() { localStorage.removeItem('min_sys_current_user'); location.reload(); }
window.toggleAuth = function() { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); }
window.switchTab = function(id) { document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden')); document.getElementById(`tab-${id}`).classList.remove('hidden'); if(id === 'dashboard') renderDashboard(); }
window.setBackground = function(theme, save=true) { document.body.className = `bg-theme-default text-slate-800 dark:text-slate-200 min-h-screen flex flex-col ${theme}`; if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark'); currentBgTheme = theme; if(save) saveDataToCloud(); window.closeModal('bg-settings-modal'); }
window.openBgModal = function() { document.getElementById('bg-settings-modal').classList.remove('hidden'); }
window.toggleTheme = function() { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; renderCharts(); }
function initTheme() { if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); }
function getCurrentBalance() { let pnl = 0; journalData.forEach(t => pnl += parseFloat(t.pnl)); return initialCapital + pnl; }
window.renderDashboard = function() {
    let wins=0, total=journalData.length, pnl=0;
    const closed = journalData.filter(t => t.status !== 'OPEN');
    closed.forEach(t => { pnl += parseFloat(t.pnl); if(t.status === 'WIN') wins++; });
    const winRate = closed.length ? Math.round((wins/closed.length)*100) : 0;
    const bal = initialCapital + pnl;
    document.getElementById('dash-balance').innerText = `$${bal.toLocaleString()}`;
    document.getElementById('header-balance').innerText = `$${bal.toLocaleString()}`;
    document.getElementById('dash-winrate').innerText = `${winRate}%`;
    document.getElementById('dash-total').innerText = `${total} Lệnh`;
    document.getElementById('dash-pnl').innerText = (pnl>=0?'+':'') + `$${pnl.toLocaleString()}`;
    renderCharts();
}
window.renderCharts = function() {
    const ctxEquity = document.getElementById('chart-equity'); const ctxWinLoss = document.getElementById('chart-winloss');
    if(ctxEquity && window.Chart) {
        const closed = journalData.filter(t => t.status !== 'OPEN').sort((a,b) => a.id - b.id);
        let bal = initialCapital;
        const points = [initialCapital, ...closed.map(t => bal += parseFloat(t.pnl))];
        const labels = ['Start', ...closed.map((_,i) => i+1)];
        if(chartInstances.equity) chartInstances.equity.destroy();
        chartInstances.equity = new Chart(ctxEquity, { type: 'line', data: { labels, datasets: [{ label: 'Vốn', data: points, borderColor: '#10b981', tension: 0.2, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } } });
    }
    if(ctxWinLoss && window.Chart) {
        let win=0, loss=0; journalData.filter(t => t.status !== 'OPEN').forEach(t => { if(t.status==='WIN') win++; else loss++; });
        if(chartInstances.winloss) chartInstances.winloss.destroy();
        chartInstances.winloss = new Chart(ctxWinLoss, { type: 'doughnut', data: { labels: ['Win', 'Loss'], datasets: [{ data: [win, loss], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } } });
    }
}
window.handleImageUpload = function(input) { if (input.files[0]) { const r = new FileReader(); r.onload = function(e) { document.getElementById('edit-preview').src = e.target.result; document.getElementById('edit-preview').classList.remove('hidden'); document.getElementById('edit-image-url').value = e.target.result; }; r.readAsDataURL(input.files[0]); } }
window.previewImage = function(url) { const img = document.getElementById('edit-preview'); if(url) { img.src = url; img.classList.remove('hidden'); } else img.classList.add('hidden'); }
window.viewImageFull = function(src) { document.getElementById('image-viewer-img').src = src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = function() {
    const val = parseFloat(document.getElementById('inp-risk').value) || 0;
    const mode = document.getElementById('inp-risk-mode').value;
    const rr = parseFloat(document.getElementById('inp-rr').value) || 0;
    const bal = getCurrentBalance();
    let riskUSD = mode === '%' ? bal * (val / 100) : val;
    document.getElementById('risk-preview').innerText = `= $${riskUSD.toFixed(1)}`;
    document.getElementById('reward-preview').innerText = ` | Lời: $${(riskUSD*rr).toFixed(1)}`;
}
window.populateStrategies = function() { const setups = wikiData.filter(i => i.cat === 'Setup' || i.cat === 'Chiến Lược' || i.cat === 'Strategy'); document.getElementById('inp-strategy').innerHTML = setups.map(s => `<option value="${s.code}: ${s.title}">${s.code}: ${s.title}</option>`).join(''); }
window.renderPairSelects = function() { const html = pairsData.map(p => `<option value="${p}">${p}</option>`).join(''); document.getElementById('ai-pair-input').innerHTML = html; document.getElementById('inp-pair').innerHTML = html; }
window.renderCategoryFilters = function() { const container = document.getElementById('wiki-filter-container'); const cats = Array.from(new Set(wikiData.map(i=>i.cat))).sort(); container.innerHTML = `<button onclick="filterWikiCat('all')" class="px-4 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 ${currentFilter==='all'?'bg-emerald-500 text-white':''}">All</button>` + cats.map(c => `<button onclick="filterWikiCat('${c}')" class="px-4 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 ${currentFilter===c?'bg-emerald-500 text-white':''}">${c}</button>`).join(''); }
window.filterWikiCat = function(c) { currentFilter = c; renderWikiGrid(); renderCategoryFilters(); }
window.filterWiki = function() { renderWikiGrid(); }
function initQuote() { document.getElementById('dynamic-quote').innerText = "Trade what you see, not what you think."; }