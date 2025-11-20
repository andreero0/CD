# RAG System Usage Examples

## Basic Usage

### 1. Initialize RAG System

The RAG system is automatically initialized when a new conversation session starts. You can also manually initialize it:

```javascript
// Main process
const { initializeRAG } = require('./utils/ragController');
await initializeRAG();

// Renderer process
await window.ragClient.initializeRAG();
```

### 2. Process Conversation History

When you have existing conversation history that you want to index:

```javascript
const conversationHistory = [
    {
        timestamp: Date.now(),
        transcription: "What is React?",
        ai_response: "React is a JavaScript library for building user interfaces..."
    },
    {
        timestamp: Date.now(),
        transcription: "How does useState work?",
        ai_response: "useState is a React Hook that lets you add state to functional components..."
    }
];

const result = await processConversationHistory('session-123', conversationHistory);
console.log(`Processed ${result.chunksProcessed} chunks`);
```

### 3. Retrieve Context for a Question

When you need to answer a new question with relevant context:

```javascript
const question = "Can you explain React hooks again?";
const sessionId = 'session-123';

const result = await retrieveContext(question, sessionId, {
    topK: 5,           // Get top 5 most relevant chunks
    minScore: 0.6,     // Only chunks with >60% similarity
    maxTokens: 500     // Limit total tokens to 500
});

if (result.usedRAG) {
    console.log('✓ RAG retrieval successful');
    console.log('Context:', result.context);
    console.log('Retrieved chunks:', result.chunks.length);
    console.log('Average similarity:', result.avgScore.toFixed(2));
    console.log('Estimated tokens:', result.tokensEstimate);
} else {
    console.log('× Fallback to full context');
    console.log('Reason:', result.reason);
}
```

### 4. Process New Conversation Turn

Each time a new conversation turn is saved, it's automatically processed with RAG:

```javascript
// This happens automatically in gemini.js
const turn = {
    timestamp: Date.now(),
    transcription: "What are the benefits of using hooks?",
    ai_response: "Hooks provide several benefits: 1) Simpler code..."
};

await processNewTurn('session-123', turn);
```

## Advanced Usage

### Custom Retrieval Options

```javascript
const result = await retrieveContext(question, sessionId, {
    topK: 10,              // Retrieve more chunks
    minScore: 0.5,         // Lower threshold for more results
    includeMetadata: true, // Include session metadata
    maxTokens: 800,        // Allow more tokens
    metadataTokens: 100,   // Reserve tokens for metadata
    fallbackToFull: false  // Never fallback to full context
});
```

### Get RAG Statistics

```javascript
const stats = await window.ragClient.getRAGStats();

console.log('RAG System Statistics:');
console.log('  Initialized:', stats.initialized);
console.log('  Current Session:', stats.currentSession);
console.log('  Index Elements:', stats.index.numElements);
console.log('  Index Capacity:', stats.index.maxElements);
console.log('  Utilization:', stats.index.utilizationPercent.toFixed(1) + '%');
```

### Clear Session Data

```javascript
// Clear RAG data for a specific session
await clearSessionData('session-123');

// Or reset the entire RAG system
await window.ragClient.resetRAG();
```

## Integration with Gemini AI

### Example: Enhanced Question Answering

```javascript
// When processing a manual screenshot or text question
async function answerQuestionWithRAG(question, sessionId) {
    // 1. Retrieve relevant context
    const ragResult = await window.ragClient.retrieveContext(question, sessionId);

    // 2. Build enhanced prompt
    let prompt = question;

    if (ragResult.usedRAG) {
        // Prepend relevant context
        prompt = `Context from previous conversation:\n${ragResult.context}\n\nQuestion: ${question}`;
        console.log(`Using RAG context (${ragResult.chunks.length} chunks, avg similarity: ${ragResult.avgScore.toFixed(2)})`);
    } else {
        console.log(`Using original question (fallback: ${ragResult.reason})`);
    }

    // 3. Send to AI
    await window.cheddar.sendTextMessage(prompt);
}

// Usage
await answerQuestionWithRAG("What did we discuss about React hooks?", 'session-123');
```

### Example: Conversation Summary

```javascript
async function generateConversationSummary(sessionId) {
    // Retrieve all conversation chunks
    const result = await window.ragClient.retrieveContext(
        "Summarize our entire conversation",
        sessionId,
        { topK: 20, minScore: 0.0 }  // Get all chunks
    );

    console.log('Summary based on', result.chunks.length, 'conversation chunks');
    return result.context;
}
```

## Performance Optimization

### Batch Processing

When you have multiple questions to process:

```javascript
const questions = [
    "What is React?",
    "How does useState work?",
    "Explain useEffect"
];

// Process in parallel
const results = await Promise.all(
    questions.map(q => window.ragClient.retrieveContext(q, sessionId))
);

results.forEach((result, i) => {
    console.log(`Q${i+1}: ${result.usedRAG ? 'RAG' : 'Fallback'} (${result.avgScore?.toFixed(2)})`);
});
```

