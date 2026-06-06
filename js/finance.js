const finance = {
    calculateBalances(members, transactions) {
        const balances = {};
        let totalContributions = 0;
        let totalExpenses = 0;

        members.forEach(m => {
            balances[m.id] = { id: m.id, name: m.name, contributed: 0, spent: 0, balance: 0 };
        });

        transactions.forEach(t => {
            const amount = parseFloat(t.amount);
            if (isNaN(amount)) return;

            if (t.type === 'contribution') {
                totalContributions += amount;
                if (balances[t.memberId]) {
                    balances[t.memberId].contributed += amount;
                    balances[t.memberId].balance += amount;
                }
            } else if (t.type === 'expense' || t.type === 'shared') {
                totalExpenses += amount;

                if (t.splitType === 'EQUAL' || t.type === 'shared') {
                    // Person who paid effectively fronted the money for everyone
                    const memberCount = members.length;
                    const splitAmount = memberCount > 0 ? amount / memberCount : 0;

                    // The payer's balance goes up by (amount - their split share)
                    if (balances[t.memberId]) {
                        balances[t.memberId].balance += (amount - splitAmount);
                        balances[t.memberId].spent += splitAmount;
                    }
                    // Everyone else's balance goes down by their split share
                    members.forEach(m => {
                        if (m.id !== t.memberId && balances[m.id]) {
                            balances[m.id].spent += splitAmount;
                            balances[m.id].balance -= splitAmount;
                        }
                    });
                } else {
                    // Personal expense — only the payer's balance goes down
                    if (balances[t.memberId]) {
                        balances[t.memberId].spent += amount;
                        balances[t.memberId].balance -= amount;
                    }
                }
            }
        });

        const totalBalance = totalContributions - totalExpenses;
        return { totalBalance, totalContributions, totalExpenses, balances };
    },

    getTodaySpending(transactions) {
        const today = new Date().toDateString();
        return transactions
            .filter(t => (t.type === 'expense' || t.type === 'shared') && new Date(t.date).toDateString() === today)
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    },

    getMonthlySpending(transactions) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return transactions
            .filter(t => {
                if (t.type !== 'expense' && t.type !== 'shared') return false;
                const d = new Date(t.date);
                return d.getFullYear() === year && d.getMonth() === month;
            })
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    },

    generateSettlements(balancesObj) {
        const balances = Object.values(balancesObj).map(b => ({ ...b }));
        const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
        const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
        const settlements = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

            if (amount > 0.01) {
                settlements.push({ from: debtor.name, to: creditor.name, amount });
            }
            debtor.balance += amount;
            creditor.balance -= amount;
            if (Math.abs(debtor.balance) < 0.01) i++;
            if (creditor.balance < 0.01) j++;
        }
        return settlements;
    },

    calculateFairShareScore(balancesObj) {
        const scores = {};
        Object.values(balancesObj).forEach(b => {
            if (b.contributed === 0 && b.spent > 0) {
                scores[b.id] = { score: 10, status: 'needsAttention' };
            } else if (b.contributed === 0 && b.spent === 0) {
                scores[b.id] = { score: 100, status: 'excellent' };
            } else {
                let ratio = b.spent / b.contributed;
                let score = Math.round(100 - (ratio * 50));
                if (score > 100) score = 100;
                if (score < 0) score = 0;
                let status = 'excellent';
                if (score <= 80 && score > 50) status = 'good';
                if (score <= 50) status = 'needsAttention';
                scores[b.id] = { score, status };
            }
        });
        return scores;
    },

    getTopCategory(transactions) {
        const expenses = transactions.filter(t => t.type === 'expense' || t.type === 'shared');
        if (expenses.length === 0) return null;
        const cats = {};
        expenses.forEach(e => {
            const cat = e.category || 'Other';
            cats[cat] = (cats[cat] || 0) + parseFloat(e.amount);
        });
        return Object.keys(cats).reduce((a, b) => cats[a] > cats[b] ? a : b);
    },

    getTopSpender(transactions, members) {
        const expenses = transactions.filter(t => t.type === 'expense' || t.type === 'shared');
        if (expenses.length === 0) return null;
        const memberSpent = {};
        expenses.forEach(e => {
            memberSpent[e.memberId] = (memberSpent[e.memberId] || 0) + parseFloat(e.amount);
        });
        const topId = Object.keys(memberSpent).reduce((a, b) => memberSpent[a] > memberSpent[b] ? a : b, null);
        const member = members.find(m => m.id == topId);
        return member ? member.name : null;
    }
};
