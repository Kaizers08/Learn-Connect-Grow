# OTP Email Verification Setup Guide

This guide will help you set up email verification with OTP (One-Time Password) using Brevo for the MentDev registration flow.

## Overview

The OTP system includes:
- ✅ Beautiful OTP modal component with 6-digit input
- ✅ Brevo email integration for sending verification codes
- ✅ Supabase Edge Functions for secure OTP handling
- ✅ Database table for OTP storage with expiration
- ✅ Automatic resend functionality with countdown timer
- ✅ Rate limiting (max 5 attempts per OTP)

## Prerequisites

1. **Brevo Account** (formerly Sendinblue)
   - Sign up at https://www.brevo.com
   - Free tier includes 300 emails/day
   
2. **Supabase Project**
   - Already configured in your project

## Setup Steps

### 1. Create Brevo Account and Get API Key

1. Go to https://www.brevo.com and sign up
2. Navigate to **Settings** → **API Keys**
3. Click **Generate a new API key**
4. Copy the API key (it starts with `xkeysib-`)
5. Verify your sender email address in Brevo

### 2. Set Up Supabase Secrets

Add your Brevo credentials to Supabase:

```bash
# Navigate to your project
cd C:\Users\jaire\Learn-Connect-Grow

# Set Brevo API key
supabase secrets set BREVO_API_KEY="your-brevo-api-key-here"

# Set sender email (must be verified in Brevo)
supabase secrets set BREVO_SENDER_EMAIL="noreply@yourdomain.com"
```

**For local development**, create a `.env` file in the `supabase/functions` directory:

```bash
BREVO_API_KEY=your-brevo-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Database Table

Run the migration to create the `email_otps` table:

```bash
# Apply the migration
supabase db push

# Or run the SQL directly in Supabase Dashboard
# Navigate to SQL Editor and paste the contents of:
# supabase/migrations/create_email_otps_table.sql
```

### 4. Deploy Edge Functions

Deploy the two Edge Functions:

```bash
# Deploy send-otp-email function
supabase functions deploy send-otp-email

# Deploy verify-otp function
supabase functions deploy verify-otp
```

### 5. Test the Functions Locally (Optional)

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve send-otp-email --env-file supabase/functions/.env
supabase functions serve verify-otp --env-file supabase/functions/.env

# Test send OTP
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-otp-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","name":"Test User"}'

# Test verify OTP
curl -i --location --request POST 'http://localhost:54321/functions/v1/verify-otp' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","otp":"123456"}'
```

## How It Works

### Registration Flow

1. **User fills registration form** → Enters name, email, password
2. **Clicks "Sign Up"** → Form validation runs
3. **OTP email sent** → Brevo sends 6-digit code to user's email
4. **OTP modal appears** → User enters the 6-digit code
5. **Code verified** → Backend checks if code matches and hasn't expired
6. **Account created** → Supabase Auth account is created
7. **Redirect to profile** → User continues to complete their profile

### Security Features

- **10-minute expiration** - OTP codes expire after 10 minutes
- **Rate limiting** - Maximum 5 attempts per OTP code
- **One-time use** - Each OTP can only be verified once
- **Email verification** - Ensures user owns the email address
- **Secure storage** - OTPs stored in Supabase with RLS policies

## Database Schema

The `email_otps` table stores:

