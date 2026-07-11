# Rating and Feedback System — Requirements Document

## Introduction

The Rating and Feedback System enables mentees to evaluate their mentors and provide written feedback on their mentoring experience. Mentors can view aggregate ratings and feedback on their public profiles. The system includes a feedback submission interface, dashboard management features for mentees, and mentor profile aggregations. All interactions are secured with row-level security policies and integrate with the existing Supabase authentication and connection tracking infrastructure.

---

## Glossary

- **Mentee**: An authenticated user with a mentee_profiles record seeking guidance from a mentor.
- **Mentor**: An authenticated user with a mentor_profiles record providing guidance to mentees.
- **Connection**: A relationship record in the connections table where mentee_user_id and mentor_user_id are linked with status='connected'.
- **Rating**: A numeric value from 1 to 5 stars representing a mentee's evaluation of a mentor.
- **Feedback**: Written text provided by a mentee describing their mentoring experience with a specific mentor.
- **Aggregate Rating**: The average of all rating values received by a mentor from all mentees.
- **Feedback_Modal**: A UI component that displays when a mentee initiates the rating and feedback submission process.
- **Feedback_Submission**: The act of sending a rating and optional text feedback to the feedback storage system.
- **Dashboard**: A dedicated UI section in the mentee interface where submitted feedback is displayed and managed.
- **Mentor_Profile_View**: The public-facing section of a mentor's profile displaying aggregate statistics and feedback history.
- **Row_Level_Security**: Supabase database policies that restrict data access based on the authenticated user's identity and role.
- **Real_Time_Updates**: Supabase subscriptions that automatically refresh UI elements when feedback data changes in the database.

---

## Requirements

### Requirement 1: Feedback Data Model

**User Story:** As a system architect, I want a persistent feedback data structure, so that mentee evaluations are stored reliably and can be aggregated and displayed.

#### Acceptance Criteria

1. WHEN a feedback_submissions table is created, THE Table_Schema SHALL include the following columns: id (UUID primary key), mentee_user_id (UUID, foreign key to auth.users), mentor_user_id (UUID, foreign key to auth.users), rating (integer 1-5), feedback_text (text nullable), created_at (timestamptz default now()), updated_at (timestamptz default now())

2. WHEN a feedback record is inserted, THE Database_System SHALL enforce a unique constraint on (mentee_user_id, mentor_user_id) such that each mentee may submit only one feedback record per mentor

3. WHEN a feedback record is created, THE Database_System SHALL automatically set created_at and updated_at to the current timestamp

4. WHEN a feedback record is updated, THE Database_System SHALL automatically update the updated_at timestamp without user intervention

### Requirement 2: Row-Level Security for Feedback Submissions

**User Story:** As a security administrator, I want feedback data protected by access policies, so that users cannot view or modify other users' feedback.

#### Acceptance Criteria

1. THE Row_Level_Security_Policy SHALL permit SELECT on feedback_submissions only if auth.uid() equals mentee_user_id OR auth.uid() equals mentor_user_id

2. THE Row_Level_Security_Policy SHALL permit INSERT on feedback_submissions only if auth.uid() equals the mentee_user_id of the new record

3. THE Row_Level_Security_Policy SHALL permit UPDATE on feedback_submissions only if auth.uid() equals mentee_user_id (allowing mentees to edit their own feedback)

4. THE Row_Level_Security_Policy SHALL permit DELETE on feedback_submissions only if auth.uid() equals mentee_user_id (allowing mentees to remove their own feedback)

5. WHEN a mentee_user_id or mentor_user_id is deleted from auth.users, THE Database_System SHALL cascade delete related feedback_submissions records

### Requirement 3: Button Availability Based on Connection Status

**User Story:** As a mentee, I want the "Rate and Feedback" button visible only when connected to a mentor, so that I can only rate mentors with whom I have an established relationship.

#### Acceptance Criteria

