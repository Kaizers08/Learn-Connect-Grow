# Deploy Edge Function for Account Deletion

## How to Deploy the delete-user Edge Function

### Prerequisites:
1. Supabase account with a project
2. Supabase CLI installed: `npm install -g supabase`

### Steps:

#### 1. Initialize Supabase (if not done yet)
```bash
cd supabase
supabase init
```

#### 2. Link to your Supabase project
```bash
supabase link --project-ref your_project_ref
```
Replace `your_project_ref` with your actual Supabase project reference ID.

#### 3. Deploy the edge function
```bash
supabase functions deploy delete-user
```

#### 4. Verify deployment
The function should be available at:
```
https://your-project-ref.supabase.co/functions/v1/delete-user
```

### How it works:

The `delete-user` edge function:
1. Accepts a POST request with Authorization header (Bearer token)
2. Verifies the user's token
3. Deletes all user data from:
   - mentee_profiles
   - mentor_profiles
   - connections
   - admins
4. Deletes the auth user account
5. Returns success/error response

### Testing:

After deployment, test the function by:
1. Going to Dashboard → Settings → Account → Delete Account
2. Enter your password
3. Click "Delete Account"
4. ✅ Account should be deleted completely

### Troubleshooting:

If you get an error:
- Check that the function is deployed: `supabase functions list`
- Check function logs: `supabase functions delete delete-user --dry-run`
- Make sure SUPABASE_SERVICE_ROLE_KEY is available in edge function environment

---

**Note:** The edge function uses Supabase service role key to perform admin operations like deleting auth users. This is why it must run on the server-side (edge function), not client-side.
