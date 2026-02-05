// Make a call
async function makeCall() {
    const phoneInput = document.getElementById('phone-input');
    const callStatus = document.getElementById('call-status');
    const callBtn = document.getElementById('call-btn');

    const to = phoneInput.value;

    if (!to) {
        callStatus.textContent = 'Please enter a phone number';
        callStatus.className = 'call-status error';
        return;
    }

    // UI Loading State
    callBtn.disabled = true;
    callStatus.textContent = 'Initiating call...';
    callStatus.className = 'call-status loading';

    try {
        const response = await fetch('/api/calls/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: to,
                from: localStorage.getItem('phone_number') || '+1987654321',
                organization_id: localStorage.getItem('org_id') || '17170ec5-ac80-4dbf-a293-7825caa3ca70'
            })
        });

        const data = await response.json();

        if (response.ok) {
            callStatus.textContent = `Call initiated! ID: ${data.call_id}`;
            callStatus.className = 'call-status success';
            phoneInput.value = '';
        } else {
            throw new Error(data.error || 'Failed to start call');
        }
    } catch (error) {
        console.error('Error starting call:', error);
        callStatus.textContent = `Error: ${error.message}`;
        callStatus.className = 'call-status error';
    } finally {
        callBtn.disabled = false;
    }
}

// Fetch stats from API
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        // Update stats
        document.getElementById('active-calls').textContent = data.activeCalls || 0;
        document.getElementById('total-calls').textContent = data.totalCalls || 0;
        document.getElementById('avg-duration').textContent = formatDuration(data.avgDuration || 0);
        document.getElementById('total-cost').textContent = `$${(data.totalCost || 0).toFixed(5)}`;
        document.getElementById('avg-cost').textContent = `$${(data.avgCost || 0).toFixed(5)}`;
        document.getElementById('llm-cost').textContent = `$${(data.llmCost || 0).toFixed(5)}`;
        document.getElementById('avg-llm-cost').textContent = `$${(data.avgLlmCost || 0).toFixed(5)}`;

        // Update chart
        updateChart(data.callsOverTime || []);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Chart setup
let chart;

function updateChart(data) {
    const ctx = document.getElementById('callsChart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    const labels = data.map(d => d.date);
    const values = data.map(d => d.count);

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['Nov 2', 'Dec 2'],
            datasets: [{
                label: 'Calls',
                data: values.length ? values : [0, 0],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#2a2a2a',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        color: '#2a2a2a'
                    },
                    ticks: {
                        color: '#666666'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#2a2a2a'
                    },
                    ticks: {
                        color: '#666666'
                    }
                }
            }
        }
    });
}

// Real-time updates via WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'call_started') {
            const activeCalls = parseInt(document.getElementById('active-calls').textContent);
            document.getElementById('active-calls').textContent = activeCalls + 1;
        } else if (data.type === 'call_ended') {
            const activeCalls = parseInt(document.getElementById('active-calls').textContent);
            document.getElementById('active-calls').textContent = Math.max(0, activeCalls - 1);

            // Refresh stats
            fetchStats();
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => {
        fetchStats();
        updateChart([]);
        connectWebSocket();

        // Refresh stats every 30 seconds
        setInterval(fetchStats, 30000);
    };
    document.head.appendChild(script);
});
