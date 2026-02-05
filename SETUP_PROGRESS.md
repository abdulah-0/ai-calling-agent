# Telnyx Setup - Step-by-Step Guide

## ✅ Completed Steps

- [x] Telnyx API Key obtained
- [x] Supabase database schema migrated
- [x] `.env` file updated with API key

---

## 🎯 Next Steps to Complete Setup

### Step 1: Create Telnyx Call Control Application

1. **Go to Telnyx Portal**: https://portal.telnyx.com
2. **Navigate to**: Voice → Call Control Applications
3. **Click**: "Create New Application"
4. **Configure**:
   - **Application Name**: `AI Calling Agent`
   - **Webhook URL**: Leave blank for now (we'll add it after deploying)
   - **Webhook API Version**: `V2`
   - **Failover URL**: (optional)
5. **Click**: "Save"
6. **Copy the Connection ID** (looks like: `1234567890`)

**⏳ ACTION NEEDED**: Please share your **Connection ID** once created.

---

### Step 2: Buy a Telnyx Phone Number (Optional for Testing)

1. **Go to**: Numbers → Buy Numbers
2. **Search** for a number in your desired location
3. **Click "Buy"** on your chosen number
4. **Note the phone number** (format: +1234567890)

**⏳ ACTION NEEDED**: Share your phone number if you bought one.

---

### Step 3: Create Default Organization in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Create default organization
INSERT INTO organizations (name, is_active)
VALUES ('Default Organization', true)
RETURNING id;

-- Copy the returned UUID and use it as DEFAULT_ORG_ID
```

**⏳ ACTION NEEDED**: Share the organization UUID.

---

### Step 4: Install Redis (Local Development)

#### **Windows**:
```powershell
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

#### **Mac**:
```bash
brew install redis
brew services start redis
```

#### **Linux**:
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

#### **Or use Docker**:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## 📋 Current .env Status

```env
✅ SUPABASE_URL
✅ SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ TELNYX_API_KEY
⏳ TELNYX_CONNECTION_ID (waiting)
⏳ TELNYX_PHONE_NUMBER (optional)
✅ OPENAI_API_KEY
⏳ DEFAULT_ORG_ID (waiting)
✅ REDIS_URL (default: localhost)
```

---

## 🚀 Once You Provide Connection ID & Org ID

I will:
1. ✅ Update `.env` file
2. ✅ Build the project
3. ✅ Start the development server
4. ✅ Test the setup
5. ✅ Guide you through making your first test call

---

## 📞 What to Share Next

Please provide:

1. **Telnyx Connection ID**: (from Call Control Application)
2. **Organization UUID**: (from Supabase SQL query)
3. **Phone Number** (optional): If you bought one

---

## 🆘 Need Help?

- **Telnyx Portal**: https://portal.telnyx.com
- **Telnyx Docs**: https://developers.telnyx.com/docs/voice/programmable-voice/get-started
- **Supabase Dashboard**: https://supabase.com/dashboard/project/ubkswpetsqvmgdyuaben
