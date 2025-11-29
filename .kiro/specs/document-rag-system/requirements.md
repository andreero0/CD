# Requirements Document - Document-Based RAG System

## Introduction

The Document-Based RAG System enables intelligent retrieval from uploaded personal documents (resume, story bank, case frameworks) during live interviews. When an interviewer asks a question, the system semantically searches your documents and suggests relevant stories, experiences, and frameworks to help you respond effectively.

## Glossary

- **Document RAG**: Retrieval-Augmented Generation system that retrieves from uploaded documents (not conversation history)
- **Story Bank**: Collection of personal experiences and examples stored in documents
- **Framework Library**: Case interview frameworks and problem-solving approaches stored in documents
- **Semantic Search**: Finding relevant content based on meaning, not just keywords
- **Document Chunk**: A segment of a document (typically 500-1000 characters) with embeddings
- **Hybrid RAG**: System that retrieves from both documents AND conversation history
- **Document Index**: Vector database containing embeddings of all uploaded documents

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload my personal documents (resume, story bank, frameworks), so that the AI can retrieve relevant content during interviews.

#### Acceptance Criteria

1. WHEN a user uploads a PDF document THEN the system SHALL parse the document and extract text content
2. WHEN a document is uploaded THEN the system SHALL chunk the document into semantic segments of 500-1000 characters
3. WHEN document chunks are created THEN the system SHALL generate embeddings for each chunk using the same model as conversation history (all-MiniLM-L6-v2)
4. WHEN embeddings are generated THEN the system SHALL store them in the document index with metadata (document name, page number, chunk index)
5. WHEN a document is uploaded THEN the system SHALL provide progress feedback to the user

### Requirement 2

**User Story:** As a user, I want the system to automatically embed my documents when I upload them, so that they're immediately available for retrieval during interviews.

#### Acceptance Criteria

1. WHEN a document upload completes THEN the system SHALL automatically trigger the embedding pipeline
2. WHEN the embedding pipeline runs THEN the system SHALL process documents in batches to avoid blocking the UI
3. WHEN embeddings are being generated THEN the system SHALL display progress (e.g., "Processing document 2 of 5...")
4. WHEN embedding fails THEN the system SHALL log the error and continue with remaining documents
5. WHEN all documents are embedded THEN the system SHALL update the document index and save it to disk

### Requirement 3

**User Story:** As a user, I want the system to retrieve relevant stories from my story bank when the interviewer asks behavioral questions, so that I can respond with appropriate examples.

#### Acceptance Criteria

1. WHEN the interviewer asks a behavioral question THEN the system SHALL classify it as requiring story retrieval
2. WHEN a story retrieval is triggered THEN the system SHALL search the document index for relevant stories with minimum similarity threshold of 0.70
3. WHEN relevant stories are found THEN the system SHALL rank them by relevance score
4. WHEN multiple stories match THEN the system SHALL return the top 3 most relevant stories
5. WHEN stories are retrieved THEN the system SHALL format them with document name and relevance score for the AI

### Requirement 4

**User Story:** As a user, I want the system to retrieve relevant frameworks when the interviewer asks case questions, so that I can structure my analysis properly.

#### Acceptance Criteria

1. WHEN the interviewer asks a case question THEN the system SHALL classify it as requiring framework retrieval
2. WHEN a framework retrieval is triggered THEN the system SHALL search documents tagged as "framework" or "case"
3. WHEN relevant frameworks are found THEN the system SHALL return the complete framework structure
4. WHEN multiple frameworks match THEN the system SHALL prioritize by relevance to the specific case type
5. WHEN frameworks are retrieved THEN the system SHALL format them clearly for the AI to present step-by-step

### Requirement 5

**User Story:** As a user, I want the system to combine document retrieval with conversation history, so that the AI has complete context from both sources.

#### Acceptance Criteria

1. WHEN the interviewer asks a question THEN the system SHALL retrieve from BOTH documents and conversation history
2. WHEN retrieving from both sources THEN the system SHALL allocate token budget appropriately (50% documents, 50% conversation)
3. WHEN combining results THEN the system SHALL deduplicate any overlapping content
4. WHEN formatting context THEN the system SHALL clearly separate document context from conversation context using XML tags
5. WHEN token limits are exceeded THEN the system SHALL prioritize document context over older conversation history