```sql
{
  id: UUID (primary key)
  email: TEXT (unique)
  otp_code: TEXT (6-digit code)
  expires_at: TIMESTAMPTZ (10 minutes from creation)
  attempts: INTEGER (failed verification attempts)
  verified: BOOLEAN (whether OTP was successfully verified)
  verified_at: TIMESTAMPTZ (when verification succeeded)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

## Email Template

The OTP email includes:
- Professional MentDev branding
- Large, easy-to-read 6-digit code
- Expiration warning (10 minutes)
- Security reminder (don't share code)
- Responsive design for mobile devices

## Customization

### Change OTP Expiration Time

Edit `supabase/functions/send-otp-email/index.ts`:

```typescript
// Change from 10 minutes to 15 minutes
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
```

### Change Max Attempts

Edit `supabase/functions/verify-otp/index.ts`:

```typescript
// Change from 5 to 3 attempts
if (otpRecord.attempts >= 3) {
  // ...
}
```

### Customize Email Design

Edit the `htmlContent` in `supabase/functions/send-otp-email/index.ts` to match your branding.

### Change OTP Length

To use 4 or 8 digits instead of 6:

1. Update OTP generation in `send-otp-email/index.ts`:
   ```typescript
   const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
   ```

2. Update validation in `verify-otp/index.ts`:
   ```typescript
   if (!/^\d{4}$/.test(otp)) { // 4 digits
   ```

3. Update `otp-modal.component.ts`:
   ```typescript
   otp = ['', '', '', '']; // 4 inputs
   ```

## Troubleshooting

### Email Not Received

1. **Check Brevo dashboard** - View email logs to see if sent
2. **Check spam folder** - OTP emails might be marked as spam
3. **Verify sender email** - Must be verified in Brevo
4. **Check API key** - Ensure it's correctly set in Supabase secrets
5. **Check quota** - Free tier has 300 emails/day limit

### "Failed to send OTP" Error

1. **Check Supabase logs** - Functions → Logs in Supabase dashboard
2. **Verify secrets** - Run `supabase secrets list`
3. **Test Brevo API** - Use curl to test Brevo directly:
   ```bash
   curl --request POST \
     --url https://api.brevo.com/v3/smtp/email \
     --header 'api-key: YOUR_BREVO_API_KEY' \
     --header 'content-type: application/json' \
     --data '{"sender":{"email":"test@example.com"},"to":[{"email":"user@example.com"}],"subject":"Test","htmlContent":"<p>Test</p>"}'
   ```

### "Invalid OTP" Error

1. **Check expiration** - OTP expires after 10 minutes
2. **Case sensitivity** - OTP is case-sensitive (numbers only)
3. **Check attempts** - Max 5 attempts before OTP is locked
4. **Database sync** - Verify OTP exists in `email_otps` table

### Function Deployment Issues

```bash
# Check function logs
supabase functions logs send-otp-email
supabase functions logs verify-otp

# Redeploy with debugging
supabase functions deploy send-otp-email --debug
```

## Maintenance

### Clean Up Expired OTPs

Run this periodically (can be automated with a cron job):

```sql
SELECT cleanup_expired_otps();
```

Or set up a Supabase pg_cron job:

```sql
SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 2 * * *', -- Run at 2 AM daily
  $$SELECT cleanup_expired_otps();$$
);
```

## Production Checklist

Before going live:

- [ ] Brevo API key added to Supabase secrets
- [ ] Sender email verified in Brevo
- [ ] Database migration applied
- [ ] Both Edge Functions deployed
- [ ] Test complete registration flow
- [ ] Check email deliverability
- [ ] Monitor Brevo usage (free tier limits)
- [ ] Set up OTP cleanup cron job
- [ ] Update email template with production domain
- [ ] Configure proper error monitoring

## Support

For issues:
1. Check Supabase function logs
2. Check Brevo email logs
3. Verify database records in `email_otps` table
4. Review Edge Function code for debugging

## Files Created

```
src/app/components/otp-modal/
├── otp-modal.component.ts
├── otp-modal.component.html
└── otp-modal.component.css

supabase/functions/
├── send-otp-email/
│   └── index.ts
└── verify-otp/
    └── index.ts

supabase/migrations/
└── create_email_otps_table.sql

Updated files:
- src/app/pages/register/register.ts
- src/app/pages/register/register.html
```

## Next Steps

After setup, you can:
1. Customize the email template colors and branding
2. Add email templates for different languages
3. Implement SMS OTP as an alternative
4. Add analytics tracking for OTP conversion rates
5. Set up email bounce handling

---

**Note**: The OTP system is fully functional and ready to use once you complete the Brevo setup!
