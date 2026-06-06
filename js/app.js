// ===== PWA Install Prompt =====
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.remove('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                const result = await deferredInstallPrompt.userChoice;
                if (result.outcome === 'accepted') {
                    document.getElementById('install-banner').classList.add('hidden');
                }
                deferredInstallPrompt = null;
            }
        });
    }
});

// ===== MAIN APP =====
const app = {
    members: [],
    transactions: [],
    currentView: 'dashboard',

    // ===== INIT =====
    async init() {
        try {
            await db.init();

            // Load saved settings
            i18n.loadSavedLang();
            this.loadTheme();

            // Seed default member if empty
            const members = await db.getAll('members');
            if (members.length === 0) {
                await db.put('members', { id: 'member_1', name: 'Ravi', createdAt: new Date().toISOString() });
            }

            // Splash screen → App transition
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                    const container = document.getElementById('app-container');
                    container.classList.remove('hidden');
                    container.style.opacity = '1';
                    document.getElementById('bottom-nav').classList.remove('translate-y-full');
                    this.navigate('dashboard');
                }, 600);
            }, 1800);
        } catch (e) {
            console.error('Init failed:', e);
        }
    },

    // ===== THEME ENGINE =====
    loadTheme() {
        const saved = localStorage.getItem('jl_theme') || 'dark';
        this.applyTheme(saved);
    },

    setTheme(mode) {
        localStorage.setItem('jl_theme', mode);
        this.applyTheme(mode);
        this.updateThemeButtons(mode);
    },

    applyTheme(mode) {
        let effectiveTheme = mode;
        if (mode === 'system') {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        // Update meta theme-color for mobile browser chrome
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = effectiveTheme === 'dark' ? '#0f172a' : '#f8fafc';
        }
        this.updateThemeButtons(mode);
    },

    updateThemeButtons(active) {
        ['light', 'dark', 'system'].forEach(t => {
            const btn = document.getElementById(`theme-${t}-btn`);
            if (!btn) return;
            if (t === active) {
                btn.style.borderColor = 'var(--accent)';
                btn.style.background = 'var(--accent)';
                btn.style.color = 'white';
            } else {
                btn.style.borderColor = 'var(--border-color)';
                btn.style.background = 'var(--bg-surface)';
                btn.style.color = 'var(--text-primary)';
            }
        });
    },

    // ===== LANGUAGE =====
    setLanguage(lang) {
        i18n.setLang(lang);
        this.updateLangButtons(lang);
        // Re-render current view with new language
        this.navigate(this.currentView);
    },

    updateLangButtons(lang) {
        const enBtn = document.getElementById('lang-en-btn');
        const taBtn = document.getElementById('lang-ta-btn');
        if (!enBtn || !taBtn) return;
        if (lang === 'en') {
            enBtn.style.borderColor = 'var(--accent)'; enBtn.style.background = 'var(--accent)'; enBtn.style.color = 'white';
            taBtn.style.borderColor = 'var(--border-color)'; taBtn.style.background = 'var(--bg-surface)'; taBtn.style.color = 'var(--text-primary)';
        } else {
            taBtn.style.borderColor = 'var(--accent)'; taBtn.style.background = 'var(--accent)'; taBtn.style.color = 'white';
            enBtn.style.borderColor = 'var(--border-color)'; enBtn.style.background = 'var(--bg-surface)'; enBtn.style.color = 'var(--text-primary)';
        }
    },

    // ===== NAVIGATION =====
    async loadData() {
        this.members = await db.getAll('members');
        this.transactions = await db.getAll('transactions');
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async navigate(view) {
        await this.loadData();
        this.currentView = view;

        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${view}`);
        if (target) target.classList.remove('hidden');

        // Update nav highlight
        document.querySelectorAll('.nav-item').forEach(el => {
            el.style.color = el.dataset.target === view ? 'var(--accent)' : 'var(--text-muted)';
        });

        // Render
        if (view === 'dashboard') this.renderDashboard();
        else if (view === 'transactions') this.renderTransactions();
        else if (view === 'members') this.renderMembers();
        else if (view === 'analytics') this.renderAnalytics();
        else if (view === 'settings') this.renderSettings();

        // Apply translations
        i18n.applyTranslations();
    },

    // ===== FORMAT HELPERS =====
    fmt(num) {
        return '₹' + Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    fmtDate(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return i18n.currentLang === 'ta' ? 'இன்று' : 'Today';
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return i18n.currentLang === 'ta' ? 'நேற்று' : 'Yesterday';
        return d.toLocaleDateString(i18n.currentLang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' });
    },

    // ===== DASHBOARD =====
    renderDashboard() {
        const { totalBalance, totalContributions, totalExpenses, balances } = finance.calculateBalances(this.members, this.transactions);
        const todaySpent = finance.getTodaySpending(this.transactions);
        const monthlySpent = finance.getMonthlySpending(this.transactions);

        document.getElementById('dash-total-balance').textContent = this.fmt(totalBalance);
        document.getElementById('dash-today-spent').textContent = this.fmt(todaySpent);
        document.getElementById('dash-monthly-spent').textContent = this.fmt(monthlySpent);

        // Member balances
        const balancesContainer = document.getElementById('dash-member-balances');
        balancesContainer.innerHTML = '';
        this.members.forEach((m, idx) => {
            const b = balances[m.id];
            const div = document.createElement('div');
            div.className = `flex-1 ${idx > 0 ? 'pl-4' : ''}`;
            if (idx > 0) div.style.borderLeft = '1px solid var(--border-color)';
            div.innerHTML = `
                <p class="text-sm font-medium" style="color: var(--text-secondary)">${m.name}</p>
                <p class="text-xl font-bold" style="color: ${b.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.fmt(b.balance)}</p>
            `;
            balancesContainer.appendChild(div);
        });

        // Recent transactions
        const recentContainer = document.getElementById('dash-recent-txns');
        recentContainer.innerHTML = '';
        if (this.transactions.length === 0) {
            recentContainer.innerHTML = `<p class="p-6 text-center text-lg" style="color: var(--text-muted)" data-i18n="noTransactions">${i18n.t('noTransactions')}</p>`;
        } else {
            this.transactions.slice(0, 5).forEach(t => {
                recentContainer.innerHTML += this.renderTxnRow(t);
            });
        }
    },

    renderTxnRow(t) {
        const member = this.members.find(m => m.id === t.memberId);
        const isContrib = t.type === 'contribution';
        const isShared = t.splitType === 'EQUAL' || t.type === 'shared';
        const catEmojis = { Food: '🍔', Travel: '🚗', Shopping: '🛍️', Bills: '🧾', Medical: '🏥', Education: '📚', Entertainment: '🎬', Other: '📦' };
        const emoji = isContrib ? '💰' : (catEmojis[t.category] || '📦');
        const sharedBadge = (!isContrib && isShared) ? `<span style="background: rgba(59,130,246,0.15); color: var(--accent); padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; margin-left: 6px;">${i18n.currentLang === 'ta' ? 'பகிர்வு' : 'Shared'}</span>` : '';

        return `
            <div class="flex items-center gap-4 p-4 transition-colors" style="border-bottom: 1px solid var(--border-color)">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style="background: ${isContrib ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}">
                    ${emoji}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-base font-semibold truncate">${t.description || (isContrib ? i18n.t('deposit') : t.category)} ${sharedBadge}</p>
                    <p class="text-sm" style="color: var(--text-muted)">${this.fmtDate(t.date)} · ${member ? member.name : '?'}</p>
                </div>
                <p class="text-lg font-bold whitespace-nowrap" style="color: ${isContrib ? 'var(--success)' : 'var(--danger)'}">
                    ${isContrib ? '+' : '-'}${this.fmt(t.amount)}
                </p>
            </div>
        `;
    },

    // ===== TRANSACTIONS =====
    renderTransactions() {
        const container = document.getElementById('txns-list');
        const searchTerm = (document.getElementById('txn-search')?.value || '').toLowerCase();
        container.innerHTML = '';

        const filtered = this.transactions.filter(t =>
            (t.description || '').toLowerCase().includes(searchTerm) ||
            (t.category || '').toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            container.innerHTML = `<p class="p-8 text-center text-lg" style="color: var(--text-muted)" data-i18n="noTransactions">${i18n.t('noTransactions')}</p>`;
        } else {
            filtered.forEach(t => { container.innerHTML += this.renderTxnRow(t); });
        }
    },

    // ===== MEMBERS =====
    renderMembers() {
        const { balances } = finance.calculateBalances(this.members, this.transactions);
        const container = document.getElementById('members-list');
        container.innerHTML = '';

        const gradients = [
            'linear-gradient(135deg, #3b82f6, #6366f1)',
            'linear-gradient(135deg, #10b981, #14b8a6)',
            'linear-gradient(135deg, #8b5cf6, #a855f7)',
            'linear-gradient(135deg, #f59e0b, #ef4444)'
        ];

        this.members.forEach((m, idx) => {
            const b = balances[m.id];
            container.innerHTML += `
                <div class="glass-card p-5 flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-lg" style="background: ${gradients[idx % gradients.length]}">${m.name.charAt(0).toUpperCase()}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-lg font-bold truncate">${m.name}</p>
                        <p class="text-sm" style="color: var(--text-muted)">${i18n.t('contributed')}: ${this.fmt(b.contributed)} · ${i18n.t('spent')}: ${this.fmt(b.spent)}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-xl font-bold" style="color: ${b.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.fmt(b.balance)}</p>
                        <button onclick="app.deleteMember('${m.id}')" class="text-xs mt-1 font-semibold" style="color: var(--danger)">${i18n.t('removeMember')}</button>
                    </div>
                </div>
            `;
        });

        // Settlements
        const settlements = finance.generateSettlements(balances);
        const stContainer = document.getElementById('settlements-container');
        stContainer.innerHTML = '';

        if (settlements.length === 0) {
            stContainer.innerHTML = `
                <div class="p-5 rounded-2xl flex items-start gap-3" style="background: rgba(16,185,129,0.1); border: 1.5px solid rgba(16,185,129,0.2);">
                    <span class="text-3xl">✅</span>
                    <div>
                        <h4 class="text-lg font-bold" style="color: var(--success)" data-i18n="allSettled">${i18n.t('allSettled')}</h4>
                        <p class="text-sm mt-1" style="color: var(--text-secondary)" data-i18n="allSettledDesc">${i18n.t('allSettledDesc')}</p>
                    </div>
                </div>
            `;
        } else {
            settlements.forEach(s => {
                stContainer.innerHTML += `
                    <div class="p-4 rounded-2xl flex justify-between items-center" style="background: rgba(245,158,11,0.1); border: 1.5px solid rgba(245,158,11,0.2);">
                        <p class="text-base"><span class="font-bold">${s.from}</span> <span style="color: var(--text-muted)">${i18n.t('shouldPay')}</span> <span class="font-bold">${s.to}</span></p>
                        <p class="text-lg font-bold" style="color: var(--warning)">${this.fmt(s.amount)}</p>
                    </div>
                `;
            });
        }
    },

    // ===== ANALYTICS =====
    renderAnalytics() {
        analytics.renderSpendingChart(this.transactions, 'spendingChart');
        
        const { totalBalance, balances } = finance.calculateBalances(this.members, this.transactions);
        const topCat = finance.getTopCategory(this.transactions);
        const topSpender = finance.getTopSpender(this.transactions, this.members);
        const monthlySpent = finance.getMonthlySpending(this.transactions);

        const insightsContainer = document.getElementById('simple-insights-list');
        insightsContainer.innerHTML = '';

        const expenses = this.transactions.filter(t => t.type === 'expense' || t.type === 'shared');
        if (expenses.length === 0) {
            insightsContainer.innerHTML = `<p class="text-lg" style="color: var(--text-muted)">${i18n.t('noExpensesYet')}</p>`;
        } else {
            const budgetOk = totalBalance > monthlySpent;
            insightsContainer.innerHTML = `
                <p class="text-lg"><span style="color: var(--text-muted)">${i18n.t('topCategory')}:</span> <span class="font-bold">${topCat || '-'}</span></p>
                <p class="text-lg"><span style="color: var(--text-muted)">${i18n.t('topSpender')}:</span> <span class="font-bold">${topSpender || '-'}</span></p>
                <p class="text-lg"><span style="color: var(--text-muted)">${i18n.t('remainingBalance')}:</span> <span class="font-bold">${this.fmt(totalBalance)}</span></p>
                <p class="text-lg"><span style="color: var(--text-muted)">${i18n.t('budgetStatus')}:</span> <span class="font-bold" style="color: ${budgetOk ? 'var(--success)' : 'var(--danger)'}">${budgetOk ? i18n.t('good') : i18n.t('needsAttention')}</span></p>
            `;
        }

        // Health Scores
        const scores = finance.calculateFairShareScore(balances);
        const scoresContainer = document.getElementById('health-scores-list');
        scoresContainer.innerHTML = '';

        this.members.forEach(m => {
            const s = scores[m.id];
            if (!s) return;
            let barColor = '#10b981';
            if (s.score < 80) barColor = '#3b82f6';
            if (s.score < 50) barColor = '#f59e0b';
            if (s.score < 30) barColor = '#ef4444';

            scoresContainer.innerHTML += `
                <div>
                    <div class="flex justify-between items-end mb-2">
                        <span class="text-base font-semibold">${m.name}</span>
                        <span class="text-sm font-bold" style="color: var(--text-secondary)">${s.score}/100 — ${i18n.t(s.status)}</span>
                    </div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width: ${s.score}%; background: ${barColor}"></div></div>
                </div>
            `;
        });
    },

    // ===== SETTINGS =====
    renderSettings() {
        this.updateLangButtons(i18n.currentLang);
        this.updateThemeButtons(localStorage.getItem('jl_theme') || 'dark');
    },

    // ===== TRANSACTION MODAL =====
    setActionType(type) {
        document.getElementById('txn-type').value = type;
        const btnExp = document.getElementById('btn-type-expense');
        const btnCont = document.getElementById('btn-type-contribution');
        const catContainer = document.getElementById('category-container');
        const splitContainer = document.getElementById('split-container');
        const quickChips = document.getElementById('quick-add-chips');

        if (type === 'contribution') {
            btnCont.style.background = 'var(--success)'; btnCont.style.color = 'white';
            btnExp.style.background = 'transparent'; btnExp.style.color = 'var(--text-muted)';
            catContainer.style.display = 'none';
            splitContainer.style.display = 'none';
            quickChips.classList.remove('hidden');
        } else {
            btnExp.style.background = 'var(--accent)'; btnExp.style.color = 'white';
            btnCont.style.background = 'transparent'; btnCont.style.color = 'var(--text-muted)';
            catContainer.style.display = 'block';
            splitContainer.style.display = type === 'shared' ? 'none' : 'block';
            quickChips.classList.add('hidden');
            if (type === 'shared') {
                document.getElementById('txn-type').value = 'expense';
                const splitSelect = document.getElementById('txn-split');
                splitSelect.value = 'EQUAL';
            }
        }
        i18n.applyTranslations();
    },

    quickFill(amount) {
        document.getElementById('txn-amount').value = amount;
    },

    async openActionModal(defaultType) {
        await this.loadData();
        const modal = document.getElementById('action-modal');
        const content = document.getElementById('action-modal-content');

        // Populate members
        const select = document.getElementById('txn-member');
        select.innerHTML = '';
        this.members.forEach(m => {
            select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });

        document.getElementById('transaction-form').reset();

        if (defaultType === 'shared') {
            this.setActionType('shared');
        } else {
            this.setActionType(defaultType || 'expense');
        }

        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-full', 'sm:scale-95');
        i18n.applyTranslations();
    },

    closeActionModal() {
        const modal = document.getElementById('action-modal');
        const content = document.getElementById('action-modal-content');
        modal.classList.add('opacity-0');
        content.classList.add('translate-y-full', 'sm:scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    async handleTransactionSubmit(e) {
        e.preventDefault();
        const typeRaw = document.getElementById('txn-type').value;
        const amount = document.getElementById('txn-amount').value;
        const memberId = document.getElementById('txn-member').value;
        const description = document.getElementById('txn-desc').value;
        const category = typeRaw === 'contribution' ? '' : document.getElementById('txn-category').value;
        const splitType = typeRaw === 'contribution' ? 'PERSONAL' : document.getElementById('txn-split').value;
        
        const type = typeRaw === 'contribution' ? 'contribution' : (splitType === 'EQUAL' ? 'shared' : 'expense');

        const txn = { type, amount, memberId, description, category, splitType, date: new Date().toISOString() };
        await db.put('transactions', txn);
        this.closeActionModal();
        this.navigate(this.currentView);
    },

    // ===== MEMBER MODAL =====
    openAddMemberModal() {
        const modal = document.getElementById('member-modal');
        const content = document.getElementById('member-modal-content');
        document.getElementById('new-member-name').value = '';
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        i18n.applyTranslations();
    },

    closeAddMemberModal() {
        const modal = document.getElementById('member-modal');
        const content = document.getElementById('member-modal-content');
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    async handleAddMember(e) {
        e.preventDefault();
        const name = document.getElementById('new-member-name').value.trim();
        if (!name) return;
        await db.put('members', { id: 'member_' + Date.now(), name, createdAt: new Date().toISOString() });
        this.closeAddMemberModal();
        this.navigate('members');
    },

    async deleteMember(id) {
        const msg = i18n.currentLang === 'ta' ? 'இந்த உறுப்பினரை நீக்க விரும்புகிறீர்களா?' : 'Remove this member?';
        if (confirm(msg)) {
            await db.delete('members', id);
            this.navigate('members');
        }
    },

    // ===== EXPORT / IMPORT =====
    async exportData() {
        await this.loadData();
        const data = { members: this.members, transactions: this.transactions };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jointledger_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportCSV() {
        if (this.transactions.length === 0) return;
        let csv = 'Date,Type,Member,Amount,Category,Description,Split\n';
        this.transactions.forEach(t => {
            const member = this.members.find(m => m.id === t.memberId);
            csv += `"${new Date(t.date).toLocaleDateString()}","${t.type}","${member ? member.name : ''}","${t.amount}","${t.category || ''}","${t.description || ''}","${t.splitType || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jointledger_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.members && data.transactions) {
                    for (const m of data.members) await db.put('members', m);
                    for (const t of data.transactions) await db.put('transactions', t);
                    alert(i18n.t('importSuccess'));
                    this.navigate('dashboard');
                } else {
                    alert(i18n.t('invalidFile'));
                }
            } catch (err) {
                alert(i18n.t('invalidFile'));
            }
        };
        reader.readAsText(file);
    },

    async resetApp() {
        if (confirm(i18n.t('resetWarning'))) {
            indexedDB.deleteDatabase('JointLedgerLiteDB');
            localStorage.clear();
            location.reload();
        }
    }
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
