# Rating & Feedback System - Quick Start Guide

## 🎯 What's New?

Your mentorship platform now has a complete rating and feedback system that enables mentees to evaluate their mentors and provide meaningful feedback.

---

## 📍 Where to Find It

### In the Dashboard Sidebar
Click on **"Mentors & Feedback"** (or **"Mentees & Feedback"** for mentors)

This opens a new section with:
- **For Mentees**: List of connected mentors with rating/feedback options
- **For Mentors**: All feedback received from mentees

---

## 🎬 How to Use It

### As a Mentee: Submitting Feedback

#### Step 1: Navigate to Mentors & Feedback
- Click the **"Mentors & Feedback"** button in the sidebar
- You'll see a grid of all your connected mentors

#### Step 2: Click "Rate & Feedback"
- Locate the mentor you want to rate
- Click the blue **"Rate & Feedback"** button on their card

#### Step 3: Fill the Modal
A modal popup will appear with:
- Mentor's name and profile picture
- **Interactive 5-star rating** - Click on stars to select rating (required)
- **Feedback text area** - Add optional comments (up to 1000 characters)
- Character counter showing how many characters you've used

#### Step 4: Submit
- Click the **"Submit Feedback"** button
- The modal closes and your feedback is saved
- The feedback appears on the mentor's card

### Editing Feedback

#### Already submitted feedback?
- Click the **"Edit Feedback"** button on the mentor card
- The modal reopens with your existing feedback
- Update the rating and/or text
- Click "Submit Feedback" to save changes
- Updated_at timestamp will show it was edited

### Deleting Feedback

#### Want to remove your feedback?
- Click the **"Delete"** button on the mentor card
- Confirm when asked "Are you sure?"
- Your feedback is permanently removed

---

### As a Mentor: Viewing Feedback

#### Step 1: Navigate to Mentees & Feedback
- Click **"Mentees & Feedback"** in the sidebar
- You'll see all feedback received from your mentees

#### Step 2: Review Feedback
Each feedback item shows:
- **Mentee's name and profile picture**
- **Star rating** displayed visually (⭐ icons)
- **Complete feedback text** they provided
- **Date submitted** in short format
- Scroll through all feedback in reverse chronological order (newest first)

---

## ✨ Features

### Visual Rating System
- ⭐ Interactive 5-star rating with visual feedback
- Hover effects show which rating you're about to select
- Clear display of selected rating

### Character Counter
- Real-time counter shows how many characters used
- Max 1000 characters per feedback
- Visual feedback at 1000 character limit

### Data Persistence
- Your feedback is saved to the database
- Edit anytime before you delete it
- All changes are tracked with timestamps

### Connection-Based Access
- "Rate & Feedback" button only appears for connected mentors
- Ensures feedback is only from actual mentoring relationships

### Empty States
- Mentees see "You haven't connected with any mentors yet" if no connections
- Mentors see "No feedback received yet" if no feedback exists
- Both have helpful calls-to-action

---

## 📊 What Gets Stored

When you submit feedback, the system stores:

| Field | Type | Max Length | Notes |
|-------|------|-----------|-------|
| **Rating** | Integer | 1-5 | Required |
| **Feedback Text** | Text | 1000 chars | Optional |
| **Mentee ID** | UUID | - | Auto-filled |
| **Mentor ID** | UUID | - | Auto-filled |
| **Submitted Date** | Timestamp | - | Auto |
| **Last Updated** | Timestamp | - | Auto |

---

## 🔒 Privacy & Security

- Only you can see your own feedback (mentees)
- Only the mentor can see feedback from their mentees
- Public cannot see feedback (hidden from profiles for now)
- Your data is encrypted and secure
- Automatic deletion if user accounts are deleted

---

## ⚠️ Rules & Constraints

1. **One Feedback Per Pair**
   - You can only submit ONE feedback per mentor
   - You can edit that feedback anytime
   - If you delete it, you can submit a new one

2. **Connection Required**
   - You must be connected with a mentor before rating them
   - If you disconnect, the feedback remains in history
   - You can reconnect and rate them again

3. **Character Limits**
   - Feedback cannot exceed 1000 characters
   - Error message will appear if you try
   - Character counter helps you stay under limit

4. **Rating Requirements**
   - Rating (1-5 stars) is mandatory
   - Cannot submit without selecting a rating

---

## 🎨 UI Components

### Mentor Card (Mentee View)
```
┌─────────────────────────────┐
│  [Avatar] Name              │
│           Specialty         │
├─────────────────────────────┤
│  ⭐⭐⭐⭐⭐ (4.8/5)             │
│  "Great mentor, very patient" │
│  Submitted: 7/11/2026       │
├─────────────────────────────┤
│ [Rate & Feedback] [Delete]  │
└─────────────────────────────┘
```

### Feedback Modal (For Submission)
```
┌───────────────────────────────────┐
│  [Avatar] Rate Jane Doe      │ ✕   │
│            Frontend Developer │     │
├───────────────────────────────────┤
│  Your Rating                      │
│  ⭐ ⭐ ⭐ ⭐ ⭐ (hover to select) │
│  4.0 out of 5                    │
│                                   │
│  Your Feedback (Optional)        │
│  [                             ] │
│  [Text area for feedback]         │
│  0 / 1000                        │
├───────────────────────────────────┤
│      [Cancel] [Submit Feedback]   │
└───────────────────────────────────┘
```

### Feedback Item (Mentor View)
```
┌───────────────────────────────────┐
│  [Avatar] John Mentee    Jul 11   │
│  ⭐⭐⭐⭐⭐ (5.0)                   │
│  "Amazing mentor! Learned so much │
│   in just a few sessions. Highly  │
│   recommended."                   │
└───────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### "I don't see the Rate & Feedback button"
- **Check**: Are you connected with this mentor?
- **Fix**: Go to Find Mentors and click Connect first

### "The modal won't open"
- **Check**: Is the mentor data loading?
- **Fix**: Refresh the page and try again

### "I get an error when submitting"
- **Check**: Did you select a rating?
- **Check**: Is your feedback under 1000 characters?
- **Fix**: Fill in all required fields and try again

### "My feedback doesn't show"
- **Check**: Did you click Submit?
- **Check**: Is the page still loading?
- **Fix**: Refresh the page to see your feedback

### "I can't edit my feedback"
- **Check**: Is the mentor card showing your old feedback?
- **Fix**: Click "Edit Feedback" button on the card

---

## 📱 Mobile Friendly

The feedback system is fully responsive:
- Works on phones, tablets, and desktops
- Touch-friendly star rating
- Mobile-optimized modal
- Responsive grid layout

---

## 🚀 Next Steps

### For Admins/Developers
1. Run the database migration: `supabase db push`
2. Deploy the updated code
3. Test with multiple user accounts
4. Monitor for any issues

### For End Users
1. Connect with a mentor (if not already)
2. Visit Mentors & Feedback section
3. Submit your first feedback!
4. Edit or delete as needed

### Planned Features Coming Soon
- ⭐ View mentor average rating on their profile
- 📊 See all feedback on mentor's public profile
- 🔔 Get notified when mentors receive feedback
- 📈 View feedback analytics and trends
- 💬 Reply to feedback (mentors responding)

---

## 📞 Need Help?

- Check the full documentation: `RATING_FEEDBACK_IMPLEMENTATION.md`
- Review the code comments in the components
- Check your browser console for error messages
- Contact your platform administrator

---

## 🎉 Start Rating!

Your feedback helps mentors improve and helps other mentees find great mentors. Start rating your mentors today!

**Happy mentoring! 🚀**
