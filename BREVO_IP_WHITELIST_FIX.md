# Fix: Brevo IP Whitelist Issue

## Problem
Brevo API returns: `"We have detected you are using an unrecognised IP address"`

This happens because Brevo requires you to whitelist IP addresses that can use your API key. Your Supabase Edge Functions run on Supabase's servers, not your local machine.

## Solution Options

### Option 1: Disable IP Restriction (Recommended for Development)

1. Go to Brevo Dashboard: https://app.brevo.com/
2. Navigate to **Settings** → **Security** → **Authorized IPs**
3. Click **"Disable IP address filtering"** or remove all IP restrictions
4. Save changes

This allows the API key to work from any IP address (including Supabase Edge Functions).

⚠️ **Note**: This is less secure but fine for development/testing.

---

### Option 2: Whitelist Supabase Edge Function IPs

Supabase Edge Functions run on Deno Deploy infrastructure. You need to whitelist their IP ranges.

**Deno Deploy IP Ranges** (as of 2024):
- These IPs change dynamically based on region
- Supabase doesn't provide a fixed IP list for Edge Functions

**Steps:**
1. Temporarily disable IP filtering to get the function working
2. Check Brevo logs to see which IP addresses are making requests
3. Add those IPs to your whitelist

**To find the actual IP being used:**
```bash
# Check Brevo dashboard logs after making a request
# The error message will show the IP address (e.g., 136.158.62.37)
```

---

### Option 3: Use a Different Email Service (Alternative)

If IP whitelisting is too restrictive, consider:

**Resend** (https://resend.com/)
- No IP restrictions
- 100 emails/day free
- Simple API
- Better for serverless functions

**SendGrid**
- 100 emails/day free
- No IP restrictions on free tier
- Reliable delivery

**AWS SES** (via Supabase)
- Needs AWS account
- Very reliable
- More complex setup

---

## Quick Fix Steps

### For Now (Development):
1. Visit: https://app.brevo.com/security/authorised_ips
2. Click **"Disable IP filtering"**
3. Test your OTP flow again

### For Production:
- Re-enable IP filtering
- Add specific IPs from Brevo logs
- Or switch to a serverless-friendly email service

---

## Test After Fix

1. Go to http://localhost:4200/register
2. Fill out the form with your email
3. Click "Sign Up"
4. You should receive an OTP email within seconds
5. Check your inbox (including spam folder)

---

## Alternative: Switch to Resend API

If you want to avoid IP issues entirely, I can help you switch to Resend:

1. Sign up at https://resend.com/
2. Get API key (starts with `re_`)
3. Update Edge Function to use Resend instead of Brevo
4. Much simpler API, no IP restrictions

Let me know if you want to switch!