1. WHEN a mentee navigates to a mentor profile page, THE UI_Controller SHALL query the connections table for a record matching mentee_user_id = current_user AND mentor_user_id = target_mentor AND status = 'connected'

2. IF a connected record exists, THE UI_Controller SHALL enable and display the "Rate and Feedback" button with visible styling

3. IF no connected record exists OR status is not 'connected', THE UI_Controller SHALL hide or disable the "Rate and Feedback" button with visually distinct styling

4. WHEN the connection status changes from 'connected' to 'disconnected' or a new connection is established, THE UI_Controller SHALL refresh the button state to reflect the current connection status

### Requirement 4: Feedback Modal Component

**User Story:** As a mentee, I want a modal dialog to submit my rating and written feedback, so that I can communicate my evaluation clearly.

#### Acceptance Criteria

1. WHEN a mentee clicks the "Rate and Feedback" button, THE Modal_Component SHALL open and display a form with the following elements: a star-rating input (1-5 stars), a text area for feedback content, a "Submit" button, and a "Cancel" button

2. WHEN the modal is open, THE Modal_Component SHALL display the mentor's name and profile picture at the top of the form

3. WHEN a mentee clicks a star in the rating component, THE UI_Component SHALL visually highlight all stars up to and including the clicked star, and update the internal rating value

4. WHEN a mentee types into the feedback text area, THE UI_Component SHALL accept and display the text without length restrictions during input (validation occurs at submission)

5. WHEN a mentee clicks the "Cancel" button, THE Modal_Component SHALL close without saving any data

6. WHEN the modal closes (either by Cancel or successful submission), THE Modal_Component SHALL reset the form fields to empty state for the next interaction

### Requirement 5: Feedback Validation and Submission

**User Story:** As a system administrator, I want feedback validated before storage, so that only valid, complete data is persisted.

#### Acceptance Criteria

1. WHEN a mentee attempts to submit feedback, THE Feedback_Validator SHALL require a rating value between 1 and 5 (inclusive) and reject submissions that lack this value

2. WHEN a mentee attempts to submit feedback, THE Feedback_Validator SHALL allow feedback_text to be empty, null, or contain up to 1000 characters

3. IF the feedback_text exceeds 1000 characters, THE Feedback_Validator SHALL display an error message indicating the character limit and prevent submission

4. WHEN validation fails, THE UI_Controller SHALL display an error message indicating which field caused the failure (e.g., "Rating is required" or "Feedback exceeds 1000 characters")

5. WHEN validation passes, THE Feedback_Submission_Handler SHALL insert a new record into feedback_submissions (on first submission) or update the existing record (if the mentee has already submitted feedback for this mentor)

6. WHEN submission succeeds, THE UI_Controller SHALL display a success message and close the modal after 1-2 seconds

### Requirement 6: Mentee Dashboard Feedback Display

**User Story:** As a mentee, I want to view all feedback I have submitted to mentors, so that I can track my mentoring evaluations and interactions.

#### Acceptance Criteria

1. WHEN a mentee navigates to the dashboard page, THE Dashboard_Component SHALL query feedback_submissions where mentee_user_id = current_user

2. WHEN results are retrieved, THE Dashboard_Component SHALL display a dedicated "My Feedback" section listing all feedback records in reverse chronological order (most recent first)

3. WHEN displaying feedback records, THE Dashboard_Component SHALL show the mentor's name, profile picture, rating (as stars), feedback_text, created_at timestamp, and an "Edit" and "Delete" button for each record

4. IF a mentee has submitted no feedback, THE Dashboard_Component SHALL display a message indicating "You have not submitted any feedback yet"

5. WHEN a mentee clicks the "Edit" button on a feedback record, THE UI_Controller SHALL open the feedback modal pre-populated with the existing rating and feedback_text, allowing modification

6. WHEN a mentee submits edited feedback, THE Feedback_Submission_Handler SHALL update the updated_at timestamp and persist the changes to the database

7. WHEN a mentee clicks the "Delete" button on a feedback record, THE UI_Controller SHALL prompt for confirmation (e.g., "Are you sure you want to delete this feedback?")

