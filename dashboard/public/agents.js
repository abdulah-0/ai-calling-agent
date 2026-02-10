// AI Agents Management
let agents = [];
let editingAgentId = null;

// Load agents on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAgents();
});

async function loadAgents() {
    try {
        const response = await fetch('/api/agents');
        if (response.ok) {
            agents = await response.json();
            renderAgents();
        } else {
            // If endpoint doesn't exist yet, use mock data
            agents = [
                {
                    id: '1',
                    name: 'Customer Support Agent',
                    voice: 'en-US-Neural2-F',
                    prompt: 'You are a helpful customer support agent. Answer questions professionally and concisely.',
                    temperature: 0.7,
                    created_at: new Date().toISOString()
                }
            ];
            renderAgents();
        }
    } catch (error) {
        console.error('Error loading agents:', error);
        agents = [];
        renderAgents();
    }
}

function renderAgents() {
    const grid = document.getElementById('agents-grid');

    if (agents.length === 0) {
        grid.innerHTML = `
            <div class="stat-card" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; opacity: 0.3;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h3 style="margin-bottom: 8px;">No AI Agents Yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">Create your first AI agent to get started</p>
                <button class="btn-primary" onclick="showCreateAgentModal()">Create Agent</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = agents.map(agent => `
        <div class="stat-card agent-card">
            <div class="agent-card-header">
                <h3>${agent.name}</h3>
                <div class="agent-actions">
                    <button class="btn-icon" onclick="editAgent('${agent.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="deleteAgent('${agent.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="agent-card-body">
                <div class="agent-detail">
                    <span class="agent-label">Voice:</span>
                    <span>${agent.voice}</span>
                </div>
                <div class="agent-detail">
                    <span class="agent-label">Temperature:</span>
                    <span>${agent.temperature}</span>
                </div>
                <div class="agent-detail" style="margin-top: 12px;">
                    <span class="agent-label">Prompt:</span>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px; line-height: 1.5;">
                        ${agent.prompt.substring(0, 100)}${agent.prompt.length > 100 ? '...' : ''}
                    </p>
                </div>
            </div>
        </div>
    `).join('');
}

function showCreateAgentModal() {
    editingAgentId = null;
    document.getElementById('modal-title').textContent = 'Create AI Agent';
    document.getElementById('agent-name').value = '';
    document.getElementById('agent-voice').value = 'en-US-Neural2-F';
    document.getElementById('agent-prompt').value = '';
    document.getElementById('agent-temperature').value = '0.7';
    document.getElementById('agent-modal').style.display = 'flex';
}

function editAgent(id) {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    editingAgentId = id;
    document.getElementById('modal-title').textContent = 'Edit AI Agent';
    document.getElementById('agent-name').value = agent.name;
    document.getElementById('agent-voice').value = agent.voice;
    document.getElementById('agent-prompt').value = agent.prompt;
    document.getElementById('agent-temperature').value = agent.temperature;
    document.getElementById('agent-modal').style.display = 'flex';
}

function closeAgentModal() {
    document.getElementById('agent-modal').style.display = 'none';
    editingAgentId = null;
}

async function saveAgent() {
    const name = document.getElementById('agent-name').value;
    const voice = document.getElementById('agent-voice').value;
    const prompt = document.getElementById('agent-prompt').value;
    const temperature = parseFloat(document.getElementById('agent-temperature').value);

    if (!name || !prompt) {
        alert('Please fill in all required fields');
        return;
    }

    const agentData = { name, voice, prompt, temperature };

    try {
        let response;
        if (editingAgentId) {
            // Update existing agent
            response = await fetch(`/api/agents/${editingAgentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agentData)
            });
        } else {
            // Create new agent
            response = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agentData)
            });
        }

        if (response.ok) {
            closeAgentModal();
            loadAgents();
        } else {
            // If API doesn't exist, simulate locally
            if (editingAgentId) {
                const index = agents.findIndex(a => a.id === editingAgentId);
                agents[index] = { ...agents[index], ...agentData };
            } else {
                agents.push({
                    id: Date.now().toString(),
                    ...agentData,
                    created_at: new Date().toISOString()
                });
            }
            closeAgentModal();
            renderAgents();
        }
    } catch (error) {
        console.error('Error saving agent:', error);
        // Fallback to local storage
        if (editingAgentId) {
            const index = agents.findIndex(a => a.id === editingAgentId);
            agents[index] = { ...agents[index], ...agentData };
        } else {
            agents.push({
                id: Date.now().toString(),
                ...agentData,
                created_at: new Date().toISOString()
            });
        }
        closeAgentModal();
        renderAgents();
    }
}

async function deleteAgent(id) {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
        const response = await fetch(`/api/agents/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadAgents();
        } else {
            // Fallback to local deletion
            agents = agents.filter(a => a.id !== id);
            renderAgents();
        }
    } catch (error) {
        console.error('Error deleting agent:', error);
        agents = agents.filter(a => a.id !== id);
        renderAgents();
    }
}
