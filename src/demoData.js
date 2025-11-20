/**
 * Demo mode data for Cheating Daddy
 * Contains sample Q&A responses to showcase the app's capabilities without requiring an API key
 */

export const demoResponses = [
    {
        question: 'Tell me about yourself',
        withoutContext: `I'm a motivated professional with experience in software development. I enjoy working on challenging projects and collaborating with teams.`,
        withContext: `I'm a Senior Software Engineer with 5 years of experience at Microsoft, where I led the development of cloud-based microservices handling 10M+ daily requests. I specialize in building scalable distributed systems using Node.js and Go, and I'm passionate about performance optimization. Recently, I architected a caching layer that reduced API response times by 60%, which I believe would be valuable for your team's goals in improving customer experience.`,
        contextUsed: 'Resume: Senior Software Engineer at Microsoft, 5 years experience, expertise in Node.js, Go, microservices, reduced API response times by 60%',
    },
    {
        question: "What's your biggest weakness?",
        withoutContext: `I sometimes focus too much on details, but I'm working on balancing perfectionism with efficiency.`,
        withContext: `Early in my career, I tended to over-engineer solutions, which occasionally delayed project deliveries. However, I've actively addressed this by adopting agile methodologies and setting clear "definition of done" criteria. For example, during my time at Microsoft, I implemented time-boxed design reviews that helped the team ship features 30% faster while maintaining quality. This experience taught me that "good enough to ship" is often better than "perfect but late," especially in fast-paced environments like yours.`,
        contextUsed: 'Resume: Microsoft experience, agile methodologies, improved shipping speed by 30%',
    },
    {
        question: 'Why are you interested in this position?',
        withoutContext: `I'm looking for new challenges and growth opportunities. Your company has a great reputation and I think I could contribute to the team.`,
        withContext: `I'm particularly excited about this role because it aligns perfectly with my expertise in distributed systems and your company's mission to revolutionize e-commerce infrastructure. I've been following TechCorp's engineering blog and was impressed by your recent migration to event-driven architecture—that's exactly the kind of large-scale transformation I led at Microsoft. Additionally, I'm drawn to your commitment to engineering excellence and the opportunity to work with cutting-edge technologies like Kubernetes and service mesh. The challenge of scaling your platform to handle Black Friday traffic while maintaining sub-100ms latency is the type of problem I thrive on solving.`,
        contextUsed: 'Job Description: TechCorp, e-commerce infrastructure, Kubernetes, service mesh, scaling challenges. Company Research: Engineering blog, event-driven architecture migration',
    },
    {
        question: 'Describe a challenging project you worked on',
        withoutContext: `I worked on a difficult project where we had to optimize performance under tight deadlines. Through collaboration and problem-solving, we successfully delivered the solution.`,
        withContext: `At Microsoft, I led a critical project to redesign our authentication service that was experiencing 30-second latency spikes during peak traffic. The challenge was that we couldn't take the service down—it had 99.99% uptime SLA.

I assembled a cross-functional team of 5 engineers and we:
1. Implemented distributed tracing to identify the bottleneck (database connection pooling)
2. Designed a blue-green deployment strategy to roll out changes safely
3. Introduced Redis caching for frequently accessed user profiles
4. Optimized database queries that were causing N+1 problems

The result: we reduced P99 latency from 30s to 200ms, improved throughput by 400%, and maintained zero downtime. This project taught me valuable lessons about production debugging, incremental optimization, and the importance of observability—skills I'm eager to bring to similar challenges at TechCorp.`,
        contextUsed: 'Resume: Microsoft, authentication service optimization, reduced latency from 30s to 200ms, Redis, distributed tracing. Job Description: TechCorp looking for experience with high-availability systems',
    },
    {
        question: 'Where do you see yourself in 5 years?',
        withoutContext: `In 5 years, I'd like to be in a senior or leadership position, continuing to grow my technical skills and possibly managing a team.`,
        withContext: `In 5 years, I envision myself as a Principal Engineer or Engineering Manager at TechCorp, driving architectural decisions for your platform's evolution. Based on your company's growth trajectory—scaling from 1M to 10M users in the past two years—I see immense opportunity to shape the technical foundation that will support the next phase of growth.

I'm particularly interested in the path your Head of Engineering, Sarah Chen, took from Senior Engineer to VP in 6 years, as highlighted in your recent interview. I'd love to follow a similar trajectory, starting by deeply understanding your current infrastructure, then taking on increasingly complex architectural challenges, and eventually mentoring junior engineers while setting technical direction.

I'm also excited about TechCorp's investment in engineering education and your bi-annual tech conferences. Contributing to knowledge-sharing and potentially speaking at these events aligns with my goal of becoming a thought leader in distributed systems.`,
        contextUsed: 'Job Description: TechCorp, Principal Engineer track. Company Research: Sarah Chen VP Engineering interview, company growth 1M to 10M users, bi-annual tech conferences, investment in engineering education',
    },
    {
        question: 'Do you have any questions for us?',
        withoutContext: `What does a typical day look like for this role? What are the opportunities for growth? What's the team culture like?`,
        withContext: `Yes, I have several questions:

1. **About the Architecture Migration**: I noticed in your engineering blog that you're migrating to event-driven architecture. What percentage of services have been migrated so far, and what are the biggest challenges the team has faced? I'd love to hear how you're handling eventual consistency.

2. **On-Call and Production Support**: How does your team handle production incidents? Do you follow a SRE model or do engineers own their services end-to-end? At Microsoft, we practiced "you build it, you run it"—I'm curious about your approach.

3. **Team Composition and Collaboration**: I saw the role mentions working with data science teams. Can you tell me more about how engineering and data science collaborate at TechCorp? Are there embedded data scientists in engineering teams?

4. **Your Experience**: Sarah, I noticed you joined TechCorp 6 years ago and have been through significant growth. What's been the most rewarding aspect of that journey, and what advice would you give someone joining the team today?

5. **Black Friday Preparation**: Given the mention of scaling for peak traffic, how far in advance does the team start preparing for Black Friday, and what does that process look like?`,
        contextUsed: 'Job Description: TechCorp, working with data science teams, scaling for peak traffic. Company Research: Engineering blog about event-driven architecture, Sarah Chen VP Engineering with 6 years at company, Black Friday traffic challenges',
    },
];