8. WHEN a mentee confirms deletion, THE Feedback_Deletion_Handler SHALL remove the feedback_submissions record from the database

### Requirement 7: Mentor Profile Aggregate Rating Display

**User Story:** As a mentor, I want to see my average rating on my profile, so that I can understand how I am perceived by mentees.

#### Acceptance Criteria

1. WHEN a mentor's profile page is loaded, THE Profile_View_Component SHALL query feedback_submissions where mentor_user_id = target_mentor

2. WHEN feedback records are retrieved, THE Profile_View_Component SHALL calculate the average of all rating values and display it as an aggregate rating (rounded to one decimal place, e.g., 4.5)

3. WHEN the aggregate rating is displayed, THE Profile_View_Component SHALL render the rating using a visual star representation (e.g., 4.5 stars shown as 4 full stars and 1 half star)

4. WHEN the aggregate rating is displayed, THE Profile_View_Component SHALL also show a count of total feedback submissions (e.g., "4.5 stars (12 ratings)")

5. IF a mentor has received no feedback, THE Profile_View_Component SHALL display "No ratings yet" instead of an aggregate rating

### Requirement 8: Mentor Profile Feedback List Display

**User Story:** As a visitor, I want to see all feedback submitted to a mentor, so that I can assess the mentor's quality based on mentee experiences.

#### Acceptance Criteria

1. WHEN a mentor's profile page is loaded, THE Profile_View_Component SHALL display a "Feedback from Mentees" section below the aggregate rating

2. WHEN the section is displayed, THE Profile_View_Component SHALL list all feedback_submissions records where mentor_user_id = target_mentor in reverse chronological order (most recent first)

3. WHEN displaying feedback records, THE Profile_View_Component SHALL show the mentee's full_name (or display name), their profile picture (if available), the rating (as stars), the feedback_text, and the created_at timestamp

4. IF feedback_text is longer than 300 characters, THE Profile_View_Component SHALL truncate the text and display a "Read more" link or button

5. WHEN a visitor clicks "Read more", THE Profile_View_Component SHALL expand the feedback text to show the complete message

6. IF a mentor has received no feedback, THE Profile_View_Component SHALL display a message indicating "This mentor has not received any feedback yet"

7. WHEN displaying mentee names and pictures, THE Profile_View_Component SHALL query mentee_profiles to retrieve full_name and profile_picture based on mentee_user_id

### Requirement 9: Real-Time Feedback Updates

**User Story:** As a mentor or mentee, I want my feedback data to update in real-time across all open sessions, so that I see current information without refreshing.

#### Acceptance Criteria

1. WHEN a feedback record is inserted, updated, or deleted in feedback_submissions, THE Real_Time_Subscription_Handler SHALL broadcast a change event to all authenticated clients

2. WHEN a mentee submits new feedback for a mentor, THE Mentor_Profile_View_Component SHALL automatically update the aggregate rating and feedback list without requiring a page refresh

3. WHEN a mentee edits their feedback, THE Mentor_Profile_View_Component and Dashboard_Component SHALL automatically reflect the updated rating and text

4. WHEN a mentee deletes their feedback, THE Mentor_Profile_View_Component and Dashboard_Component SHALL automatically remove the feedback from their respective lists

5. WHEN a Real_Time_Subscription has an error or disconnects, THE Error_Handler SHALL log the error and attempt to reconnect with exponential backoff (max 3 retries, 5 second timeout per attempt)

### Requirement 10: Feedback Editing Constraints

**User Story:** As a mentee, I want to edit my feedback to correct mistakes or refine my evaluation, so that my feedback remains accurate over time.

#### Acceptance Criteria

1. WHEN a mentee opens the edit modal for existing feedback, THE Feedback_Modal SHALL display the current rating and feedback_text pre-populated in the form fields

