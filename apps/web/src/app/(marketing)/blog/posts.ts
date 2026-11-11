export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryColor: string;
  date: string;
  dateISO: string;
  readTime: string;
  author: string;
  featured: boolean;
  accentBg: string;
  content: ContentBlock[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'how-to-reply-to-negative-google-reviews',
    title: 'How to Reply to Negative Google Reviews Without Making It Worse',
    excerpt: 'A bad response to a 1-star review can do more damage than the review itself. Here is a step-by-step guide to turning a critical review into a trust signal.',
    category: 'Review Management',
    categoryColor: 'bg-[#EDE9FF] text-[#6C55E8]',
    date: 'November 5, 2026',
    dateISO: '2026-11-05',
    readTime: '6 min read',
    author: 'Moffu Team',
    featured: true,
    accentBg: 'bg-[#EDE9FF]',
    content: [
      { type: 'p', text: 'You just got a 1-star review. The customer says the service was slow, the food was cold, or the staff were rude. Your first instinct is to defend yourself. That is exactly what you must not do.' },
      { type: 'p', text: 'The way you respond to a negative review is watched by every potential customer who reads it. Research consistently shows that how a business handles criticism matters as much as the criticism itself. A thoughtful, calm response to a 1-star review often reassures prospective customers more than ten 5-star reviews with no replies.' },
      { type: 'h2', text: 'What Not to Do' },
      { type: 'ul', items: [
        'Do not argue with the reviewer or challenge their version of events in public.',
        'Do not use a copy-paste generic apology that sounds robotic.',
        'Do not tag the reviewer or reference their name more than once.',
        'Do not promise to fix things you have no intention of fixing.',
        'Do not wait more than 48 hours to respond.',
      ]},
      { type: 'h2', text: 'The Four-Part Framework That Works' },
      { type: 'p', text: 'The best negative review responses follow a consistent structure. Once you understand it, you can adapt it to any complaint while still sounding human.' },
      { type: 'h3', text: '1. Acknowledge without excusing' },
      { type: 'p', text: 'Start by acknowledging that their experience did not meet expectations. You are not admitting guilt or confirming every detail. You are simply recognising that they left feeling disappointed, and that matters to you.' },
      { type: 'callout', text: 'Example: "Thank you for taking the time to share this. We are sorry to hear your visit did not go the way we hoped."' },
      { type: 'h3', text: '2. Take it offline' },
      { type: 'p', text: 'Never try to resolve the specifics of a complaint in a public review thread. Invite the customer to contact you directly. Include a name, an email, or a phone number so they know a real person will pick up.' },
      { type: 'h3', text: '3. Keep it short' },
      { type: 'p', text: 'A response over three paragraphs almost always sounds defensive. Two to four sentences is usually enough. The goal is to show you care, not to explain yourself at length.' },
      { type: 'h3', text: '4. End with a genuine invite' },
      { type: 'p', text: 'If appropriate, invite the customer back. A short line like "We would genuinely love another chance to do better" costs nothing and signals confidence in your business.' },
      { type: 'h2', text: 'What About Fake or Unfair Reviews' },
      { type: 'p', text: 'If a review appears to be from someone who was never a customer, or contains information that is demonstrably false, respond calmly and professionally. Something like: "We have no record of this visit but would genuinely like to understand what happened. Please reach out to us at [contact]."' },
      { type: 'p', text: 'You can also flag the review to Google for removal, but only if it clearly violates their policies. Do not expect Google to remove reviews just because they are negative.' },
      { type: 'h2', text: 'Speed Matters as Much as Content' },
      { type: 'p', text: 'A well-crafted reply posted 10 days later is far less effective than a decent reply posted within 24 hours. Set up a system, whether that is a daily review check or a tool like Moffu that alerts you when new reviews come in. The faster you respond, the more it signals you actually care.' },
      { type: 'callout', text: 'Businesses that respond to reviews within 24 hours see a measurably higher average star rating over time, because the act of responding alone encourages more people to leave positive reviews.' },
    ],
  },
  {
    slug: 'why-your-star-rating-affects-revenue',
    title: 'Why Your Star Rating Affects Revenue More Than You Think',
    excerpt: 'Moving from 3.9 stars to 4.4 stars is not just a vanity metric. It directly changes how many people click on your listing, walk through your door, and choose you over a competitor.',
    category: 'Strategy',
    categoryColor: 'bg-[#FEF3C7] text-[#92400E]',
    date: 'October 28, 2026',
    dateISO: '2026-10-28',
    readTime: '4 min read',
    author: 'Moffu Team',
    featured: false,
    accentBg: 'bg-[#FEF3C7]',
    content: [
      { type: 'p', text: 'Most business owners treat their Google star rating as a reflection of past performance. What they miss is that it is also a prediction of future revenue.' },
      { type: 'p', text: 'When someone searches for a restaurant, clinic, or shop near them, they almost always see star ratings before they see anything else. The decision of whether to click often happens before they even read a single review.' },
      { type: 'h2', text: 'The Thresholds That Actually Matter' },
      { type: 'p', text: 'Not all rating improvements are equal. Research from Harvard Business School and multiple consumer surveys points to specific thresholds where customer behaviour changes significantly.' },
      { type: 'ul', items: [
        'Below 3.5 stars: Most consumers will not consider you, regardless of other factors.',
        'Between 3.5 and 3.9 stars: You are visible but most people will keep scrolling if a 4.0+ option exists nearby.',
        'Between 4.0 and 4.4 stars: You are competitive. Customers will read your reviews before deciding.',
        'Between 4.5 and 4.9 stars: You benefit from a trust premium. People actively choose you over lower-rated alternatives even at higher prices.',
      ]},
      { type: 'h2', text: 'The Click-Through Effect' },
      { type: 'p', text: 'Google Maps and search results show your star rating prominently. Studies consistently show that listings with ratings above 4.3 receive significantly more clicks than equivalent listings at 3.8, even when the lower-rated business ranks higher in the results.' },
      { type: 'p', text: 'That click-through difference compounds. More clicks mean more visitors, more bookings, more phone calls, and ultimately more revenue. The rating does not just reflect your reputation; it shapes how many people your reputation ever reaches.' },
      { type: 'h2', text: 'How Businesses Move Their Rating' },
      { type: 'p', text: 'The two most reliable ways to improve a star rating over time are consistent response to all reviews (which signals activity and care) and a systematic approach to encouraging satisfied customers to leave reviews.' },
      { type: 'p', text: 'Businesses that respond to every review, positive and negative, consistently see their rating trend upward over 6 to 12 months. It is not because the responses change existing ratings. It is because active engagement encourages more customers to leave positive reviews, which dilutes older negative ones.' },
      { type: 'callout', text: 'A half-star improvement in your Google rating can increase the number of customers who choose your business by 19 percent, according to a Harvard Business School study on Yelp ratings. The same principle applies to Google.' },
      { type: 'h2', text: 'What This Means Practically' },
      { type: 'p', text: 'If you are sitting at 3.8 stars with 40 reviews, you do not need to get to 5.0. You need to get to 4.2. That is achievable in three to six months with a consistent response strategy and a simple process for following up with happy customers.' },
    ],
  },
  {
    slug: 'google-business-profile-review-guide',
    title: 'The Business Owner Guide to Google Business Profile Reviews',
    excerpt: 'Everything you need to know about how Google reviews work, how to get more of them, how to respond, and how to use them to grow your business.',
    category: 'Google Business Profile',
    categoryColor: 'bg-[#DCFCE7] text-[#166534]',
    date: 'October 20, 2026',
    dateISO: '2026-10-20',
    readTime: '8 min read',
    author: 'Moffu Team',
    featured: false,
    accentBg: 'bg-[#DCFCE7]',
    content: [
      { type: 'p', text: 'Google Business Profile reviews are the most visible form of social proof your business has. They appear in search results, in Maps, and on your business profile. For most local businesses, they are the first thing a potential customer sees.' },
      { type: 'p', text: 'Understanding how they work, and how to manage them well, is one of the highest-return activities a business owner can invest time in.' },
      { type: 'h2', text: 'How Google Decides Which Reviews Show First' },
      { type: 'p', text: 'Google does not just show reviews in chronological order. Its algorithm weights reviews by recency, length, usefulness, and whether the reviewer has an active Google account. Reviews with owner responses tend to rank higher in the visible stack.' },
      { type: 'p', text: 'This means that an older 5-star review with no response may be less visible than a newer 3-star review that received a thoughtful reply. Responding to reviews is not just good customer service; it is a ranking signal.' },
      { type: 'h2', text: 'Getting More Reviews Without Violating Policy' },
      { type: 'p', text: 'Google allows businesses to ask customers to leave reviews. What it prohibits is offering incentives (discounts, freebies, or anything of value) in exchange for reviews. Here is what is allowed:' },
      { type: 'ul', items: [
        'Asking customers verbally after a positive interaction.',
        'Including a review link in a follow-up email or receipt.',
        'Posting a QR code that links directly to your review page.',
        'Sending a campaign to past customers asking them to share their experience.',
      ]},
      { type: 'h3', text: 'Your Google Review Link' },
      { type: 'p', text: 'You can get a short, shareable link directly to your review page from your Google Business Profile dashboard. Go to your profile, click "Get more reviews," and copy the link. This is the URL you share in emails, on receipts, and in campaigns.' },
      { type: 'h2', text: 'Responding to Positive Reviews' },
      { type: 'p', text: 'Most businesses only think about responding to negative reviews. That is a mistake. Responding to positive reviews signals to Google that you are active, and signals to potential customers that you appreciate your existing ones.' },
      { type: 'p', text: 'You do not need a long response for a 5-star review. A short, specific reply is better than a generic "Thank you for your feedback!" Something like: "So glad you enjoyed the pasta, Sofia. See you next time!" takes ten seconds and makes the reviewer feel genuinely seen.' },
      { type: 'h2', text: 'Flagging and Removing Reviews' },
      { type: 'p', text: 'You can flag reviews that violate Google policy for removal. Google will remove reviews that contain hate speech, spam, fake content, or personal information. It will not remove reviews simply because they are negative or you disagree with them.' },
      { type: 'p', text: 'The process: open the review, click the three dots, and select "Report review." Google typically responds within a few days, but removal is not guaranteed. If the review is not removed and you believe it is false, your best response is a calm, factual public reply that contextualises it for future readers.' },
      { type: 'h2', text: 'How Often You Should Be Responding' },
      { type: 'p', text: 'Ideally, you should respond to every review. That is not realistic for most busy business owners. At a minimum, respond to every review under 4 stars within 48 hours, and respond to positive reviews at least once a week in batches.' },
      { type: 'callout', text: 'Businesses that respond to at least 25 percent of their reviews earn 35 percent more revenue on average than similar businesses that do not respond at all, according to research published in Harvard Business Review.' },
    ],
  },
  {
    slug: 'review-response-mistakes',
    title: '5 Review Response Mistakes That Cost You Customers',
    excerpt: 'Most businesses respond to reviews in ways that actually make things worse. Here are the five most common mistakes and exactly how to fix them.',
    category: 'Review Management',
    categoryColor: 'bg-[#EDE9FF] text-[#6C55E8]',
    date: 'October 10, 2026',
    dateISO: '2026-10-10',
    readTime: '5 min read',
    author: 'Moffu Team',
    featured: false,
    accentBg: 'bg-[#EDE9FF]',
    content: [
      { type: 'p', text: 'Responding to reviews is good. Responding badly is worse than not responding at all. Here are the five most common mistakes we see, and how to avoid each one.' },
      { type: 'h2', text: 'Mistake 1: The Copy-Paste Response' },
      { type: 'p', text: '"Thank you for your feedback. We appreciate your business and hope to see you again soon." If this sounds familiar, you are using a template that everyone can spot instantly.' },
      { type: 'p', text: 'Generic responses signal to future readers that you are not actually reading reviews. They also do nothing to make the reviewer feel heard. The fix: include one specific detail from their review in every response, even if it is just their name and what they ordered.' },
      { type: 'h2', text: 'Mistake 2: Getting Defensive in Public' },
      { type: 'p', text: 'A reviewer says the wait time was 45 minutes. You write back explaining that there was a staff shortage that day and that most customers wait under 20 minutes. Even if every word is true, you now look defensive to everyone reading.' },
      { type: 'p', text: 'The fix: acknowledge the experience, apologise that it did not meet expectations, and invite the conversation offline. You can share context privately. Never argue in a public forum.' },
      { type: 'h2', text: 'Mistake 3: Responding Only to Negative Reviews' },
      { type: 'p', text: 'If your review responses are exclusively apologies and damage control, your review page looks like a complaint log. Potential customers who read a mix of reviews will see you only engaging when things go wrong.' },
      { type: 'p', text: 'The fix: respond to your 5-star reviews too. These responses are easier to write, they reinforce your brand voice, and they make your whole review profile look active and engaged.' },
      { type: 'h2', text: 'Mistake 4: Responding Too Late' },
      { type: 'p', text: 'A response to a 2-star review posted 3 weeks later still appears in the review thread, but the timeliness signals that it was not a priority. Worse, the reviewer has probably already told several friends about their experience by then.' },
      { type: 'p', text: 'The fix: build a system. Check reviews daily, or use a tool that syncs your Google reviews automatically and surfaces the ones that need a response first.' },
      { type: 'h2', text: 'Mistake 5: Promising What You Cannot Deliver' },
      { type: 'p', text: 'A dissatisfied customer leaves a review and you respond: "We will make sure this never happens again." If it happens again, and they read their review thread, you have made things significantly worse.' },
      { type: 'p', text: 'The fix: be honest and specific. "We have shared your feedback with the team" is verifiably true. "This will never happen again" is not a promise you can keep.' },
      { type: 'callout', text: 'The goal of a review response is not to change the reviewer\'s mind. It is to show every future reader how your business handles problems. Write for them, not for the person who left the review.' },
    ],
  },
  {
    slug: 'turn-negative-review-into-loyal-customer',
    title: 'How to Turn a 1-Star Review Into a Loyal Customer',
    excerpt: 'The customers who complain and get heard often become your most loyal advocates. Here is how to handle the recovery conversation after a negative review.',
    category: 'Customer Experience',
    categoryColor: 'bg-[#FCE7F3] text-[#9D174D]',
    date: 'September 29, 2026',
    dateISO: '2026-09-29',
    readTime: '4 min read',
    author: 'Moffu Team',
    featured: false,
    accentBg: 'bg-[#FCE7F3]',
    content: [
      { type: 'p', text: 'There is a concept in customer service research called the "service recovery paradox." It describes a counterintuitive finding: customers who experience a problem that gets resolved well often end up more loyal than customers who never had a problem at all.' },
      { type: 'p', text: 'That means a 1-star review is not necessarily the end of a customer relationship. Handled correctly, it can be the beginning of a stronger one.' },
      { type: 'h2', text: 'The Public Response Is Just Step One' },
      { type: 'p', text: 'Your public response to the review serves a dual purpose: it shows the reviewer (and everyone reading) that you take feedback seriously, and it opens a door to a private conversation. The goal of the public response is not to resolve the issue but to invite the resolution.' },
      { type: 'p', text: 'Keep it short, human, and specific. Acknowledge what they experienced. Apologise that it fell short. Provide a direct way to reach you: a name, an email address, a phone number.' },
      { type: 'h2', text: 'What to Do When They Reach Out' },
      { type: 'p', text: 'If the customer follows up privately, they are giving you a rare second chance. Here is how to use it well:' },
      { type: 'ol', items: [
        'Listen fully before offering a solution. Ask what would make things right for them.',
        'Do not start with what you can and cannot do. Start with understanding.',
        'Offer something genuine, not performative. A discount code sent as an afterthought signals you want them gone, not back.',
        'Follow up after their next visit. A short message checking that things went better this time is rare, memorable, and powerful.',
      ]},
      { type: 'h2', text: 'When Recovery Works and When It Does Not' },
      { type: 'p', text: 'Recovery works when the original problem was a genuine one-off and the customer felt heard during the process. It is less likely to work when the problem reflects a systematic issue you are not actually fixing, or when your response focused on protecting your business rather than understanding theirs.' },
      { type: 'p', text: 'The honest version of recovery is not a customer retention tactic. It is a genuine attempt to make things right. Customers can tell the difference.' },
      { type: 'callout', text: 'Studies show that 70 percent of complaining customers will return if the issue is resolved in their favour. That number drops to below 20 percent if they never hear from you.' },
    ],
  },
  {
    slug: 'setting-up-brand-voice-for-ai-review-responses',
    title: 'What to Write in Your Brand Voice Settings for Better AI Replies',
    excerpt: 'Generic AI replies are easy to spot. This guide walks you through how to configure your brand voice so every draft sounds like it came from you, not a chatbot.',
    category: 'Brand Brain',
    categoryColor: 'bg-[#E0F2FE] text-[#075985]',
    date: 'September 15, 2026',
    dateISO: '2026-09-15',
    readTime: '5 min read',
    author: 'Moffu Team',
    featured: false,
    accentBg: 'bg-[#E0F2FE]',
    content: [
      { type: 'p', text: 'The difference between an AI-generated reply that sounds authentic and one that sounds robotic comes down almost entirely to how well you have trained the AI on your brand voice.' },
      { type: 'p', text: 'Most businesses skip this step. They turn on the tool, generate a reply, and then wonder why it sounds like it came from a customer service handbook written in 2009.' },
      { type: 'h2', text: 'Start with Tone, Not Rules' },
      { type: 'p', text: 'The first thing to define is not what your AI should say. It is how it should sound. Consider these prompts:' },
      { type: 'ul', items: [
        'If your brand were a person, how would they speak at a dinner party?',
        'What words or phrases do you actually use with customers in person?',
        'Which businesses (not necessarily in your industry) have a voice you admire?',
      ]},
      { type: 'p', text: 'From your answers, you can usually identify three or four adjectives that describe your tone accurately. "Warm, direct, and unpretentious" is a usable tone description. "Professional and friendly" is too generic to be useful.' },
      { type: 'h2', text: 'Per-Star Reply Rules That Actually Work' },
      { type: 'p', text: 'Your response to a 5-star review should be meaningfully different from your response to a 2-star review. Set specific intentions for each:' },
      { type: 'ul', items: [
        '5-star: Express genuine gratitude, reference something specific from the review, invite them back.',
        '4-star: Thank them, acknowledge that the experience was not perfect, show curiosity about what could be better.',
        '3-star: Apologise for falling short, ask for more context offline.',
        '1 to 2-star: Lead with empathy, apologise without excuses, provide direct contact information.',
      ]},
      { type: 'h2', text: 'What Your AI Should Never Say' },
      { type: 'p', text: 'The "never say" section of your brand brain configuration is as important as the positive rules. Consider including:' },
      { type: 'ul', items: [
        'Competitor names (avoid any mention, even in context).',
        'Pricing details or comparisons.',
        'Staff member surnames or last names.',
        'Phrases that sound like legal disclaimers.',
        'Anything you would not say to a customer in person.',
      ]},
      { type: 'h2', text: 'Location-Specific Context' },
      { type: 'p', text: 'If you have multiple locations, add context that is unique to each one: the neighbourhood, the team lead, any local offers or events. A reply that mentions "our team on Baker Street" immediately sounds more personal than one that could have come from any branch.' },
      { type: 'callout', text: 'The best Brand Brain configurations are written by the owner or manager, not a marketing team. They include real phrases, real names, and real opinions about what the business stands for. That specificity is what makes AI replies sound human.' },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string, count = 3): BlogPost[] {
  return POSTS.filter((p) => p.slug !== slug).slice(0, count);
}
