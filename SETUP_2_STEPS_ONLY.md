# 🚀 Setup - 2 Steps Lang!

## Step 1: Run SQL (1 minute)

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **"New Query"**
4. Copy paste lahat ng content ng file: `supabase/learning-materials-only.sql`
5. Click **"RUN"** ▶️
6. Wait for "Success" ✅

**Tapos na ang database!** 🎉

---

## Step 2: Create Storage Bucket (30 seconds)

1. Sa Supabase Dashboard
2. Click **"Storage"** (left sidebar)
3. Click **"New bucket"** button
4. Fill in:
   ```
   Name: learning-materials
   Public bucket: ✅ CHECK THIS!
   ```
5. Click **"Create bucket"**

**Tapos na lahat!** 🎉

---

## ✅ Verification

### Check if working:

1. **Login as mentor** sa app
2. Click **"Learning Materials"** sa sidebar
3. Click **"➕ Upload Material"**
4. Try upload a small file (e.g., PDF < 5MB)
5. Success? **ALL DONE!** ✅

---

## 🎯 That's it!

**2 simple steps lang:**
- ✅ Run SQL file
- ✅ Create storage bucket

**Ready to use na ang learning materials system!** 🚀

---

## 📞 Troubleshooting

### "Upload failed"
→ Check kung naka-create na ang storage bucket na "learning-materials"

### "Cannot see materials"
→ Check kung connected ang mentor at mentee (connections table)

### "SQL error"
→ Make sure previous schema updates are already applied (connections, feedback tables should exist)

---

## Files You Need:

```
supabase/learning-materials-only.sql  ← Run this in SQL Editor
```

**Yan lang!** Simple! 😊
