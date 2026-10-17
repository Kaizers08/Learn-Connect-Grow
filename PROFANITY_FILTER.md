# Profanity Filter for Mentor Feedback

## Overview
The feedback system now includes a profanity filter that prevents mentees from submitting inappropriate or offensive language when rating mentors.

## Features

### Real-Time Validation
- Checks feedback text as the user types
- Shows immediate error message if inappropriate words are detected
- Highlights textarea in red when inappropriate content is found

### Blocked Words Categories

#### English Profanity & Insults
- Strong profanity: fuck, shit, bitch, ass, damn, etc.
- Insults: stupid, idiot, moron, dumb, retard, loser
- Negative terms: trash, garbage, worthless, useless, pathetic

#### Tagalog Profanity & Insults
- Common profanity: bobo, tanga, gago, gaga, puta, putang ina
- Strong profanity: ulol, tarantado, hayop, kupal, hinayupak
- Insults: engot, hangal, inutil, walang kwenta, gunggong
- Variations: taena, pakshet, bwisit, yawa, punyeta

### Detection Method
- Case-insensitive matching
- Word boundary detection to avoid false positives
- Pattern matching to catch variations with special characters (e.g., "b*tch", "st_pid")

## User Experience

### Before Submission
1. User types feedback in textarea
2. System validates on every keystroke
3. If inappropriate words detected:
   - Red border appears on textarea
   - Error message displays: "Your feedback contains inappropriate language. Please keep your feedback respectful and professional."
   - Submit button remains enabled but will block submission

### During Submission
1. User clicks "Submit Feedback"
2. Final validation performed
3. If inappropriate words found:
   - Submission blocked
   - Error message displayed
   - User must remove inappropriate content to proceed

### Success Flow
1. User writes respectful feedback
2. No inappropriate words detected
3. Submission proceeds normally
4. Feedback saved to database

## Implementation Details

### Location
`src/app/pages/dashboard/feedback-modal.component.ts`

### Key Methods

#### `validateFeedback()`
- Called on every `(input)` event
- Validates character length (max 1000)
- Checks for inappropriate words
- Sets error message if violations found

#### `checkForInappropriateWords(text: string): boolean`
- Private method
- Maintains list of banned words
- Uses regex for pattern matching
- Returns `true` if inappropriate content detected

#### `submit()`
- Final validation before submission
- Double-checks for inappropriate words
- Blocks submission if violations found

## Error Messages

### Character Limit
> "Feedback cannot exceed 1000 characters"

### Inappropriate Language
> "Your feedback contains inappropriate language. Please keep your feedback respectful and professional."

### Missing Rating
> "Please select a rating"

## Testing Scenarios

### Test Case 1: Clean Feedback
- Input: "Great mentor! Very helpful and patient."
- Expected: ✅ Submission successful

### Test Case 2: Tagalog Profanity
- Input: "Ang bobo ng mentor"
- Expected: ❌ Blocked with error message

### Test Case 3: English Profanity
- Input: "This is stupid and useless"
- Expected: ❌ Blocked with error message

### Test Case 4: Mixed Content
- Input: "Good mentor but sometimes gago"
- Expected: ❌ Blocked with error message

### Test Case 5: Edge Case (Similar Words)
- Input: "The assignment was challenging"
- Expected: ✅ Submission successful (no false positive for "ass")

## Maintenance

### Adding New Words
To add new inappropriate words to the filter:

1. Open `feedback-modal.component.ts`
2. Locate the `bannedWords` array in `checkForInappropriateWords()` method
3. Add new words to the appropriate category
4. Test to ensure no false positives

### Removing Words
If a word causes too many false positives:

1. Remove from `bannedWords` array
2. Test with common phrases to verify
3. Document the change

## Privacy & Security

### Data Storage
- Inappropriate content is **never stored** in the database
- Validation happens client-side before submission
- No record of blocked attempts

### User Privacy
- No tracking of who attempted inappropriate submissions
- No notifications to mentors about blocked feedback
- Clean user experience without shaming

## Future Improvements

### Potential Enhancements
1. **Sentiment Analysis** - Use AI to detect toxic language beyond keyword matching
2. **Context-Aware Filtering** - Allow certain words in appropriate contexts
3. **Multi-Language Support** - Add more languages as user base grows
4. **Admin Dashboard** - Allow admins to review and update banned words list
5. **Severity Levels** - Different actions for mild vs severe violations

### Feedback Loop
- Monitor false positives from user reports
- Regularly update word list based on community feedback
- Consider cultural context and regional variations

---

## Summary

The profanity filter ensures:
✅ Professional and respectful feedback culture  
✅ Protection for mentors from abusive language  
✅ Clean and constructive mentoring environment  
✅ Real-time validation for better UX  
✅ Comprehensive coverage of English and Tagalog profanity
