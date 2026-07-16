# EdTech Assistant — Chatbot Guide

**Platform:** Learn, Connect, Grow (EdTech Mentoring Platform)
**Feature:** EdTech Assistant (AI Chatbot)
**Audience:** Client / Stakeholders

---

## 1. What it is

The **EdTech Assistant** is an AI-powered chatbot built into the platform. It acts as a
built-in guide that helps visitors understand how the platform works and answers their
questions instantly — no staff needed.

It can:

- Explain **how the platform works** (signing up, finding a mentor, sessions, learning materials, etc.)
- Answer **general knowledge questions**
- Help with **math problems and calculations**

---

## 2. Where to find it

The chatbot appears as a floating **blue chat button** in the **bottom-right corner** of:

- The **Landing (Home) page**
- The **Login page**

A small red "1" badge invites the visitor to open it.

---

## 3. How to use it (step by step)

1. Click the blue chat button in the bottom-right corner.
2. The chat window opens with a friendly welcome message.
3. Type a question in the input box and press **Enter** or click the **send** button.
4. The assistant replies within a few seconds. A typing animation shows while it thinks.
5. Continue the conversation — it remembers the context of the chat.

**Window controls:**

- **Minimize** (–): collapse the window to just the header.
- **Maximize**: expand it again.
- **Close** (×): hide the chat and return to the floating button.

---

## 4. What visitors can ask

**About the platform:**

- "How do I sign up?"
- "How do I find a mentor?"
- "What's the difference between a mentor and a mentee?"
- "How do I book a session?"
- "How does progress tracking work?"
- "How do mentors get approved?"

**General help:**

- General knowledge questions
- Math problems (e.g., "What is 15% of 240?")

---

## 5. What it knows about the platform

The assistant is trained with the platform's documentation, so it can accurately explain:

| Topic | What it explains |
|-------|------------------|
| **Roles** | Mentee, Mentor, and Admin — and what each does |
| **Register & Login** | Sign up with email/password or Google; forgot-password reset |
| **Onboarding** | Choosing a role, completing a profile, the "Journey" step |
| **Mentor approval** | Uploading documents and waiting for admin approval |
| **Finding matches** | Recommended mentors/mentees, search, filters, connecting |
| **Messaging** | 1-to-1 chat between connected users |
| **Sessions** | Shared calendar; mentors create sessions, mentees view them |
| **Learning materials** | Mentors upload materials; mentees view and complete them |
| **Progress tracking** | Completion percentage per mentor |
| **Feedback & ratings** | Mentees rate mentors 1–5 stars with written reviews |
| **Admin** | Approving/rejecting mentors and viewing platform stats |

If a question falls outside what it knows, it politely says it isn't sure instead of
guessing — so visitors always get trustworthy answers.

---

## 6. Design & experience

- Clean, professional chat window styled in the platform's blue brand colors.
- Shows an **"Online"** status, avatar, and a **BETA** label.
- Smooth animations, typing indicator, and message timestamps.
- Fully **responsive** — on phones the chat expands to fill the screen for easy typing.

---

## 7. Good to know

- The assistant is a **guide and general helper**. It explains how to use features but does
  not perform actions on the user's behalf (for example, it won't book a session for them).
- Conversations are not stored after the page is refreshed — each visit starts fresh.
- It is available to visitors **before** they log in, so newcomers can get answers right away.

---

## 8. How it was built (light technical overview)

This is a simple, plain-language look at how the chatbot was put together — no deep coding
knowledge needed.

### The building blocks

- **Front-end:** The chatbot is a reusable component built inside the platform's existing
  Angular web app. Because it's a shared component, the same chatbot is simply "dropped in"
  on both the Landing page and the Login page.
- **The brain (AI):** The actual answers come from an external AI service (a large language
  model) that the chatbot talks to over the internet. The platform sends the visitor's
  question to this service and displays the answer it returns.
  - **Model provider:** Cerebras (AI inference service)
  - **Model used:** `zai-glm-4.7`
- **The instructions:** Before any conversation starts, the chatbot is given a hidden set of
  instructions (the platform's documentation and its "personality"). This is what makes it
  answer accurately about *this* platform instead of giving generic replies.

### How a message flows

1. The visitor types a question and hits send.
2. The chatbot adds it to the ongoing conversation and sends everything to the AI service.
3. The AI reads the hidden instructions + the conversation and generates a reply.
4. The reply is shown in the chat window, formatted neatly with timestamps.

### Setup (what was needed to make it work)

1. **Create the chatbot component** and its design (the window, button, colors, animations).
2. **Connect to the AI service** using a secure access key so the app is allowed to use it.
3. **Write the instructions** that teach the assistant how the platform works and how to
   respond (friendly, concise, honest when unsure).
4. **Place the chatbot** on the Landing and Login pages so visitors can reach it.
5. **Test** typical questions to confirm the answers are accurate and helpful.

### Notes for future maintenance

- **Updating what it knows:** When the platform gets new features, the assistant's hidden
  instructions can be updated so it explains them too. No redesign needed.
- **The AI service:** The chatbot depends on an external AI provider and an access key. If
  the key or service changes, that connection setting is the only thing that needs updating.
- **Costs & limits:** The AI service may have usage limits or costs depending on the plan,
  since each question is answered by an external provider.
