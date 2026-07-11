# 📦 File Storage System - Paliwanag

## ❓ Nase-save ba sa Database ang Files?

**HINDI.** Ganito ang nangyayari:

```
┌─────────────────────────────────────────────┐
│                                             │
│  1. Mentor uploads video (500MB)           │
│           ↓                                 │
│  2. File → Supabase STORAGE (Cloud)        │
│           ↓                                 │
│  3. Storage generates URL                  │
│           ↓                                 │
│  4. URL lang ang nase-save sa DATABASE     │
│                                             │
└─────────────────────────────────────────────┘
```

## 🗄️ Dalawang Storage System:

### 1. **Supabase Storage** (File Storage)
**Ano ang naka-store:**
- ✅ Actual files (videos, PDFs, documents)
- ✅ Large files
- ✅ Binary data

**Example:**
```
learning-materials/
├─ user-123/
│  ├─ video-abc.mp4 (500MB)
│  ├─ document-xyz.pdf (5MB)
│  └─ slides-123.pptx (10MB)
```

### 2. **Supabase Database** (PostgreSQL)
**Ano ang naka-store:**
- ✅ File metadata (info lang)
- ✅ File URL (link to storage)
- ✅ Title, description
- ✅ Progress tracking

**Example:**
```sql
learning_materials table:
id: "uuid-123"
title: "Introduction to HTML"
file_url: "https://supabase.co/.../video-abc.mp4"  ← Link lang!
file_name: "intro-html.mp4"
file_type: "video"
file_size: 524288000  ← Number lang (bytes)
```

## 💾 Storage vs Database:

| Aspect | Storage | Database |
|--------|---------|----------|
| **Purpose** | Store large files | Store data/info |
| **Content** | Videos, PDFs, Images | Text, numbers, links |
| **Size** | GB (gigabytes) | KB (kilobytes) |
| **Speed** | Slower (download) | Fast (query) |
| **Cost** | Per GB | Per row/query |

## 📊 File Size Limits:

### Supabase Free Plan:
```
Total Storage: 1GB
Per File: 50MB max
Bandwidth: 2GB/month

Good for:
✅ PDFs (usually 2-10MB)
✅ Documents (1-5MB)
✅ Compressed videos (20-50MB)
✅ Images (1-5MB)

NOT good for:
❌ Long HD videos (>50MB)
❌ Large archives
❌ High-res videos
```

### Supabase Pro Plan ($25/month):
```
Total Storage: 100GB
Per File: 5GB max
Bandwidth: 200GB/month

Good for:
✅ Everything above PLUS
✅ Long videos (up to 5GB)
✅ HD content
✅ Large file archives
✅ High-quality materials
```

## ⚡ Ano ang Ginawa sa Code:

Added **file size validation**:

```typescript
// Before upload, check size
const maxSize = 50 * 1024 * 1024; // 50MB

if (file.size > maxSize) {
  alert('File too large! Max 50MB');
  return;
}
```

**Benefits:**
- ✅ Prevents upload ng sobrang laki
- ✅ Saves bandwidth
- ✅ Better user experience
- ✅ Shows helpful error message

## 💡 Best Practices:

### Para sa Videos:

**Option 1: Compress Video**
```bash
Tools:
- Handbrake (free, desktop)
- FFmpeg (command line)
- Online compressors

Settings:
- Resolution: 720p (not 4K)
- Bitrate: 1-2 Mbps
- Format: MP4 (H.264)

Result:
Original: 500MB → Compressed: 50MB ✅
```

**Option 2: External Hosting**
```javascript
// Upload to YouTube (unlisted)
// Or Vimeo, Google Drive, etc.
// Then just save the link

file_url: "https://youtube.com/embed/abc123"
file_type: "video_external"

Benefits:
✅ Free unlimited storage
✅ Professional video player
✅ Fast streaming
✅ No Supabase limits
```

**Option 3: Upgrade Plan**
```
Supabase Pro: $25/month
✅ 100GB storage
✅ 5GB per file
✅ Good for serious courses
```

### Para sa PDFs/Documents:
```
Usually no problem!
- PDFs: 2-10MB (small)
- DOCX: 1-5MB (tiny)
- PPTX: 5-20MB (medium)

All within 50MB limit ✅
```

## 📈 Cost Estimation:

### Example Course:

**Small Course (Free tier OK):**
```
10 videos × 30MB = 300MB
5 PDFs × 5MB = 25MB
Total: 325MB ✅

Cost: FREE (within 1GB limit)
```

**Medium Course (Upgrade recommended):**
```
20 videos × 100MB = 2GB
10 PDFs × 5MB = 50MB
Total: 2.05GB ❌ (exceeds free)

Cost: $25/month (Pro plan)
```

**Large Course (Use external hosting):**
```
50 videos × 200MB = 10GB
15 PDFs × 10MB = 150MB
Total: 10.15GB

Options:
1. Pro plan ($25/month) ✅
2. YouTube + Supabase (mostly FREE) ✅
```

## 🔄 Upload Flow:

```
User clicks "Upload Material"
        ↓
Select file (checks size)
        ↓
Size OK? → Continue
Size too big? → Show error
        ↓
Upload to Supabase Storage
        ↓
Get public URL
        ↓
Save URL + metadata to Database
        ↓
Done! ✅
```

## 🛡️ Security:

**Storage:**
- ✅ Files organized by user ID
- ✅ Public read (for viewing)
- ✅ Authenticated write (for uploading)
- ✅ Users can only delete their own

**Database:**
- ✅ RLS policies
- ✅ Mentors manage own materials
- ✅ Mentees view connected mentors only

## 📱 Access Speed:

```
Local file: Instant (1ms)
        ↓
Supabase Storage: Fast (100-500ms)
        ↓
Database query: Very fast (10-50ms)

Combined: Good user experience ✅
```

## ✅ Summary:

### Sa Database:
```sql
-- Just text/numbers (very light)
{
  id: "123",
  title: "HTML Course",
  file_url: "https://...",  ← Link lang!
  file_size: 52428800,       ← Number lang!
  order_number: "1.1"
}
```

### Sa Storage:
```
-- Actual heavy files
learning-materials/
└─ user-123/
   └─ video.mp4  ← 500MB actual file here
```

**Kaya hindi nag-slow ang database!** 

Database = Fast queries (just links)
Storage = File downloads (separate)

---

## 🎓 Recommendation:

Para sa typical mentoring platform:

1. **Start with FREE plan**
   - Compress videos to <50MB
   - Perfect for PDFs and docs
   
2. **If need more, options:**
   - Upgrade to Pro ($25/month)
   - OR use YouTube for videos (free)
   - OR combination (PDFs in Supabase, videos in YouTube)

3. **Best combo (recommended):**
   ```
   Videos → YouTube (unlisted) = FREE ✅
   PDFs/Docs → Supabase = FREE ✅
   Database → Supabase = FREE ✅
   
   Total cost: $0/month! 🎉
   ```

**Current implementation:** 
- ✅ 50MB file size limit
- ✅ Warning message if too large
- ✅ Helpful tips for users
- ✅ Ready to use!
