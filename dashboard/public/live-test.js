// Live Call Testing Dashboard JavaScript

let currentCallId = null;
let currentCallControlId = null;
let ws = null;
let callStartTime = null;
let durationInterval = null;
let messageCount = 0;
let responseTimes = [];

// Browser call specific
let callMode = 'phone'; // 'phone' or 'browser'
let mediaRecorder = null;
let audioStream = null;
let speechSynthesis = window.speechSynthesis;

// Audio playback setup
let audioContext = null;
let audioQueue = [];
let isPlayingAudio = false;

// Initialize Web Audio API
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🔊 Audio context initialized');
    }
    return audioContext;
}

// Play MP3 audio chunk
async function playAudioChunk(base64Audio) {
    try {
        const ctx = initAudioContext();

        // Decode base64 to array buffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

        // Create source and play
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);

        console.log('🔊 Playing audio chunk');

        // Wait for audio to finish
        return new Promise(resolve => {
            source.onended = resolve;
        });
    } catch (err) {
        console.error('Error playing audio:', err);
    }
}

// Process audio queue
async function processAudioQueue() {
    if (isPlayingAudio || audioQueue.length === 0) return;

    isPlayingAudio = true;
    while (audioQueue.length > 0) {
        const audioChunk = audioQueue.shift();
        await playAudioChunk(audioChunk);
    }
    isPlayingAudio = false;
}

