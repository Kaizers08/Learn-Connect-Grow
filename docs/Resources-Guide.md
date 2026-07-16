# Resources — Client Guide

**Platform:** Learn, Connect, Grow (EdTech Mentoring Platform)
**Feature:** Resources (Learning Materials / Library)
**Audience:** Client / Stakeholders

---

## 1. What it is

The **Resources** tab is where mentors share learning materials and mentees study them. Mentors upload videos, documents, and other files in a clear order. Mentees open those materials, mark items complete, and track their progress. Mentors can also see how far each connected mentee has gotten.

In the sidebar this tab is labeled **Resources**. On screen, mentors see **Learning Materials** and mentees see **Learning Resources**.

---

## 2. Where to find it

After logging in, open the **Dashboard** and click **Resources** in the left sidebar (book / library icon).

---

## 3. Mentor experience

### What mentors can do

- Upload learning materials for connected mentees
- View, edit, and delete their materials
- See quick stats: total materials, number of mentees, total minutes
- Track each mentee’s progress (percentage and completed count)
- Open a mentee’s progress report to see which items are done or not

### Quick stats (top of the page)

| Stat | Meaning |
|------|---------|
| **Materials** | How many learning items the mentor has uploaded |
| **Mentees** | How many connected mentees are being tracked |
| **Total Minutes** | Sum of all material durations the mentor set |

### Uploading a material (step by step)

1. Go to **Dashboard → Resources**.
2. Click **Upload Material** (or **Add Material** if materials already exist).
3. Fill in the form:
   - **Order Number** (required) — e.g. `1.1`, `1.2`, `2.1` so lessons stay in sequence. The form suggests the next number automatically.
   - **Duration (minutes)** (optional) — estimated time to complete
   - **Title** (required)
   - **Description** (optional)
   - **File** (required) — choose a file to upload
4. Click **Upload Material** and wait until it finishes.

### Allowed file types and size

| Allowed | Examples |
|---------|----------|
| Video | Common video formats |
| PDF | `.pdf` |
| Documents | Word (`.doc`, `.docx`), PowerPoint (`.ppt`, `.pptx`), Text (`.txt`) |

**Maximum file size:** **50 MB** per file. Larger files are blocked with a tip to compress (especially videos).

### Managing materials

For each uploaded item, mentors can:

| Action | What it does |
|--------|----------------|
| **View** | Opens the file in a new browser tab |
| **Edit** | Change title, description, order number, and duration |
| **Delete** | Permanently remove the material (with confirmation). Also removes it for mentees |

**Note:** Editing does **not** replace the file. To change the file, delete the material and upload a new one.

### Tracking mentee progress

On the right side, mentors see **Mentee Progress** cards for each connected mentee:

- Progress bar and percentage
- Completed count (e.g. `3 / 10 completed`)
- A **Completed** badge when a mentee reaches 100%

Click a mentee card to open a **Progress Report** listing every material with a done / not-done status, plus View / Edit / Delete shortcuts.

If no mentees are connected yet, the panel explains that progress will appear after connections are made.

---

## 4. Mentee experience

### What mentees can do

- See cards for each **connected mentor**
- View that mentor’s learning materials in order
- Open / download materials (View)
- Mark materials as **complete** with a checkbox
- See their own progress percentage per mentor

### What mentees cannot do

- Upload, edit, or delete materials (mentor-only)
- Access materials from mentors they are **not** connected to

### Using resources (step by step)

1. Go to **Dashboard → Resources**.
2. Under **Your Mentors**, click a mentor card.
3. A popup lists that mentor’s materials in order (`1.1`, `1.2`, etc.).
4. Click **View** to open a file.
5. Check the box next to a material when finished — progress updates right away.
6. The footer shows overall progress (e.g. `2 / 5 completed (40%)`).

### Mentor cards (mentee home view)

Each mentor card shows:

- Mentor name, photo, and expertise
- **Your Progress** bar and percentage
- Completed count
- Badge: **No materials yet**, or **Completed** at 100%

