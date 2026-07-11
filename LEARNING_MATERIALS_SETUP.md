# Learning Materials Feature Setup

## Ang Ginawa Natin

Gumawa tayo ng comprehensive learning materials management system para sa mentors at mentees:

### ✅ Database Schema
- **`learning_materials`** table - Para sa storage ng learning materials info
- **`material_progress`** table - Para sa tracking ng mentee progress
- Automatic policies para sa security (mentors manage, connected mentees view)

### ✅ Features

#### Para sa Mentors:
1. **Upload Learning Materials**
   - Pwedeng mag-upload ng videos, PDFs, documents, etc.
   - Organized numbering system (1.1, 1.2, 1.3, 2.1, 2.2, etc.)
   - May title, description, at duration
   
2. **Manage Materials**
   - Edit material details
   - Delete materials
   - View materials

3. **Track Mentee Progress**
   - Makikita ang progress ng bawat mentee
   - Progress bar showing completion percentage
   - Lista ng completed at total materials
   - Color-coded progress (red < 25%, orange < 50%, blue < 75%, green ≥ 75%)

#### Para sa Mentees:
1. **View Learning Materials**
   - Makikita lahat ng materials from connected mentors
   - Organized by order number
   - May file type icons (🎥 video, 📄 PDF, 📝 document, etc.)

2. **Track Own Progress**
   - Checkbox para i-mark as complete ang material
   - Overall progress bar
   - Completion percentage
   - Celebration message pag 100% complete

### ✅ UI/UX
- Beautiful gradient cards
- Responsive design
- Professional color scheme
- Smooth animations
- Modal dialogs for upload/edit

## Setup Instructions

### 1. Database Setup

I-run ang updated schema sa Supabase SQL Editor:

```bash
# Navigate to Supabase Dashboard
# Go to: SQL Editor -> New Query
# Copy paste ang content ng: supabase/schema.sql
# I-run ang query
```

### 2. Storage Bucket Setup

Kailangan gumawa ng storage bucket para sa file uploads:

#### Sa Supabase Dashboard:

1. **Go to Storage**
   - Click "Storage" sa left sidebar

2. **Create New Bucket**
   - Click "New bucket"
   - Bucket name: `learning-materials`
   - Public bucket: ✅ **Check** (para ma-access ng users)
   - Click "Create bucket"

3. **Set Up Bucket Policies** (OPTIONAL - kung gusto mo ng custom policies)
   
   ```sql
   -- Allow authenticated users to upload
   create policy "Authenticated users can upload"
   on storage.objects for insert
   to authenticated
   with check (bucket_id = 'learning-materials');

   -- Allow public to read/download files
   create policy "Public can view files"
   on storage.objects for select
   to public
   using (bucket_id = 'learning-materials');

   -- Allow owners to delete their files
   create policy "Users can delete own files"
   on storage.objects for delete
   to authenticated
   using (bucket_id = 'learning-materials');
   ```

### 3. Testing

#### Test as Mentor:
1. Login as mentor account
2. Click "Learning Materials" sa sidebar
3. Click "Upload Material"
4. Fill in:
   - Order: 1.1
   - Title: "Introduction to Programming"
   - Description: "Learn the basics"
   - Duration: 30
   - Upload a test file
5. Click "Upload"
6. Material dapat lumabas sa list

#### Test as Mentee:
1. Login as mentee account connected sa mentor
2. Click "Learning Materials" sa sidebar
3. Dapat makita ang materials from mentor
4. Click checkbox para i-mark as complete
5. Progress bar dapat mag-update

### 4. File Types Supported

Ang system ay sumusuporta ng:
- **Videos**: mp4, mov, avi, mkv, webm
- **Documents**: pdf, doc, docx, txt, ppt, pptx
- **Images**: jpg, jpeg, png, gif

### 5. Navigation

Naka-integrate na sa dashboard:
- New sidebar item: "Learning Materials" with 📚 icon
- Direct link: `/learning-materials`
- Available for both mentors and mentees

## Database Tables Structure

### learning_materials
```sql
- id (uuid)
- mentor_user_id (uuid) - FK to auth.users
- title (text)
- description (text)
- order_number (text) - e.g., "1.1", "1.2", "2.1"
- file_url (text)
- file_type (text) - "video", "pdf", "document", etc.
- file_name (text)
- duration_minutes (integer)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### material_progress
```sql
- id (uuid)
- mentee_user_id (uuid) - FK to auth.users
- material_id (uuid) - FK to learning_materials
- completed (boolean)
- completed_at (timestamptz)
- created_at (timestamptz)
```

## Features in Detail

### Ordering System
- Numbering format: `[Major].[Minor]`
- Examples: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1
- Auto-suggests next order number
- Mentors can customize order numbers

### Progress Tracking
- Real-time progress updates
- Percentage calculation: `(completed / total) * 100`
- Visual progress bars with color coding
- Individual tracking per mentee

### File Management
- Secure upload to Supabase Storage
- Unique file names to prevent conflicts
- File type detection based on extension
- Public URLs for easy access

## Security

✅ **RLS Policies:**
- Mentors can only manage their own materials
- Mentees can only view materials from connected mentors
- Progress tracking is private per mentee
- Mentors can view progress of their connected mentees

## Next Steps / Improvements

Pwede pang idagdag:
1. **Video player** - Embedded player para hindi lumabas ng site
2. **PDF viewer** - Preview PDFs without downloading
3. **Comments** - Mentees can ask questions per material
4. **Quiz system** - Assessments after each module
5. **Certificates** - Auto-generate upon completion
6. **Bulk upload** - Upload multiple files at once
7. **Categories** - Group materials by topic
8. **Prerequisites** - Require completion of earlier materials
9. **Due dates** - Set deadlines for completion
10. **Notifications** - Alert mentees about new materials

## Troubleshooting

### Error: "Failed to upload file"
- Check kung naka-create na ang `learning-materials` bucket
- Verify bucket permissions (public read, authenticated upload)

### Error: "Failed to fetch materials"
- Check RLS policies sa database
- Verify connections between mentor and mentee

### Materials not showing for mentee
- Ensure mentee is connected to mentor (connections table)
- Check connection status = 'connected'

## Files Created

```
src/app/pages/learning-materials/
├── learning-materials.ts       # Component logic
├── learning-materials.html     # Template
└── learning-materials.css      # Styles

supabase/
└── schema.sql                  # Updated with new tables

Other updates:
- app.routes.ts                 # Added route
- dashboard.html                # Added navigation item
```

---

**Tapos na! 🎉** 

Ang system ay ready na for testing. Just need to:
1. Run the schema updates sa Supabase
2. Create the storage bucket
3. Test uploading and progress tracking