2. WHEN a mentee edits the rating or feedback_text, THE Feedback_Submission_Handler SHALL update the record in feedback_submissions, setting updated_at to the current timestamp

3. WHEN a mentee edits feedback, THE Row_Level_Security_Policy SHALL enforce that only the original mentee_user_id can modify the record

4. IF a feedback record has been edited, THE Profile_View_Component SHALL display an indicator (e.g., "Edited" label with timestamp) to show that the feedback was not original

### Requirement 11: Feedback and Connection Integrity

**User Story:** As a system administrator, I want feedback to remain valid when connections change, so that historical feedback is preserved even if a mentee and mentor disconnect.

#### Acceptance Criteria

1. WHEN a mentee and mentor disconnect (status changes to 'disconnected' in connections table), THE System_Handler SHALL NOT automatically delete existing feedback_submissions records

2. WHEN a mentee and mentor are disconnected, THE UI_Controller SHALL prevent the "Rate and Feedback" button from being displayed on the mentor's profile

3. WHEN feedback exists from a disconnected pair, THE Mentor_Profile_View_Component SHALL continue to display the feedback in the feedback list

4. WHEN a new connection is established between a previously connected mentee and mentor, THE UI_Controller SHALL allow feedback submission (creating a new record if no feedback exists, or updating if one does)

### Requirement 12: Data Validation and Error Handling

**User Story:** As a developer, I want robust validation and clear error messages, so that feedback submission issues are handled gracefully.

#### Acceptance Criteria

1. WHEN a database constraint violation occurs (e.g., foreign key error), THE Error_Handler SHALL catch the error and display a user-friendly message: "An error occurred while submitting feedback. Please try again."

2. WHEN a network error occurs during submission, THE Error_Handler SHALL display a message: "Network error. Please check your connection and try again."

3. WHEN a user lacks proper permissions due to RLS violations, THE Error_Handler SHALL log the error and display: "You do not have permission to perform this action."

4. WHEN the Supabase connection is lost, THE Real_Time_Subscription_Handler SHALL attempt reconnection and display a temporary status message: "Reconnecting..." during the attempt

5. WHEN character validation fails (e.g., feedback_text validation), THE Validator SHALL provide specific feedback on the validation error for user correction

### Requirement 13: Performance and Scalability

**User Story:** As a system administrator, I want feedback queries to be efficient, so that the platform performs well as mentors receive more feedback.

#### Acceptance Criteria

1. WHEN calculating aggregate ratings for a mentor profile, THE Profile_View_Component SHALL use a database computed value (via Supabase function or client-side calculation with indexed queries) to avoid full table scans

2. WHEN querying feedback_submissions for a mentor or mentee, THE Query_Handler SHALL use database indexes on (mentor_user_id) and (mentee_user_id) columns to ensure O(log n) query performance

3. WHEN a mentor profile is viewed with many feedback records, THE Profile_View_Component SHALL paginate or lazy-load feedback records in groups of 10-20 items to reduce initial load time

4. WHEN feedback records are displayed in the mentee dashboard, THE Dashboard_Component SHALL retrieve records with efficient joins to mentee_profiles and mentor_profiles to minimize query count

### Requirement 14: Audit and Logging

**User Story:** As a compliance officer, I want feedback modifications tracked, so that I can audit feedback history if needed.

#### Acceptance Criteria

1. WHEN a feedback record is created, THE Audit_Logger SHALL record the action, mentee_user_id, mentor_user_id, rating, feedback_text, and timestamp in an audit log

2. WHEN a feedback record is updated, THE Audit_Logger SHALL record the old and new values (rating, feedback_text), the user who made the change, and the timestamp

3. WHEN a feedback record is deleted, THE Audit_Logger SHALL record the deletion event, mentee_user_id, mentor_user_id, and timestamp

4. WHEN audit logs are queried, THE Audit_System SHALL restrict access to admins only via Row_Level_Security policies

---

## Next Steps

This requirements document is ready for review. Provide feedback or corrections, and indicate when you're ready to proceed to the Design phase.
