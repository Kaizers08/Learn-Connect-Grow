# Schedules — Client Guide

**Platform:** Learn, Connect, Grow (EdTech Mentoring Platform)
**Feature:** Schedules (Calendar / Mentoring Sessions)
**Audience:** Client / Stakeholders

---

## 1. What it is

The **Schedules** tab is the platform’s shared calendar for mentoring sessions. Mentors use it to plan and publish sessions; mentees use it to see when their connected mentors have sessions coming up.

It helps both sides stay aligned on dates, times, meeting links, and session notes — without leaving the dashboard.

---

## 2. Where to find it

After logging in, open the **Dashboard** and click **Schedules** in the left sidebar (calendar icon).

The same upcoming-session information also appears on the main **Dashboard home** in the **Upcoming Sessions** panel on the right, with a **View all** link that opens the full Schedules tab.

---

## 3. Mentor experience

### What mentors can do

- Create mentoring sessions on the calendar
- View their sessions in **Week** or **Day** view
- Click a session to see full details (date, time, location, notes)
- Delete sessions they created
- See how many upcoming sessions they have (Dashboard stat + sidebar)

### Creating a session (step by step)

1. Go to **Dashboard → Schedules**.
2. On the right side, use the **Create** panel.
3. Fill in:
   - **Session Title** (required)
   - **Meeting Link or Place** (optional — e.g. Zoom link or room name)
   - **Date** (required)
   - **Start time** (required)
   - **End time** (optional — if left blank, the session defaults to 1 hour)
   - **Session Notes** (optional — agenda, prep, etc.)
4. Tap the **color dot** to pick a session color (helps visually separate sessions on the calendar).
5. Click **Create Session**.

The new session appears on the calendar grid for that date and time.

### Calendar tools (mentor)

| Control | What it does |
|--------|----------------|
| **Today** | Jump back to the current week/day |
| **← / →** | Move to previous or next week (or day in Day view) |
| **Day / Week** | Switch between single-day and 7-day calendar |
| **Red “now” line** | Shows the current time on today’s grid |
| **Click a session** | Opens a detail popup with full info |
| **Delete Event** | Available only on sessions the mentor created |

---

## 4. Mentee experience

### What mentees can do

- View sessions from **connected mentors** on the shared calendar
- See each mentor’s sessions in a **different color** on the grid
- See a small **mentor avatar** on mentor-created sessions
- Click a session to read details (date, time, location, notes, mentor name)
- Use the **Upcoming mentoring sessions** panel on the right (next sessions at a glance)
- Open **chat** from the Schedules tab to message a mentor before or after a session

### What mentees cannot do

- Mentees **cannot create** sessions on the calendar. Session creation is mentor-only.
- Mentees **cannot delete** a mentor’s session — they can only view it.

### When mentees see sessions

A mentee will only see mentor sessions if:

1. They are **connected** to that mentor (via Find Mentors → Connect), and  
2. The mentor has **created a session** on the calendar.

If no mentor has added sessions yet, the calendar shows an empty state and the right panel says **“No upcoming mentoring sessions.”**

### Upcoming sessions panel (mentee)

The right panel lists up to the **next 3 upcoming sessions**, showing:

- Mentor name and photo  
- Meeting link or place  
- Date and time  
- Session notes (if the mentor added any)  

A note at the bottom reminds mentees: **“Use chat before or after each session.”** The **Open chat** button goes straight to Messages.

---

## 5. Session details (both roles)

Click any session block on the calendar to open a popup with:

| Field | Description |
|-------|-------------|
| **Title** | Session name |
| **Date** | When it happens |
| **Time** | Start (and end if set) |
| **Source** | Who created it (e.g. “Created by [Mentor Name]”) |
| **Location** | Meeting link or physical place |
| **Notes** | Extra details from the mentor |
| **Mentor** | Photo and name (on mentor-created sessions, mentee view) |

---

## 6. How mentor vs mentee views differ

| | **Mentor** | **Mentee** |
|---|-----------|-----------|
| **Create sessions** | Yes | No |
| **See own sessions** | Yes | N/A |
| **See connected user’s sessions** | Own only | Connected mentors’ sessions |
| **Right panel** | Create session form | Upcoming sessions list |
| **Delete sessions** | Own sessions only | No |
| **Color on calendar** | Chosen when creating | Auto-assigned per mentor |
| **Chat shortcut** | Via Messages tab | **Open chat** button on Schedules |

---

## 7. Design & experience

- Full-width calendar layout with a scrollable time grid (midnight to 11 PM).
- Week view shows **Sun–Sat** with day names and dates in the header.
- Sessions appear as colored blocks sized by duration on the correct day and hour.
- Short sessions use a compact layout; longer ones show more detail.
- Empty calendar shows a friendly message and hint to add events (mentors) or wait for mentor sessions (mentees).
- Success and error messages appear as short notifications (e.g. missing title, end time before start time).

---

## 8. Good to know

- Sessions are stored in the platform database and load when the user opens Schedules or Dashboard.
- Mentees must **connect with a mentor first** before that mentor’s sessions appear.
- The Dashboard **Upcoming Sessions** count reflects all future sessions (not just the 3 shown in the sidebar list).
- End time must be **after** start time; otherwise the mentor sees a warning and the session is not saved.
- If a mentor creates a session outside the currently visible week, the calendar automatically jumps to that week.

---

## 9. How it was built (light technical overview)

Plain-language summary of setup — not a deep developer manual.

### The building blocks

- **Front-end:** The Schedules feature lives inside the main **Dashboard** page in the Angular app. One calendar layout adapts by role: mentors get a create form; mentees get an upcoming-sessions list.
- **Data storage:** Sessions are saved in a **Supabase** database table called `calendar_events` (title, date, times, place, notes, color, type, owner).
- **Connections:** For mentees, the app reads the `connections` table to find linked mentors, then loads those mentors’ calendar events only.
- **Real-time feel:** The calendar shows a live **“now”** line based on the user’s current time and refreshes the event list after create or delete.

### How a session is saved (mentor flow)

1. Mentor fills the create form and clicks **Create Session**.
2. The app checks the user is a mentor and validates required fields and times.
3. A new row is inserted into `calendar_events` with type **mentorship**.
4. The calendar reloads and displays the session on the correct day and time slot.

### How mentees see mentor sessions

1. Mentee opens Schedules.
2. The app loads the mentee’s connections (mentor user IDs).
3. It fetches all `calendar_events` created by those mentors.
4. Each mentor gets a **distinct color** and name/avatar on their events.
5. Future sessions are also summarized in the **Upcoming mentoring sessions** panel.

### Setup (what was needed)

1. **Database table** — `calendar_events` in Supabase for session data.
2. **Connections** — mentee–mentor links so mentees only see relevant sessions.
3. **Dashboard UI** — calendar grid, create form (mentor), upcoming list (mentee), event detail modal, delete confirmation.
4. **Role checks** — only mentors can create; only event owners can delete.
5. **Dashboard integration** — upcoming session count and preview cards on the home dashboard view.

### Notes for future maintenance

- **Edit sessions:** The backend supports updating events; the UI currently focuses on create, view, and delete.
- **More event types:** The system supports types like `personal` and `reminder` in the data model; mentors currently create **mentorship** sessions.
- **Scaling:** Adding filters (by mentor, by date range) or email reminders would extend this module without replacing the calendar core.