If the mentee has no connections, the page prompts them to connect with mentors first.

---

## 5. How mentor vs mentee views differ

| | **Mentor** | **Mentee** |
|---|-----------|-----------|
| **Page title** | Learning Materials | Learning Resources |
| **Upload materials** | Yes | No |
| **Edit / delete** | Yes (own materials) | No |
| **View files** | Yes | Yes |
| **Mark complete** | No (views mentee status) | Yes |
| **Main content** | Material list + mentee progress | Connected mentor cards |
| **Progress focus** | Track each mentee | Track own progress per mentor |

---

## 6. Progress tracking (how it works)

- Progress is calculated as: **completed materials ÷ total materials × 100**.
- A mentee marks an item complete with a checkbox; they can uncheck it to undo.
- Mentors see the same completion data on mentee cards and in the progress report.
- Progress colors shift by percentage (e.g. lower = warmer, higher = cooler/green) so status is easy to scan at a glance.
- Progress only counts materials from that mentor for that mentee.

---

## 7. Design & experience

- Clean two-column layout for mentors (materials on the left, mentee progress on the right).
- Card-based layout for mentees (one card per connected mentor).
- Materials show a type icon (video, PDF, document, etc.), order badge, title, description, file name, and optional duration.
- Upload and edit use a side drawer; delete uses a confirmation popup.
- Empty states guide users when there are no materials or no connections yet.
- Upload shows a loading state (“Uploading…”) so users know the file is still saving.

---

## 8. Good to know

- Mentees only see materials from mentors they are **connected** to.
- Order numbers keep lessons in a teaching sequence (e.g. Module 1 → `1.1`, `1.2`).
- Deleting a material removes it for the mentor and all mentees, and cannot be undone.
- File size is capped at **50 MB** (especially important for videos).
- Progress is saved in the platform database, so it remains after refresh or re-login.
- Mentors need at least one uploaded material for progress tracking to be meaningful.

---

## 9. How it was built (light technical overview)

Plain-language summary of setup — not a deep developer manual.

### The building blocks

- **Front-end:** The Resources feature lives inside the main **Dashboard** page in the Angular app. One tab adapts by role: mentors manage uploads and mentee progress; mentees browse mentor cards and mark items complete.
- **File storage:** Uploaded files are stored in a **Supabase Storage** bucket named `learning-materials`.
- **Data tables:**
  - `learning_materials` — title, description, order number, duration, file name/URL, file type, mentor owner
  - `material_progress` — which mentee completed which material
- **Connections:** Mentors and mentees only see each other here if they are already connected in the platform.

### How an upload works (mentor)

1. Mentor fills the upload form and selects a file (max 50 MB).
2. The file is uploaded to the `learning-materials` storage folder under that mentor’s user ID.
3. The app gets a public URL for the file.
4. A new row is saved in `learning_materials` with title, order, duration, type, and URL.
5. The materials list and mentee progress panels refresh.

### How progress works (mentee)

1. Mentee opens a mentor’s materials list.
2. The app loads materials from that mentor plus the mentee’s completion records.
3. Checking a box creates or updates a `material_progress` record (`completed = true/false`).
4. Percentages on mentor cards and in the modal footer recalculate immediately.
5. Mentors see the updated progress on their mentee cards.

### Setup (what was needed)

1. **Storage bucket** — `learning-materials` in Supabase for files.
2. **Database tables** — `learning_materials` and `material_progress`.
3. **Dashboard UI** — mentor list/stats/upload/edit/delete, mentee mentor cards, materials modal, progress report modal.
4. **Role-based views** — mentors manage content; mentees consume and track completion.
5. **Connection filter** — only connected mentor–mentee pairs share materials and progress.

### Notes for future maintenance

- **Replace file on edit:** Today, changing the file requires delete + re-upload; a “replace file” option could be added later.
- **Larger files:** The 50 MB limit matches common free storage limits; raising it may need a storage plan upgrade.
- **Notifications:** Email or in-app alerts when a mentor uploads new material, or when a mentee finishes a module, would be natural extensions.
