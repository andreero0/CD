# Unified RAG System - Complete Architecture

## Overview

This document explains how the **Document-Based RAG** and **Conversation History RAG** work together as a unified system to provide comprehensive interview coaching.

## The Complete System

### What You Have Now (Conversation History RAG)
✅ Stores conversation turns in vector database  
✅ Retrieves relevant past Q&A when questions are asked  
✅ Provides context from earlier in the interview  

### What We're Building (Document-Based RAG)
🚧 Embeds your uploaded documents (resume, story bank, frameworks)  
🚧 Retrieves relevant stories when behavioral questions are asked  
🚧 Retrieves frameworks when case questions are asked  
🚧 Combines document + conversation context for AI  

## How They Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                  Interviewer Asks Question                       │
│         "Tell me about a time you led a difficult project"       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Question Classification                         │
│              → Behavioral question detected                      │
│              → Need: Story Bank + Resume                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Parallel Retrieval                            │
│                                                                   │
│  ┌──────────────────────────┐    ┌──────────────────────────┐  │
│  │   Document Index         │    │   Conversation Index     │  │
│  │   (Your Materials)       │    │   (Chat History)         │  │
│  │                          │    │                          │  │
│  │  Search: "led project"   │    │  Search: "led project"   │  │
│  │  Filter: story, resume   │    │  Filter: this session    │  │
│  │                          │    │                          │  │
│  │  Results:                │    │  Results:                │  │
│  │  • Story: "Led team of   │    │  • Earlier you mentioned │  │
│  │    5 engineers..."       │    │    working on mobile app │  │
│  │  • Resume: "Project      │    │  • Interviewer asked     │  │
│  │    Manager at XYZ"       │    │    about leadership"     │  │
│  └──────────┬───────────────┘    └──────────┬───────────────┘  │
│             │                               │                   │
│             └───────────┬───────────────────┘                   │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Context Merging                                 │
│                                                                   │
│  Token Budget: 2000 tokens total                                │
│  • 1000 tokens for documents (50%)                              │
│  • 1000 tokens for conversation (50%)                           │
│                                                                   │
│  Combined Context:                                               │
│  <documents>                                                     │
│    <document name="Story Bank" type="story" relevance="0.89">   │
│      Led team of 5 engineers to deliver mobile app...           │
│    </document>                                                   │
│    <document name="Resume" type="resume" relevance="0.76">      │
│      Project Manager at XYZ Corp, managed $2M budget...         │
│    </document>                                                   │
│  </documents>                                                    │
│                                                                   │
│  <conversation_history>                                          │
│    <turn speaker="You" relevance="0.82">                        │
│      I worked on a mobile app project last year...              │
│    </turn>                                                       │
│    <turn speaker="Interviewer" relevance="0.71">                │
│      Tell me more about your leadership experience...           │
│    </turn>                                                       │
│  </conversation_history>                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Response Generation                        │
│                                                                   │
│  AI sees BOTH:                                                   │
│  1. Your prepared story from story bank                         │
│  2. What you've already discussed in this interview             │
│                                                                   │
│  AI suggests:                                                    │
│  "Based on your story bank, you could mention the mobile app    │
│   project where you led 5 engineers. You already mentioned      │
│   working on mobile apps earlier, so this ties in nicely..."    │
└─────────────────────────────────────────────────────────────────┘
```

## Real-World Example

### Scenario: Behavioral Interview Question

**Interviewer:** "Tell me about a time you had to deal with a difficult team member."

**What Happens:**

1. **Question Classification**
   - Type: Behavioral
   - Confidence: 0.95
   - Document Types Needed: story, resume

2. **Document Index Search**
   - Searches your story bank
   - Finds: "Conflict Resolution Story" (relevance: 0.91)
   - Finds: "Team Leadership Story" (relevance: 0.84)
   - Finds: Resume section about team management (relevance: 0.78)

3. **Conversation Index Search**
   - Searches past conversation
   - Finds: You mentioned working with diverse teams (relevance: 0.73)
   - Finds: Interviewer asked about teamwork earlier (relevance: 0.68)

4. **Context Merging**
   - Allocates 1000 tokens to documents
   - Allocates 1000 tokens to conversation
   - Combines both with XML formatting

5. **AI Suggestion**
   ```
   Based on your story bank, you have a strong example:
   
   "At my previous role, I worked with a team member who consistently 
   missed deadlines. I scheduled a 1-on-1 to understand their challenges, 
   discovered they were overwhelmed with tasks, and worked with them to 
   prioritize. This improved their performance by 40%."
   
   This ties into what you mentioned earlier about working with diverse 
   teams and shows your leadership skills from your resume.
   ```

## Different Question Types

### Behavioral Questions
**Example:** "Tell me about a time you failed"

**Retrieval Strategy:**
- **Primary:** Story Bank (80% weight)
- **Secondary:** Resume (20% weight)
- **Conversation:** Recent discussion about challenges

**Result:** Suggests prepared STAR stories from your story bank

---

### Case Questions
**Example:** "How would you estimate the market size for electric scooters?"

**Retrieval Strategy:**
- **Primary:** Framework Documents (90% weight)
- **Secondary:** Conversation (10% weight)

**Result:** Provides market sizing framework step-by-step

---

### Technical Questions
**Example:** "Explain how a hash table works"

**Retrieval Strategy:**
- **Primary:** Technical Documents (70% weight)
- **Secondary:** Resume technical skills (30% weight)

**Result:** Retrieves your technical notes and resume details

---

### Follow-up Questions
**Example:** "Can you elaborate on that project?"

**Retrieval Strategy:**
- **Primary:** Conversation History (80% weight)
- **Secondary:** Documents mentioned earlier (20% weight)

**Result:** Recalls what you just said + relevant document details

## Key Benefits of Unified System

### 1. **Comprehensive Context**
- AI sees BOTH your prepared materials AND the live conversation
- No more forgetting what you said 5 minutes ago
- No more missing opportunities to reference your stories

### 2. **Smart Routing**
- Behavioral questions → Story bank
- Case questions → Frameworks
- Follow-ups → Conversation history
- Technical → Technical docs + resume

### 3. **Consistency**
- AI ensures your responses align with what you've already said
- Prevents contradictions
- Builds coherent narrative throughout interview

### 4. **Efficiency**
- Token budget prevents context overload
- Most relevant content from each source
- Fast retrieval (<2 seconds)

## Technical Architecture

### Two Separate Indices

```
.rag-data/
├── document_index.dat          # Your uploaded documents
├── document_metadata.json      # Document chunk info
├── conversation_index.dat      # Chat history
└── conversation_metadata.json  # Conversation chunk info
```

### Why Separate?
- **Different lifecycles:** Documents persist across sessions, conversations are session-specific
- **Different update patterns:** Documents rarely change, conversations update constantly
- **Different search strategies:** Documents need type filtering, conversations need time filtering
- **Independent management:** Can rebuild one without affecting the other

### Shared Components
- Same embedding model (all-MiniLM-L6-v2)
- Same vector search algorithm (HNSW)
- Same token counting (accurate with transformers)
- Same similarity threshold (0.70)

## Migration Path

### Phase 1: Dual Index (Week 1)
- Create separate document and conversation indices
- Existing conversation RAG keeps working
- No user-facing changes

### Phase 2: Document Embedding (Week 2)
- Add embedding pipeline for uploaded documents
- Users can embed their documents
- Documents appear in retrieval results

### Phase 3: Hybrid Retrieval (Week 3)
- Combine document + conversation retrieval
- Smart question classification
- Token budget allocation

### Phase 4: UI Enhancements (Week 4)
- Show which documents were used
- Display relevance scores
- Add document type tagging

### Phase 5: Optimization (Week 5)
- Performance tuning for large document sets
- Caching and lazy loading
- Advanced question classification

## Success Metrics

### For Users
- ✅ Can upload resume, story bank, frameworks
- ✅ Get relevant story suggestions for behavioral questions
- ✅ Get framework guidance for case questions
- ✅ See which documents were used in suggestions
- ✅ Responses are consistent with earlier conversation

### For System
- ✅ Document embedding completes in <30 seconds
- ✅ Retrieval completes in <2 seconds
- ✅ Token budget never exceeded
- ✅ Both indices work independently
- ✅ No data loss on crashes

## Next Steps

1. **Review the spec:** `.kiro/specs/document-rag-system/`
2. **Start implementation:** Begin with Dual Index Manager
3. **Test incrementally:** Each component works before moving to next
4. **Integrate gradually:** Keep conversation RAG working throughout

The system is designed to be built incrementally - each phase adds value without breaking existing functionality.
