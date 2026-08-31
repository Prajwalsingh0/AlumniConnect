/**
 * chatbotService - AlumniConnect assistant
 *
 * Provider abstraction with two implementations:
 *   1. remoteProvider — any OpenAI-compatible chat-completions endpoint,
 *      enabled only when CHATBOT_API_URL and CHATBOT_API_KEY are configured
 *      (optional CHATBOT_MODEL, default "gpt-4o-mini"). Never hard-codes keys.
 *   2. localProvider — a rule-based knowledge base about AlumniConnect that
 *      always works without any API key.
 *
 * If the remote provider is configured but fails (network, auth, rate limit),
 * the local provider answers instead, so the widget is never broken.
 */

const PLATFORM_SYSTEM_PROMPT = `You are the AlumniConnect assistant, a helpful guide for a university alumni web platform.

AlumniConnect features:
- Alumni Directory (alumni.html): browse alumni, search by name/company/title/skills/department/location/degree, filter by graduation year, "Available for mentorship" filter, open public profiles.
- Public Profiles (profile.html?id=...): bio, experience, education, skills, social links, Request Mentorship and Message buttons.
- Mentorship (mentorship.html): send mentorship requests from a profile, see received/sent requests, accept or reject as a mentor, cancel as a mentee, complete active mentorships.
- Real-time Chat (chat.html): message other alumni, typing indicators, unread badges on the navbar, message history.
- Job Board (jobs.html): browse and apply to jobs posted by alumni.
- Events (events.html): upcoming and past events, register with an account.
- Donations (donations.html): fundraising campaigns for the institute.
- Stories (stories.html): success stories from alumni; submit your own.
- Portal (portal.html): register or log in.
- Admin panel (admin.html): administration (admin role only).

Answer questions about how to use these features concisely and friendly.
If a question is unrelated to AlumniConnect or its features, politely explain
that you can only help with AlumniConnect and suggest what you can do instead.`;

// Local knowledge base: keyword-scored answers about the platform
const KNOWLEDGE = [
  {
    keywords: ['mentorship', 'mentor', 'mentee'],
    reply: 'Mentorship connects alumni mentors with students or fresh graduates. Open a profile from the Alumni Directory and press "Request Mentorship" to send a request with a short message. On the Mentorship page you can see requests you received (accept/reject them), requests you sent (cancel while pending), your active mentorships with chat, and completed ones. Mentors who want requests can tick "Open to mentoring" in Edit Profile.'
  },
  {
    keywords: ['directory', 'find alumni', 'search alumni', 'alumni list', 'discover'],
    reply: 'The Alumni Directory (menu → Directory) lists all members. You can search by name, company, job title, skill, degree, department or location, and filter by graduation year, department, degree and location. There is also an "Available for mentorship" filter, and every card links to the full public profile.'
  },
  {
    keywords: ['chat', 'message', 'messaging', 'talk', 'conversation', 'unread'],
    reply: 'Real-time chat lives under menu → Chat. Start a conversation from an alumni profile ("Message" button) or a directory card. You will see unread badges on the navbar and in the conversation list, typing indicators, and your full message history. Active mentorships also have an "Open Chat" button on the Mentorship page.'
  },
  {
    keywords: ['job', 'jobs', 'career', 'apply', 'vacancy', 'hiring'],
    reply: 'The Job Board (menu → Resources → Job Board) shows openings posted by alumni. Use the search and filters to narrow by title, location or type, then press Apply on a job and attach a resume link plus a short cover letter.'
  },
  {
    keywords: ['event', 'events', 'register', 'meetup', 'reunion'],
    reply: 'Events (menu → Programs & Events) lists upcoming and past alumni events. Pick an upcoming event, scroll to the registration form, choose the event and submit — you must be logged in to register. You can also unregister from an event on the same page.'
  },
  {
    keywords: ['donate', 'donation', 'campaign', 'fund', 'give', 'contribute'],
    reply: 'Fundraising campaigns live under menu → Resources → Give Back. Choose an active campaign, press Donate, enter an amount (you must be logged in) — the campaign progress bar updates immediately.'
  },
  {
    keywords: ['story', 'stories', 'share', 'submit story'],
    reply: 'Success Stories (menu → Alumni Stories) collects journeys from the community. Read published stories on the page, or scroll to "Share Your Story" and submit your own — you need to be logged in and the story should be at least 100 words.'
  },
  {
    keywords: ['profile', 'edit profile', 'bio', 'skills', 'avatar', 'photo'],
    reply: 'Your profile is under the avatar menu → My Profile. Press "Edit Profile" to update your name, title, location, bio, links, work experience, education, skills, privacy settings and your "Open to mentoring" toggle. You can also upload a profile picture there.'
  },
  {
    keywords: ['register', 'sign up', 'signUp', 'create account', 'login', 'log in', 'password'],
    reply: 'Use the Portal (menu → Login, or portal.html). New members register with first name, last name, email, graduation year, degree and a password of at least 6 characters. If you forgot your password, use "Forgot password?" on the portal and follow the email link.'
  },
  {
    keywords: ['endorse', 'endorsement', 'skill endorsement'],
    reply: 'Skills on a profile can be endorsed by other members. Open someones profile, scroll to their skills and press the endorse action — endorsements show up as a count next to the skill.'
  },
  {
    keywords: ['admin', 'administration'],
    reply: 'The Admin Panel (menu → Resources → Admin Panel) is restricted to admin accounts: manage users (roles, ban/unban, delete), events, jobs and donation campaigns. Admins log in through admin-login.html.'
  },
  {
    keywords: ['hello', 'hi', 'hey', 'help', 'what can you do', 'start'],
    reply: 'Hi! I am the AlumniConnect assistant. I can explain how the Directory, Mentorship, Chat, Job Board, Events, Donations, Stories or your Profile work — just ask. For example: "How do I find alumni?" or "How does mentorship work?"'
  }
];

const FALLBACK_REPLY = 'I am not sure about that one — I can only help with AlumniConnect features. Try asking about the Directory, Mentorship, Chat, Job Board, Events, Donations, Stories or your Profile. You can also say "help" to see what I can do.';

function localAnswer(message) {
  const normalized = message.toLowerCase();

  let best = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    const score = entry.keywords.reduce(function (sum, keyword) {
      return normalized.includes(keyword) ? sum + keyword.length : sum;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best ? best.reply : FALLBACK_REPLY;
}

function isRemoteConfigured() {
  return !!(process.env.CHATBOT_API_URL && process.env.CHATBOT_API_KEY);
}

// OpenAI-compatible chat completions call with a hard timeout.
// Returns null on any failure so the caller falls back to the local provider.
async function remoteAnswer(message, history) {
  const url = process.env.CHATBOT_API_URL;
  const apiKey = process.env.CHATBOT_API_KEY;
  const model = process.env.CHATBOT_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 10000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        temperature: 0.4,
        messages: [
          { role: 'system', content: PLATFORM_SYSTEM_PROMPT },
          ...history.slice(-6),
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const reply = data && data.choices && data.choices[0]
      && data.choices[0].message && data.choices[0].message.content;

    return typeof reply === 'string' && reply.trim() ? reply.trim() : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Public entry point: returns a plain-text reply for a user message.
 * @param {string} message - validated, trimmed user message
 * @param {Array<{role:'user'|'assistant', content:string}>} [history] - recent turns
 */
async function getChatbotReply(message, history = []) {
  if (isRemoteConfigured()) {
    const remote = await remoteAnswer(message, history);
    if (remote) return remote;
  }
  return localAnswer(message);
}

module.exports = { getChatbotReply, localAnswer, isRemoteConfigured };
