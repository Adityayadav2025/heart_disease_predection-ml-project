let radarChart, barChart, gaugeChart;
let systemChart, streamChart;

function toggleAdvanced() {
    const el = document.getElementById('advanced-params');
    const btn = document.querySelector('.btn-toggle');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        btn.textContent = 'Hide Advanced Parameters ▴';
    } else {
        el.style.display = 'none';
        btn.textContent = 'Advanced Parameters ▾';
    }
}

function initTabs() {
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all
            links.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
            
            // Add active to current
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab');
            const targetEl = document.getElementById(targetId);
            
            if (targetId === 'tab-scanner') {
                targetEl.style.display = 'flex';
            } else {
                targetEl.style.display = 'block';
            }

            // If switching to Dashboard or Records, refresh data
            if (targetId === 'tab-dashboard' || targetId === 'tab-records') {
                fetchRecords();
            }
        });
    });
}

function initCharts() {
    // Colors
    const colorSafe = 'rgba(16, 185, 129, 0.8)';
    const colorRisk = 'rgba(239, 68, 68, 0.8)';

    // Scanner Tab Charts
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Age', 'BP', 'Chol', 'Max HR', 'ST Depress', 'Vessels'],
            datasets: [{
                label: 'Patient Data',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgba(99, 102, 241, 1)',
            }, {
                label: 'Healthy Baseline',
                data: [40, 120, 200, 150, 0, 0],
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.5)',
                borderDash: [5, 5]
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { ticks: { display: false }, pointLabels: { color: '#94a3b8', font: { size: 10 } } } },
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
        }
    });

    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Safe', 'Risk'],
            datasets: [{ label: 'Probability', data: [100, 0], backgroundColor: [colorSafe, colorRisk], borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            scales: { x: { max: 100, ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } },
            plugins: { legend: { display: false } }
        }
    });

    const ctxGauge = document.getElementById('gaugeChart').getContext('2d');
    gaugeChart = new Chart(ctxGauge, {
        type: 'doughnut',
        data: { labels: ['Risk', 'Safe'], datasets: [{ data: [0, 100], backgroundColor: [colorRisk, '#1e293b'], borderWidth: 0, circumference: 180, rotation: 270 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });

    // Dashboard Tab Charts
    const ctxSystem = document.getElementById('systemChart').getContext('2d');
    systemChart = new Chart(ctxSystem, {
        type: 'doughnut',
        data: { labels: ['Safe', 'High Risk'], datasets: [{ data: [50, 50], backgroundColor: [colorSafe, colorRisk], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });

    const ctxStream = document.getElementById('streamChart').getContext('2d');
    streamChart = new Chart(ctxStream, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Risk Score History', data: [], borderColor: colorRisk, backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { x: { display: false }, y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } } },
            plugins: { legend: { display: false } }
        }
    });
}

function updateUI(data) {
    const prob = data.ensemble_prob * 100;
    const isRisk = prob >= 50;

    const statusEl = document.getElementById('main-status');
    const scoreEl = document.getElementById('main-score');
    
    if (isRisk) {
        statusEl.textContent = 'High Risk Detected';
        statusEl.className = 'status-positive';
    } else {
        statusEl.textContent = 'Healthy Profile';
        statusEl.className = 'status-negative';
    }
    scoreEl.textContent = prob.toFixed(2) + '%';

    barChart.data.datasets[0].data = [100 - prob, prob];
    barChart.update();

    gaugeChart.data.datasets[0].data = [prob, 100 - prob];
    const gaugeColor = isRisk ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)';
    gaugeChart.data.datasets[0].backgroundColor[0] = gaugeColor;
    document.getElementById('gauge-score').textContent = prob.toFixed(0) + '%';
    document.getElementById('gauge-score').style.color = gaugeColor;
    gaugeChart.update();

    const age = parseFloat(document.getElementById('age').value);
    const trestbps = parseFloat(document.getElementById('trestbps').value);
    const chol = parseFloat(document.getElementById('chol').value);
    const thalach = parseFloat(document.getElementById('thalach').value);
    const oldpeak = parseFloat(document.getElementById('oldpeak').value);
    const ca = parseFloat(document.getElementById('ca').value);

    radarChart.data.datasets[0].data = [age, trestbps, chol / 2, thalach, oldpeak * 20, ca * 30];
    radarChart.update();
}

async function submitForm(saveRecord = true) {
    const btn = document.getElementById('analyze-btn');
    btn.textContent = 'ANALYZING...';
    btn.disabled = true;

    const payload = {
        age: document.getElementById('age').value,
        sex: document.getElementById('sex').value,
        cp: document.getElementById('cp').value,
        trestbps: document.getElementById('trestbps').value,
        chol: document.getElementById('chol').value,
        fbs: document.getElementById('fbs').value,
        restecg: document.getElementById('restecg').value,
        thalach: document.getElementById('thalach').value,
        exang: document.getElementById('exang').value,
        oldpeak: document.getElementById('oldpeak').value,
        slope: document.getElementById('slope').value,
        ca: document.getElementById('ca').value,
        thal: document.getElementById('thal').value,
        save_record: saveRecord
    };

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.error) alert('Error: ' + data.error);
        else updateUI(data);
    } catch (err) {
        console.error(err);
        alert('Failed to connect to AI Engine.');
    } finally {
        btn.textContent = 'ANALYZE DATA';
        btn.disabled = false;
    }
}