### Requirement 6

**User Story:** As a user, I want to tag my documents by type (resume, story, framework, technical), so that retrieval is more accurate.

#### Acceptance Criteria

1. WHEN uploading a document THEN the system SHALL allow the user to select a document type
2. WHEN a document type is selected THEN the system SHALL store it as metadata with the document
3. WHEN retrieving content THEN the system SHALL filter by document type based on question classification
4. WHEN the question is behavioral THEN the system SHALL prioritize "story" and "resume" documents
5. WHEN the question is case-related THEN the system SHALL prioritize "framework" documents

### Requirement 7

**User Story:** As a user, I want to see which documents were used to generate suggestions, so that I can verify the AI's recommendations.

#### Acceptance Criteria

1. WHEN the AI suggests a response THEN the system SHALL display which documents were retrieved
2. WHEN displaying document sources THEN the system SHALL show document name and relevance score
3. WHEN a user clicks on a document source THEN the system SHALL highlight the specific chunk that was retrieved
4. WHEN no relevant documents are found THEN the system SHALL indicate that the response is based on conversation history only
5. WHEN document retrieval fails THEN the system SHALL gracefully fallback to conversation-only mode

### Requirement 8

**User Story:** As a user, I want the system to re-embed documents when I update them, so that retrieval stays accurate.

#### Acceptance Criteria

1. WHEN a user deletes a document THEN the system SHALL remove its embeddings from the document index
2. WHEN a user uploads a document with the same name THEN the system SHALL replace the old embeddings
3. WHEN the document index is updated THEN the system SHALL save the changes to disk immediately
4. WHEN re-embedding occurs THEN the system SHALL not interrupt active interview sessions
5. WHEN the index is corrupted THEN the system SHALL rebuild it from stored documents

### Requirement 9

**User Story:** As a user, I want the system to handle large documents efficiently, so that upload and retrieval remain fast.

#### Acceptance Criteria

1. WHEN a document exceeds 10,000 words THEN the system SHALL chunk it into smaller segments
2. WHEN chunking large documents THEN the system SHALL preserve semantic boundaries (paragraphs, sections)
3. WHEN generating embeddings THEN the system SHALL process chunks in batches of 10 to avoid memory issues
4. WHEN the document index exceeds 1,000 chunks THEN the system SHALL optimize search performance
5. WHEN retrieval takes longer than 2 seconds THEN the system SHALL display a loading indicator

### Requirement 10

**User Story:** As a user, I want the system to intelligently classify questions to determine which documents to search, so that retrieval is fast and relevant.

#### Acceptance Criteria

1. WHEN the interviewer asks a question THEN the system SHALL classify it as behavioral, case, technical, or general
2. WHEN the question is behavioral THEN the system SHALL search story bank and resume documents
3. WHEN the question is case-related THEN the system SHALL search framework documents
4. WHEN the question is technical THEN the system SHALL search technical documents and resume
5. WHEN the question is general THEN the system SHALL search all document types

### Requirement 11

**User Story:** As a user, I want the system to maintain separate indices for documents and conversation history, so that they can be managed independently.

#### Acceptance Criteria

1. WHEN the system initializes THEN the system SHALL create two separate vector indices (documents and conversation)
2. WHEN storing embeddings THEN the system SHALL route document embeddings to the document index
3. WHEN storing embeddings THEN the system SHALL route conversation embeddings to the conversation index
4. WHEN retrieving content THEN the system SHALL query both indices in parallel
5. WHEN saving indices THEN the system SHALL save document and conversation indices to separate files

### Requirement 12

**User Story:** As a user, I want the system to provide real-time feedback during document processing, so that I know the system is working.

#### Acceptance Criteria

1. WHEN document upload starts THEN the system SHALL display "Uploading document..."
2. WHEN parsing begins THEN the system SHALL display "Extracting text from PDF..."
3. WHEN chunking occurs THEN the system SHALL display "Creating document chunks..."
4. WHEN embedding begins THEN the system SHALL display "Generating embeddings (X of Y)..."
5. WHEN processing completes THEN the system SHALL display "Document ready for retrieval!"
