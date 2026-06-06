const analytics = {
    chartInstance: null,

    renderSpendingChart(transactions, canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const expenses = transactions.filter(t => t.type === 'expense' || t.type === 'shared');
        const categories = {};
        expenses.forEach(e => {
            const cat = e.category || 'Other';
            categories[cat] = (categories[cat] || 0) + parseFloat(e.amount);
        });

        const hasData = Object.keys(categories).length > 0;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

        const data = {
            labels: hasData ? Object.keys(categories) : [i18n.t('noExpensesYet')],
            datasets: [{
                data: hasData ? Object.values(categories) : [1],
                backgroundColor: hasData ? colors.slice(0, Object.keys(categories).length) : ['#334155'],
                borderWidth: 0,
            }]
        };

        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 14 }
                        }
                    }
                },
                cutout: '70%',
                maintainAspectRatio: false
            }
        });
    }
};