// DOM Elements
const startCallBtn = document.getElementById('startCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const phoneNumber = document.getElementById('phoneNumber');
const fromNumber = document.getElementById('fromNumber');
const callStatus = document.getElementById('callStatus');
const callDuration = document.getElementById('callDuration');
const messagesContainer = document.getElementById('messagesContainer');
const statusMessage = document.getElementById('statusMessage');
const systemPrompt = document.getElementById('systemPrompt');
const voiceSelect = document.getElementById('voiceSelect');
const modelSelect = document.getElementById('modelSelect');
const messageCountEl = document.getElementById('messageCount');
const avgResponseTimeEl = document.getElementById('avgResponseTime');
const estimatedCostEl = document.getElementById('estimatedCost');
const currentCallIdEl = document.getElementById('currentCallId');

// Mode toggle elements (will be injected dynamically if not present)
let phoneModeBtn = document.getElementById('phoneMode');
let browserModeBtn = document.getElementById('browserMode');
let phoneInputs = document.getElementById('phoneInputs');
let browserInfo = document.getElementById('browserInfo');
const startBtnText = document.getElementById('startBtnText');

// Dynamically inject mode toggle UI if elements don't exist
if (!document.getElementById('phoneMode')) {
    const phoneNumberInput = document.getElementById('phoneNumber');
    if (phoneNumberInput) {
        const parentContainer = phoneNumberInput.closest('.flex.items-center.space-x-4');
        if (parentContainer) {
            // Create mode toggle HTML
            const modeToggleHTML = `
                <div class="flex flex-col">
                    <label class="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Call Mode</label>
                    <div class="flex bg-gray-800 rounded-lg p-1">
                        <button id="phoneMode" class="mode-toggle px-3 py-1 text-xs font-medium rounded transition-all bg-gray-700 text-white">
                            📞 Phone
                        </button>
                        <button id="browserMode" class="mode-toggle px-3 py-1 text-xs font-medium rounded transition-all text-gray-400 hover:text-white">
                            🌐 Browser
                        </button>
                    </div>
                </div>
                <div class="h-8 w-px bg-gray-700"></div>
            `;

            // Create browser info HTML
            const browserInfoHTML = `
                <div id="browserInfo" class="hidden flex items-center space-x-2 text-sm text-gray-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span>Using browser microphone</span>
                </div>
            `;

            // Wrap existing phone inputs
            const phoneInputsWrapper = document.createElement('div');
            phoneInputsWrapper.id = 'phoneInputs';
            phoneInputsWrapper.className = 'flex items-center space-x-4';

            // Move all children to wrapper
            while (parentContainer.firstChild) {
                phoneInputsWrapper.appendChild(parentContainer.firstChild);
            }

            // Insert mode toggle, wrapped phone inputs, and browser info
            parentContainer.innerHTML = modeToggleHTML;
            parentContainer.appendChild(phoneInputsWrapper);
            parentContainer.insertAdjacentHTML('beforeend', browserInfoHTML);
        }
    }
}

// Re-get elements after injection
phoneModeBtn = document.getElementById('phoneMode');
browserModeBtn = document.getElementById('browserMode');
phoneInputs = document.getElementById('phoneInputs');
browserInfo = document.getElementById('browserInfo');

// Mode Toggle Handlers
if (phoneModeBtn && browserModeBtn) {
    phoneModeBtn.addEventListener('click', () => {
        callMode = 'phone';
        phoneModeBtn.classList.add('bg-gray-700', 'text-white');
        phoneModeBtn.classList.remove('text-gray-400');
        browserModeBtn.classList.remove('bg-gray-700', 'text-white');
        browserModeBtn.classList.add('text-gray-400');

        if (phoneInputs) phoneInputs.classList.remove('hidden');
        if (browserInfo) browserInfo.classList.add('hidden');
        if (startBtnText) startBtnText.textContent = 'Start Test Call';
    });

    browserModeBtn.addEventListener('click', () => {
        callMode = 'browser';
        browserModeBtn.classList.add('bg-gray-700', 'text-white');
        browserModeBtn.classList.remove('text-gray-400');
        phoneModeBtn.classList.remove('bg-gray-700', 'text-white');
        phoneModeBtn.classList.add('text-gray-400');

        if (phoneInputs) phoneInputs.classList.add('hidden');
        if (browserInfo) browserInfo.classList.remove('hidden');
        if (startBtnText) startBtnText.textContent = 'Start Browser Call';
    });
}

// Load saved settings from localStorage
function loadSettings() {
    const savedFrom = localStorage.getItem('from_number');
    if (savedFrom && fromNumber) {
        fromNumber.value = savedFrom;
    }
}

// Save settings to localStorage
function saveSettings() {
    if (fromNumber) {
        localStorage.setItem('from_number', fromNumber.value);
    }
}

// Initialize
loadSettings();

// Start Call (Phone or Browser)
startCallBtn.addEventListener('click', async () => {
    if (callMode === 'browser') {
        await startBrowserCall();
    } else {
        await startPhoneCall();
    }
});

// Start Phone Call
async function startPhoneCall() {
    const to = phoneNumber.value.trim();
    const from = fromNumber.value.trim();

    if (!to || !from) {
        showStatus('Please enter both phone numbers', 'error');
        return;
    }

    try {
        startCallBtn.disabled = true;
        showStatus('Initiating call...', 'info');

        const response = await fetch('/api/test-call/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to,
                from,
                agentConfig: {
                    prompt: systemPrompt.value,
                    voice: voiceSelect.value,
                    model: modelSelect.value
                }
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('Call initiated! Waiting for answer...', 'success');
            updateCallStatus('calling');
            saveSettings();

            currentCallId = 'temp_' + Date.now();
            currentCallIdEl.textContent = currentCallId;

            hangupBtn.disabled = false;
            hangupBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'border-red-500/50');
            hangupBtn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');
        } else {
            showStatus(`Error: ${data.error}`, 'error');
            startCallBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error starting call:', error);
        showStatus('Error connecting to server', 'error');
        startCallBtn.disabled = false;
    }
}

// Start Browser Call
async function startBrowserCall() {
    try {
        startCallBtn.disabled = true;
        showStatus('Requesting microphone access...', 'info');

        // Request microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000
            }
        });

        showStatus('Connecting to server...', 'info');

        // Connect to WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/browser-call`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Browser call WebSocket connected');

            // Get selected voice
            const voiceSelect = document.getElementById('voiceSelect');
            const selectedVoice = voiceSelect ? voiceSelect.value : 'AWS.Polly.Joanna-Neural';

            // Send start message with voice selection
            const startMessage = {
                type: 'start',
                greeting: "Hello! I'm an AI assistant. How can I help you today?",
                voice: selectedVoice
            };
            console.log('Sending start message:', startMessage);
            ws.send(JSON.stringify(startMessage));
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);
            try {
                const message = JSON.parse(event.data);
                handleBrowserCallMessage(message);
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            showStatus('Connection error', 'error');
            stopBrowserCall();
        };

        ws.onclose = (event) => {
            console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
            stopBrowserCall();
        };

        // Use AudioContext for raw PCM audio capture
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(audioStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const inputData = e.inputBuffer.getChannelData(0);

                // Convert Float32Array to Int16Array (PCM 16-bit)
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Send raw PCM audio
                console.log('🎤 Sending PCM audio chunk, size:', pcmData.byteLength);
                ws.send(pcmData.buffer);
            }
        };

        // Store for cleanup
        window.browserCallAudioContext = audioContext;
        window.browserCallProcessor = processor;

        updateCallStatus('connected');
        showStatus('Browser call active - speak now!', 'success');

        hangupBtn.disabled = false;
        hangupBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'border-red-500/50');
        hangupBtn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');

    } catch (error) {
        console.error('Error starting browser call:', error);
        showStatus('Error: ' + error.message, 'error');
        startCallBtn.disabled = false;
        stopBrowserCall();
    }
}

// Handle Browser Call Messages
function handleBrowserCallMessage(message) {
    console.log('Browser call message:', message);

    switch (message.type) {
        case 'connected':
            currentCallId = message.callId;
            currentCallIdEl.textContent = currentCallId;
            break;

        case 'started':
            console.log('Conversation started');
            break;

        case 'speak':
            // Display AI text (audio will come separately)
            if (message.data && message.data.text) {
                addMessage('ai', message.data.text);
            }
            break;

        case 'audio':
            // Play TTS audio chunk
            if (message.data) {
                console.log('🎵 Received audio chunk');
                audioQueue.push(message.data);
                processAudioQueue();
            }
            break;

        case 'transcript':
            // Display transcript
            addMessage(message.data);
            break;

        case 'error':
            showStatus('Error: ' + message.error, 'error');
            break;
    }
}