### Preload for Performance

```javascript
// Preload the embeddings model at app start
async function preloadRAG() {
    console.log('Preloading RAG system...');
    const startTime = Date.now();

    await window.ragClient.initializeRAG();

    // Generate a test embedding to trigger model download
    const { generateEmbedding } = require('./utils/embeddings');
    await generateEmbedding("test");

    console.log(`RAG preloaded in ${Date.now() - startTime}ms`);
}

// Call on app load
window.addEventListener('load', preloadRAG);
```

## Monitoring and Debugging

### Log RAG Operations

```javascript
// Enable verbose logging
const originalRetrieve = window.ragClient.retrieveContext;
window.ragClient.retrieveContext = async function(question, sessionId, options) {
    console.log('[RAG] Retrieving context for:', question.substring(0, 50) + '...');
    const startTime = Date.now();

    const result = await originalRetrieve(question, sessionId, options);

    console.log('[RAG] Retrieved in', Date.now() - startTime, 'ms');
    console.log('[RAG] Result:', {
        usedRAG: result.usedRAG,
        chunks: result.chunks?.length,
        avgScore: result.avgScore?.toFixed(2),
        tokens: result.tokensEstimate
    });

    return result;
};
```

### Benchmark RAG Performance

```javascript
async function benchmarkRAG(sessionId) {
    const testQuestions = [
        "What is JavaScript?",
        "How do I use async/await?",
        "Explain closure in JavaScript"
    ];

    console.log('Benchmarking RAG system...');
    const results = [];

    for (const question of testQuestions) {
        const start = Date.now();
        const result = await window.ragClient.retrieveContext(question, sessionId);
        const duration = Date.now() - start;

        results.push({
            question,
            duration,
            usedRAG: result.usedRAG,
            chunks: result.chunks?.length || 0,
            avgScore: result.avgScore || 0
        });
    }

    console.table(results);

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`Average retrieval time: ${avgDuration.toFixed(0)}ms`);
}
```

## Error Handling

### Graceful Fallback

```javascript
async function safeRetrieveContext(question, sessionId) {
    try {
        const result = await window.ragClient.retrieveContext(question, sessionId);

        if (result.usedRAG) {
            return result.context;
        } else {
            console.warn('RAG fallback:', result.reason);
            // Use alternative method
            return getFullConversationContext(sessionId);
        }
    } catch (error) {
        console.error('RAG error:', error);
        // Fallback to basic approach
        return question;
    }
}
```

### Retry Logic

```javascript
async function retrieveWithRetry(question, sessionId, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await window.ragClient.retrieveContext(question, sessionId);
            if (result.usedRAG) {
                return result;
            }
        } catch (error) {
            console.warn(`Retry ${i+1}/${maxRetries}:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

## Best Practices

1. **Initialize Early**: Initialize RAG system at app start for better performance
2. **Monitor Stats**: Regularly check index stats to ensure it's not full
3. **Adjust Thresholds**: Fine-tune `minScore` based on your use case
4. **Batch Updates**: Process multiple turns together when possible
5. **Clean Old Data**: Periodically clear old session data to save space
6. **Log Performance**: Monitor retrieval times and adjust accordingly
7. **Handle Failures**: Always have a fallback strategy
8. **Test Thoroughly**: Test with real conversation data

## Common Patterns

### Pattern 1: Smart Context Window

```javascript
async function getSmartContext(question, sessionId, maxTokens = 2000) {
    // Try RAG first
    const ragResult = await window.ragClient.retrieveContext(question, sessionId, {
        maxTokens: Math.floor(maxTokens * 0.7)  // Use 70% for RAG
    });

    if (ragResult.usedRAG && ragResult.avgScore > 0.7) {
        return ragResult.context;
    }

    // Fallback to recent conversation
    const recentTurns = await getRecentConversation(sessionId, maxTokens);
    return recentTurns;
}
```

### Pattern 2: Contextual Suggestions

```javascript
async function suggestRelatedQuestions(currentQuestion, sessionId) {
    const result = await window.ragClient.retrieveContext(currentQuestion, sessionId, {
        topK: 10
    });

    if (!result.usedRAG) return [];

    // Extract unique topics from retrieved chunks
    const topics = result.chunks
        .map(chunk => extractKeywords(chunk.text))
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i);

    return topics.slice(0, 5);
}
```

### Pattern 3: Adaptive Threshold

```javascript
async function adaptiveRetrieve(question, sessionId) {
    // Try with high threshold first
    let result = await window.ragClient.retrieveContext(question, sessionId, {
        minScore: 0.8
    });

    // If no results, lower threshold
    if (!result.usedRAG || result.chunks.length === 0) {
        result = await window.ragClient.retrieveContext(question, sessionId, {
            minScore: 0.5
        });
    }

    return result;
}
```
