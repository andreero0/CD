# Consultant Interview - Custom Prompt Template

This template helps you configure Prism for **management consulting case interviews** (McKinsey, BCG, Bain, etc.).

## How to Use This Template

1. **Copy the template below** and customize it with your information
2. **Paste it into the "User-provided context" field** during app setup (onboarding screen)
3. **Enable Google Search** in Settings → Advanced (recommended for current market data)
4. **Select "Job Interview" profile** in the app settings

---

## Custom Prompt Template

```
CANDIDATE PROFILE:
- Name: [Your Name]
- Target Firms: [e.g., McKinsey, BCG, Bain, Strategy&]
- Background: [e.g., MBA from Wharton, 3 years in tech, focus on healthcare consulting]
- Key Strengths: [e.g., Quantitative analysis, market sizing, strategic frameworks]

INTERVIEW CONTEXT:
- Interview Round: [e.g., First Round, Final Round, Partner Interview]
- Office: [e.g., New York, London, San Francisco]
- Industry Focus: [e.g., Healthcare, Tech, Financial Services, Retail]
- Case Types Practiced: [e.g., Profitability, Market Entry, Pricing, M&A]

PREFERRED FRAMEWORKS:
- Profitability: Revenue (Volume × Price) & Costs (Fixed + Variable)
- Market Entry: Market attractiveness, Competitive landscape, Company capabilities
- Pricing: Cost-based, Value-based, Competition-based
- M&A: Synergies, Valuation, Integration risks
- Market Sizing: Top-down, Bottom-up, Triangulation

SPECIFIC GUIDANCE NEEDED:
- Always synthesize the question before diving in
- Ask 2-3 clarifying questions (geography, timeframe, objectives)
- State my framework clearly before analyzing
- Walk through buckets systematically (Revenue → Costs, or Market → Company)
- Provide structured hypothesis with 2-3 key supporting reasons
- Use specific numbers when possible (e.g., "20% market share" not "significant share")
- Think like a consultant: MECE (Mutually Exclusive, Collectively Exhaustive)

CASE INTERVIEW STYLE:
- Firm Style: [McKinsey: hypothesis-driven | BCG: frameworks | Bain: practical]
- Response Style: Concise, structured, confident, ready to speak
- Avoid: Generic advice, obvious points, rambling
```

---

## Example: Filled Template

```
CANDIDATE PROFILE:
- Name: Sarah Johnson
- Target Firms: McKinsey, BCG
- Background: MBA from Harvard Business School, 4 years in product management at Google, pivoting to healthcare strategy consulting
- Key Strengths: Tech industry knowledge, data-driven analysis, go-to-market strategy

INTERVIEW CONTEXT:
- Interview Round: First Round (Case + Fit)
- Office: New York
- Industry Focus: Healthcare, Digital Health, Life Sciences
- Case Types Practiced: Market sizing, Profitability, Market entry, Pricing

PREFERRED FRAMEWORKS:
- Profitability: Revenue (Volume × Price) & Costs (Fixed + Variable)
- Market Entry: Market attractiveness (size, growth, profitability), Competitive landscape (competitors, barriers), Company capabilities (fit, differentiation)
- Pricing: Customer willingness to pay, Competitor pricing, Cost structure
- Market Sizing: Top-down (population → segment → usage) or Bottom-up (locations × customers per location)

SPECIFIC GUIDANCE NEEDED:
- Always restate the question to confirm understanding
- Ask clarifying questions about: geography, timeframe, specific segment, objective (profit vs growth)
- Announce my framework before diving in (e.g., "I'll look at this through Revenue and Cost buckets")
- Break down Revenue as Volume × Price, Costs as Fixed + Variable
- For healthcare cases, consider: regulatory environment, reimbursement, patient outcomes
- Provide clear hypothesis with supporting data points
- Think MECE - no overlaps, no gaps in analysis

CASE INTERVIEW STYLE:
- Firm Style: McKinsey hypothesis-driven approach - start with educated guess, test it
- Response Style: Structured, concise, data-driven, confident
- Avoid: Jumping to solutions without clarifying, vague generalizations, ignoring industry context
```

---