// Speak text using browser TTS
function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a natural voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural'));
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
}

// Stop Browser Call
function stopBrowserCall() {
    console.log('Stopping browser call...');

    // Clean up AudioContext
    if (window.browserCallProcessor) {
        window.browserCallProcessor.disconnect();
        window.browserCallProcessor = null;
    }

    if (window.browserCallAudioContext) {
        window.browserCallAudioContext.close();
        window.browserCallAudioContext = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }

    if (ws) {
        try {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'stop' }));
            }
            if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
                ws.close();
            }
        } catch (err) {
            console.error('Error closing WebSocket:', err);
        }
        ws = null;
    }

    speechSynthesis.cancel();

    startCallBtn.disabled = false;
    hangupBtn.disabled = true;
    hangupBtn.classList.add('opacity-50', 'cursor-not-allowed', 'border-red-500/50');
    hangupBtn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');

    updateCallStatus('ended');
}

// Hang Up Call
hangupBtn.addEventListener('click', async () => {
    if (callMode === 'browser') {
        stopBrowserCall();
    } else {
        if (!currentCallControlId) {
            showStatus('No active call to hang up', 'error');
            return;
        }

        try {
            const response = await fetch('/api/test-call/hangup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callControlId: currentCallControlId })
            });

            if (response.ok) {
                showStatus('Call ended', 'success');
                endCall();
            } else {
                const data = await response.json();
                showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Error hanging up:', error);
            showStatus('Error ending call', 'error');
        }
    }
});

// Update Call Status
function updateCallStatus(status) {
    const statusBadge = callStatus;
    const statusContainer = document.getElementById('callStatusContainer');

    statusBadge.className = 'status-badge';

    if (status === 'idle') {
        statusContainer.classList.add('hidden');
    } else {
        statusContainer.classList.remove('hidden');
    }

    switch (status) {
        case 'idle':
            statusBadge.classList.add('status-idle');
            statusBadge.textContent = 'Idle';
            break;
        case 'calling':
            statusBadge.classList.add('status-calling');
            statusBadge.textContent = 'Calling...';
            break;
        case 'connected':
            statusBadge.classList.add('status-connected');
            statusBadge.textContent = 'Connected';
            startCallTimer();
            break;
        case 'ended':
            statusBadge.classList.add('status-ended');
            statusBadge.textContent = 'Ended';
            stopCallTimer();
            break;
    }
}

// Start Call Timer
function startCallTimer() {
    callStartTime = Date.now();
    durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        callDuration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// Stop Call Timer
function stopCallTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
}

// End Call
function endCall() {
    updateCallStatus('ended');

    if (ws) {
        ws.close();
        ws = null;
    }

    startCallBtn.disabled = false;
    hangupBtn.disabled = true;
    hangupBtn.classList.add('opacity-50', 'cursor-not-allowed', 'border-red-500/50');
    hangupBtn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');

    currentCallId = null;
    currentCallControlId = null;
}

// Connect to WebSocket for live updates (phone mode)
function connectWebSocket(callId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-call/${callId}`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        showStatus('Live transcription connected', 'success');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        switch (message.type) {
            case 'connected':
                console.log('WebSocket connection confirmed');
                break;
            case 'transcript':
                addMessage(message.data);
                break;
            case 'status':
                updateCallStatus(message.data.status);
                break;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showStatus('Connection error', 'error');
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
    };
}

// Add Message to Transcription
function addMessage(data) {
    const { speaker, text, timestamp, confidence } = data;

    // Clear placeholder if this is the first message
    if (messageCount === 0) {
        messagesContainer.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message mb-4 p-3 rounded-lg ' + (speaker === 'human' ? 'bg-blue-900/30' : 'bg-purple-900/30');

    const time = new Date(timestamp).toLocaleTimeString();
    const icon = speaker === 'human' ? '👤' : '🤖';
    const label = speaker === 'human' ? 'Human' : 'AI';

    messageDiv.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl">${icon}</span>
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-semibold text-sm ${speaker === 'human' ? 'text-blue-400' : 'text-purple-400'}">${label}</span>
                    <span class="text-xs text-gray-500">${time}</span>
                    ${confidence < 1 ? `<span class="text-xs text-gray-500">(${Math.round(confidence * 100)}%)</span>` : ''}
                </div>
                <p class="text-white">${text}</p>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update analytics
    messageCount++;
    messageCountEl.textContent = messageCount;

    // Calculate estimated cost (rough estimate)
    const estimatedTokens = messageCount * 100; // Rough estimate
    const cost = (estimatedTokens / 1000) * 0.002; // GPT-4 pricing
    estimatedCostEl.textContent = `$${cost.toFixed(4)}`;
}

// Show Status Message
function showStatus(message, type = 'info') {
    const colors = {
        info: 'text-blue-400',
        success: 'text-green-400',
        error: 'text-red-400'
    };

    statusMessage.innerHTML = `<span class="${colors[type]}">${message}</span>`;

    setTimeout(() => {
        statusMessage.innerHTML = '';
    }, 5000);
}

console.log('Live Test Dashboard loaded');