/**
 * Get a demo response for a specific question
 * @param {number} index - Index of the demo response to retrieve
 * @returns {Object} Demo response object
 */
export function getDemoResponse(index) {
    if (index < 0 || index >= demoResponses.length) {
        return null;
    }
    return demoResponses[index];
}

/**
 * Get all demo responses
 * @returns {Array} Array of all demo responses
 */
export function getAllDemoResponses() {
    return demoResponses;
}

/**
 * Get demo responses for display in demo mode
 * Returns responses with context by default
 * @param {boolean} withContext - Whether to return responses with or without context
 * @returns {Array<string>} Array of response strings
 */
export function getDemoResponsesForDisplay(withContext = true) {
    return demoResponses.map(item => {
        const response = withContext ? item.withContext : item.withoutContext;
        return `**Question: ${item.question}**\n\n${response}`;
    });
}

/**
 * Get a random demo response
 * @param {boolean} withContext - Whether to return response with or without context
 * @returns {string} Random demo response
 */
export function getRandomDemoResponse(withContext = true) {
    const randomIndex = Math.floor(Math.random() * demoResponses.length);
    const item = demoResponses[randomIndex];
    const response = withContext ? item.withContext : item.withoutContext;
    return `**Question: ${item.question}**\n\n${response}`;
}

/**
 * Context improvement examples for onboarding
 */
export const contextExamples = {
    beforeAfter: [
        {
            scenario: 'Job Interview Question',
            question: 'Tell me about yourself',
            without: {
                label: 'Without Context',
                response:
                    "I'm a motivated professional with experience in software development. I enjoy working on challenging projects and collaborating with teams.",
                quality: 'Generic and forgettable',
            },
            with: {
                label: 'With Context (Resume + Job Description)',
                response:
                    "I'm a Senior Software Engineer with 5 years at Microsoft, where I led microservices handling 10M+ daily requests. I specialize in Node.js and Go, and recently reduced API response times by 60%—which aligns perfectly with your team's focus on performance optimization.",
                quality: 'Specific, relevant, and impressive',
            },
        },
        {
            scenario: 'Sales Call',
            question: 'Why should we choose your product?',
            without: {
                label: 'Without Context',
                response: "Our product has great features and competitive pricing. We've been in business for many years and have satisfied customers.",
                quality: 'Vague value proposition',
            },
            with: {
                label: 'With Context (Customer Research + Product Info)',
                response:
                    "Based on your company's recent challenges with manual data entry—which you mentioned costs 20 hours per week—our automation platform can reduce that to 2 hours while improving accuracy to 99.8%. Companies similar to yours typically see ROI within 3 months.",
                quality: 'Addresses specific pain points with quantified benefits',
            },
        },
    ],
    tips: [
        'Paste your resume for personalized interview answers that highlight your actual experience',
        'Include job descriptions to align your responses with what the company is looking for',
        'Add company research notes to show you understand their challenges and culture',
        'For sales calls, include customer research to tailor your pitch to their specific needs',
        'The AI will automatically weave your context into natural, conversational responses',
    ],
};

export default {
    demoResponses,
    getDemoResponse,
    getAllDemoResponses,
    getDemoResponsesForDisplay,
    getRandomDemoResponse,
    contextExamples,
};