## Tips for Best Results

### 1. Enable Google Search ✅
- Go to **Settings → Advanced → Google Search: ON**
- This allows the AI to fetch **current market data, recent news, and up-to-date statistics**
- Essential for cases involving recent events, company performance, or industry trends

### 2. Be Specific in Your Context
The more specific you are, the better the AI can tailor responses:
- ✅ "Healthcare consulting with focus on digital therapeutics and value-based care"
- ❌ "Consulting"

### 3. Include Your Frameworks
List the specific frameworks you want to use:
- Profit Tree (Revenue × Costs)
- 4Cs (Customers, Competitors, Company, Context/Climate)
- Porter's Five Forces
- Value Chain Analysis
- BCG Growth-Share Matrix

### 4. Mention Your Weaknesses
If you struggle with certain types of cases, mention it:
- "Need help with market sizing - tend to miss key segments"
- "Want to improve brainstorming for new revenue streams"
- "Need better structure for operations cases"

### 5. Specify Your Target Firms
Different firms have different styles:
- **McKinsey**: Hypothesis-driven, top-down, big picture strategy
- **BCG**: Framework-heavy, creative problem-solving, outside-in perspective
- **Bain**: Practical, results-oriented, bottom-up analysis
- **Deloitte/PwC**: Industry-specific, operational focus

---

## What the AI Will Do

With this custom prompt configured, the AI will:

1. ✅ **Synthesize the question** back to you to confirm understanding
2. ✅ **Ask 2-3 clarifying questions** before diving into analysis
3. ✅ **State a clear framework** (e.g., "I'll look at Revenue and Costs")
4. ✅ **Walk through structured buckets** systematically
5. ✅ **Provide a clear hypothesis** with supporting reasons
6. ✅ **Use consulting terminology** (MECE, hypothesis-driven, buckets, etc.)
7. ✅ **Give concise, ready-to-speak responses** you can say directly

---

## Example Output with Template

**Interviewer**: "Our retail client is experiencing declining profits. How would you approach this?"

**AI Response (with consultant template)**:

> So we're looking at a profitability decline for a retail client. Can I clarify a few things first? What geography are we focused on? What's the timeframe for this decline? And are we seeing decline in absolute profits or profit margins?
>
> Assuming those are answered, I'd approach this by looking at two main buckets: **Revenue** and **Costs**.
>
> **Revenue side:**
> - **Volume**: Are we losing customers? Is market share declining? Foot traffic issues?
> - **Price**: Pricing pressure from competitors? Increased discounting? Product mix shift to lower-margin items?
>
> **Cost side:**
> - **Fixed costs**: Rent increases? Overhead expansion?
> - **Variable costs**: COGS increases? Supply chain issues? Labor cost inflation?
>
> I'd start with revenue components first since retail often faces volume pressures from e-commerce competition, then examine cost structure if revenue isn't the primary driver.

---

## Troubleshooting

### AI still giving generic responses?

1. **Check Google Search is enabled** - Settings → Google Search = ON
2. **Verify you're using "Job Interview" profile** - Not "Meeting" or other profiles
3. **Restart the app** after updating your custom prompt
4. **Add more specificity** to your custom prompt about consultant interview style

### Want to update your custom prompt later?

Unfortunately, there's no UI to edit it after onboarding currently. To change it:

1. Open browser DevTools (Right-click → Inspect → Console)
2. Run: `localStorage.setItem('customPrompt', 'YOUR_NEW_PROMPT_HERE')`
3. Restart the app
4. Or: Clear app data and go through onboarding again with new prompt

---

## Google Search: When to Enable?

**Enable Google Search (Recommended)** ✅
- Cases involving recent events, market conditions, or current news
- Company-specific questions (recent acquisitions, performance, strategy)
- Industry trends and regulatory changes
- Current statistics and market data

**You can disable Google Search** if:
- Practicing pure framework application
- Focusing on structure over current data
- Want faster responses (no search latency)

---

## Support

If you have questions or need help customizing your consultant interview setup, please check:
- [Prism Documentation](https://github.com/your-repo)
- [Example Case Interview Prompts](./examples/)

Good luck with your interviews! 🎯
