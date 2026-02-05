# Live Call Testing Dashboard - User Guide

## 🎯 Overview

Your AI Calling Agent now has a **Live Call Testing Dashboard** where you can test calls directly from your browser and see real-time transcription!

## 🚀 How to Access

1. Go to: `https://ai-calling-agent-q1qf.onrender.com/dashboard/live-test.html`
2. Or click **"Live Testing"** in the sidebar

## 📋 Features

### 1. **Agent Configuration** (Top Section)
- **System Prompt**: Customize what the AI says and how it behaves
- **Voice**: Select from different Telnyx voices
- **Model**: Choose between GPT-4 Turbo or GPT-3.5 Turbo

### 2. **Test Call Panel** (Left Side)
- **Phone Number**: Enter the number to call
- **From Number**: Your Telnyx phone number
- **Start Test Call**: Click to initiate the call
- **Hang Up**: End the call
- **Call Status**: See if call is Idle, Calling, Connected, or Ended
- **Duration**: Live call timer

### 3. **Live Transcription** (Right Side)
- See messages in real-time as the conversation happens
- 👤 Human messages (blue background)
- 🤖 AI messages (purple background)
- Timestamps for each message
- Confidence scores

### 4. **Call Analytics** (Bottom Section)
- **Messages**: Total message count
- **Avg Response Time**: How fast the AI responds
- **Est. Cost**: Estimated cost of the call
- **Call ID**: Unique identifier for the call

## 🧪 How to Test

### Step 1: Configure Your Agent
1. Edit the **System Prompt** to customize AI behavior
2. Select a **Voice** (e.g., Neural2 C for female voice)
3. Choose a **Model** (GPT-4 for best quality, GPT-3.5 for lower cost)

### Step 2: Enter Phone Numbers
1. **Phone Number**: The number you want to call (your phone)
2. **From Number**: Your Telnyx phone number

### Step 3: Start the Call
1. Click **"Start Test Call"**
2. Wait for your phone to ring
3. Answer the call
4. Start talking!

### Step 4: Watch Live Transcription
- As you speak, you'll see your words appear in the **Live Transcription** panel
- The AI's responses will appear immediately after
- Watch the conversation unfold in real-time!

### Step 5: End the Call
- Click **"Hang Up"** when done
- Review the full conversation transcript
- Check the analytics

## 💡 Tips

### For Best Results:
- **Speak clearly** - Better transcription accuracy
- **Wait for AI** - Let the AI finish speaking before you respond
- **Short sentences** - Easier for the AI to process
- **Test different prompts** - Find the perfect AI personality

### Common Use Cases:
1. **Sales Agent**: "You are a friendly sales representative..."
2. **Support Agent**: "You are a helpful customer support agent..."
3. **Appointment Booking**: "You are an appointment scheduler..."
4. **Survey Collector**: "You are conducting a customer survey..."

## 🔧 Technical Details

### How It Works:
```
You click "Start Test Call"
    ↓
Backend calls Telnyx API
    ↓
Your phone rings
    ↓
You answer and speak
    ↓
Deepgram transcribes your speech
    ↓
OpenAI GPT-4 generates response
    ↓
Telnyx speaks the response
    ↓
WebSocket sends transcript to dashboard
    ↓
You see it live in the browser!
```

### WebSocket Connection:
- Automatically connects when call starts
- Receives real-time updates
- Shows transcription as it happens
- No page refresh needed!

## 🐛 Troubleshooting

### Issue: Call doesn't start
**Check:**
- Phone numbers are in correct format (+1234567890)
- Telnyx API key is configured
- From number is your Telnyx number

### Issue: No transcription appearing
**Check:**
- WebSocket connection is active (check browser console)
- Deepgram API key is configured
- Speaking clearly into phone

### Issue: AI doesn't respond
**Check:**
- OpenAI API key is configured
- OpenAI has sufficient quota
- System prompt is not empty

### Issue: "Connection error"
**Check:**
- Render deployment is running
- WebSocket URL is correct
- No firewall blocking WebSocket

## 📊 Understanding Analytics

### Messages
- Total number of messages exchanged
- Includes both human and AI messages

### Avg Response Time
- How long AI takes to respond
- Lower is better (< 2 seconds is good)

### Est. Cost
- Rough estimate based on tokens used
- GPT-4: ~$0.03 per 1K tokens
- GPT-3.5: ~$0.002 per 1K tokens

### Call ID
- Unique identifier for this call
- Use to look up call in database
- Useful for debugging

## 🎨 Customization

### Change AI Personality:
```
You are a [ROLE] for [COMPANY].

Your goals:
- [GOAL 1]
- [GOAL 2]

Guidelines:
- Be [PERSONALITY TRAIT]
- Always [BEHAVIOR]
- Never [AVOID]
```

### Example Prompts:

**Friendly Sales:**
```
You are an enthusiastic sales representative for TechCorp.
Your goal is to qualify leads and book demos.
Be friendly, professional, and ask qualifying questions.
```

**Professional Support:**
```
You are a customer support agent for HelpDesk Inc.
Your goal is to solve customer problems efficiently.
Be patient, empathetic, and solution-oriented.
```

**Appointment Scheduler:**
```
You are an appointment scheduler for MediClinic.
Your goal is to book appointments and collect patient info.
Be professional, efficient, and confirm all details.
```

## 🚀 Next Steps

1. ✅ Test with different prompts
2. ✅ Try different voices
3. ✅ Compare GPT-4 vs GPT-3.5
4. ✅ Monitor costs and response times
5. ✅ Refine your AI agent based on results

---

**Your live call testing dashboard is ready!** 🎉

Access it at: `https://ai-calling-agent-q1qf.onrender.com/dashboard/live-test.html`
