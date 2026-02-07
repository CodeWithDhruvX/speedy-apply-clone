document.addEventListener('DOMContentLoaded', async () => {
    // Set Date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Load Data
    const data = await chrome.storage.local.get(['applicationLog', 'stats']);
    const logs = data.applicationLog || [];

    // Calculate Stats
    const today = new Date().toDateString();
    const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === today);

    document.getElementById('todayCount').textContent = todayLogs.length;
    document.getElementById('totalCount').textContent = logs.length;

    // Render Table
    const tableBody = document.getElementById('activityTable');
    if (logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No applications yet. Start applying!</td></tr>';
    } else {
        // Show last 10
        logs.slice().reverse().slice(0, 10).forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.site || 'Unknown Site'}</td>
                <td>${log.role || 'N/A'}</td>
                <td>${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString()}</td>
                <td><span class="status-badge">Applied</span></td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Render Chart (Last 7 Days)
    renderChart(logs);
});

function renderChart(logs) {
    const chart = document.getElementById('activityChart');
    const days = 7;
    const stats = {};

    // Initialize last 7 days
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        stats[d.toDateString()] = 0;
    }

    // Fill counts
    logs.forEach(log => {
        const d = new Date(log.timestamp).toDateString();
        if (stats[d] !== undefined) {
            stats[d]++;
        }
    });

    // Find max for scaling
    const counts = Object.values(stats);
    const max = Math.max(...counts, 5); // Minimum scale of 5

    // Draw bars
    Object.keys(stats).forEach(dateStr => {
        const count = stats[dateStr];
        const height = (count / max) * 100;
        const dateObj = new Date(dateStr);
        const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar" style="height: ${height}%" title="${count} applications"></div>
            <div class="bar-label">${dayLabel}</div>
        `;
        chart.appendChild(col);
    });
}