async function fetchRecords() {
    try {
        const res = await fetch('/api/records');
        const records = await res.json();
        
        // Populate Table
        const tbody = document.getElementById('records-tbody');
        tbody.innerHTML = '';
        
        let safeCount = 0;
        let riskCount = 0;
        let totalScore = 0;
        
        const labels = [];
        const scores = [];

        records.forEach(r => {
            // Table row
            const tr = document.createElement('tr');
            const statusColor = r.status === 'Safe' ? '#10b981' : '#ef4444';
            tr.innerHTML = `
                <td>${r.timestamp}</td>
                <td>${r.age}</td>
                <td>${r.sex}</td>
                <td>${r.trestbps}</td>
                <td>${r.chol}</td>
                <td style="color: ${statusColor}">${r.status}</td>
                <td>${r.risk_score}%</td>
            `;
            tbody.appendChild(tr);

            // Stats prep
            if (r.status === 'Safe') safeCount++;
            else riskCount++;
            totalScore += r.risk_score;
            
            labels.unshift(r.timestamp.split(' ')[1]); // Just time
            scores.unshift(r.risk_score);
        });

        // Update Dashboard Stats
        if (records.length > 0) {
            systemChart.data.datasets[0].data = [safeCount, riskCount];
            systemChart.update();

            streamChart.data.labels = labels;
            streamChart.data.datasets[0].data = scores;
            streamChart.update();

            document.getElementById('stat-total').textContent = records.length;
            document.getElementById('stat-avg').textContent = (totalScore / records.length).toFixed(1) + '%';
            
            const lastStatus = records[0].status;
            const statStatusEl = document.getElementById('stat-status');
            statStatusEl.textContent = lastStatus === 'Safe' ? 'SECURE' : 'ALERT';
            statStatusEl.style.color = lastStatus === 'Safe' ? '#10b981' : '#ef4444';
        }

    } catch (err) {
        console.error("Error fetching records:", err);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCharts();
    submitForm(false); // Initial test analysis without saving
});

async function exportCSV() {
    try {
        const btn = document.getElementById('export-btn');
        btn.textContent = 'EXPORTING...';
        btn.disabled = true;

        const res = await fetch('/api/records');
        const records = await res.json();

        if (records.length === 0) {
            alert('No records to export.');
            return;
        }

        // Define CSV headers based on the database columns
        const headers = ['ID', 'Timestamp', 'Age', 'Sex', 'Resting BP', 'Cholesterol', 'Risk Score', 'Status'];
        
        let csvContent = headers.join(',') + '\n';

        records.forEach(r => {
            const row = [
                r.id,
                `"${r.timestamp}"`,
                r.age,
                `"${r.sex}"`,
                r.trestbps,
                r.chol,
                r.risk_score,
                `"${r.status}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `heart_health_audit_log_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error('Error exporting CSV:', err);
        alert('Failed to export CSV.');
    } finally {
        const btn = document.getElementById('export-btn');
        btn.textContent = 'EXPORT CSV';
        btn.disabled = false;
    }
}
