/**
 * Practice Mode - AI as Interviewer
 * Allows users to practice alone without a real interviewer
 */

class PracticeMode {
    constructor() {
        this.sessionId = null;
        this.profile = 'interview';
        this.difficulty = 'medium';
        this.flow = 'structured'; // structured, rapid-fire, deep-dive
        this.currentQuestion = null;
        this.questionHistory = [];
        this.answerHistory = [];
        this.sessionStartTime = null;
        this.questionStartTime = null;
        this.currentQuestionIndex = 0;
        this.isActive = false;
        this.questionBank = this.buildQuestionBank();
    }

    buildQuestionBank() {
        return {
            interview: {
                easy: {
                    behavioral: [
                        "Tell me about yourself and your background.",
                        "What interests you about this role?",
                        "What are your greatest strengths?",
                        "Describe a typical day in your current/previous role.",
                        "What motivates you in your work?",
                        "How do you handle feedback?",
                        "What are you looking for in your next opportunity?",
                    ],
                    technical: [
                        "What programming languages are you most comfortable with?",
                        "Explain the difference between a class and an object.",
                        "What is your development workflow?",
                        "How do you debug code?",
                        "What version control systems have you used?",
                    ],
                },
                medium: {
                    behavioral: [
                        "Tell me about a time you faced a significant challenge at work. How did you handle it?",
                        "Describe a situation where you had to work with a difficult team member.",
                        "Give me an example of when you took initiative on a project.",
                        "Tell me about a time you failed. What did you learn?",
                        "Describe a situation where you had to meet a tight deadline.",
                        "How do you prioritize when you have multiple urgent tasks?",
                        "Tell me about a time you had to persuade someone to see things your way.",
                    ],
                    technical: [
                        "Explain how you would design a URL shortener service.",
                        "What are the differences between SQL and NoSQL databases? When would you use each?",
                        "How would you optimize a slow-performing web application?",
                        "Explain the concept of REST APIs and best practices.",
                        "What is your approach to writing testable code?",
                    ],
                },
                hard: {
                    behavioral: [
                        "Tell me about the most complex project you've worked on. What made it complex and how did you navigate it?",
                        "Describe a time when you had to make a difficult decision with incomplete information.",
                        "Give me an example of when you had to balance competing priorities from different stakeholders.",
                        "Tell me about a time you had to deliver bad news to a client or manager.",
                        "Describe a situation where you had to rebuild trust with a team or client.",
                    ],
                    technical: [
                        "Design Instagram's backend architecture. Consider scalability, availability, and consistency.",
                        "How would you implement a distributed caching system?",
                        "Explain your approach to handling race conditions in a multi-threaded environment.",
                        "Design a real-time notification system that serves millions of users.",
                        "How would you architect a system to detect fraudulent transactions?",
                    ],
                },
            },
            sales: {
                easy: [
                    "Tell me about the product you're selling today.",
                    "What makes your solution different from competitors?",
                    "I'm not sure I need this right now.",
                    "Can you send me some information via email?",
                    "What's your pricing?",
                ],
                medium: [
                    "We're already working with [competitor]. Why should we switch?",
                    "Your price is higher than what we're currently paying.",
                    "I need to discuss this with my team before making a decision.",
                    "What ROI can you guarantee?",
                    "We had a bad experience with a similar product before.",
                    "How long is the implementation process?",
                ],
                hard: [
                    "We're in the middle of budget cuts and can't consider new vendors.",
                    "Your competitor just offered us a better deal. Can you match it?",
                    "We've been burned by vendors promising features that never materialized.",
                    "I'm concerned about the risk of switching our current system.",
                    "Your solution doesn't integrate with our existing tech stack.",
                ],
            },
            negotiation: {
                easy: [
                    "We're looking for a 20% discount on this contract.",
                    "Can you include free training as part of the deal?",
                    "We need more favorable payment terms.",
                    "What's the best price you can offer?",
                ],
                medium: [
                    "Your terms are too rigid. We need more flexibility.",
                    "We need you to take on more of the implementation risk.",
                    "Can you extend the warranty period by another year?",
                    "We want exclusive rights in our territory.",
                    "Your competitor is offering better terms. Why should we go with you?",
                ],
                hard: [
                    "We need a complete restructuring of the payment terms, or we walk.",
                    "Your solution needs to include features X, Y, and Z at the current price point.",
                    "We're prepared to sign today, but only if you can match these specific terms.",
                    "We need penalty clauses if you don't meet the agreed milestones.",
                ],
            },
        };
    }

    startPracticeSession(profile, difficulty = 'medium', flow = 'structured') {
        this.sessionId = Date.now().toString();
        this.profile = profile;
        this.difficulty = difficulty;
        this.flow = flow;
        this.sessionStartTime = Date.now();
        this.isActive = true;
        this.currentQuestionIndex = 0;
        this.questionHistory = [];
        this.answerHistory = [];

        console.log(`[PracticeMode] Started ${flow} session for ${profile} at ${difficulty} difficulty`);

        // Generate and return the first question
        return this.generateQuestion();
    }

    generateQuestion() {
        if (!this.isActive) {
            console.error('[PracticeMode] Cannot generate question - session not active');
            return null;
        }

        let question = null;
        const bank = this.questionBank[this.profile];

        switch (this.flow) {
            case 'structured':
                question = this.generateStructuredQuestion(bank);
                break;
            case 'rapid-fire':
                question = this.generateRapidFireQuestion(bank);
                break;
            case 'deep-dive':
                question = this.generateDeepDiveQuestion(bank);
                break;
            default:
                question = this.generateStructuredQuestion(bank);
        }

        if (question) {
            this.currentQuestion = {
                text: question,
                askedAt: Date.now(),
                index: this.currentQuestionIndex++,
            };
            this.questionHistory.push(this.currentQuestion);
            this.questionStartTime = Date.now();
            console.log(`[PracticeMode] Generated question ${this.currentQuestionIndex}:`, question);
        }

        return question;
    }

    generateStructuredQuestion(bank) {
        // Structured interview: Intro → Behavioral → Technical → Closing
        if (this.profile === 'interview') {
            const totalQuestions = this.questionHistory.length;
            const difficulties = bank[this.difficulty];

            if (totalQuestions === 0) {
                // First question - intro
                return "Thank you for joining today. Let's start with you telling me about yourself and your background.";
            } else if (totalQuestions < 4) {
                // Behavioral questions
                const questions = difficulties.behavioral || [];
                return this.getRandomQuestion(questions);
            } else if (totalQuestions < 7) {
                // Technical questions
                const questions = difficulties.technical || [];
                return this.getRandomQuestion(questions);
            } else if (totalQuestions === 7) {
                // Closing question
                return "Do you have any questions for me about the role or company?";
            } else {
                // End session
                return null;
            }
        } else {
            // For sales/negotiation - sequential from the bank
            const questions = bank[this.difficulty] || bank.easy;
            if (this.questionHistory.length < questions.length) {
                return questions[this.questionHistory.length];
            }
            return null;
        }
    }

    generateRapidFireQuestion(bank) {
        // Rapid fire: 10 quick questions, 30s each
        if (this.questionHistory.length >= 10) {
            return null; // Session complete
        }

        if (this.profile === 'interview') {
            const difficulties = bank[this.difficulty];
            const allQuestions = [
                ...(difficulties.behavioral || []),
                ...(difficulties.technical || []),
            ];
            return this.getRandomQuestion(allQuestions);
        } else {
            const questions = bank[this.difficulty] || bank.easy;
            return this.getRandomQuestion(questions);
        }
    }

    generateDeepDiveQuestion(bank) {
        // Deep dive: Single topic, multiple follow-ups
        if (this.questionHistory.length === 0) {
            // Initial question
            if (this.profile === 'interview') {
                return "Tell me about the most challenging project you've worked on. Walk me through it from start to finish.";
            } else if (this.profile === 'sales') {
                return "Walk me through your entire product offering and how it solves our pain points.";
            } else if (this.profile === 'negotiation') {
                return "Let's discuss the terms you're proposing. Walk me through each component.";
            }
        } else if (this.questionHistory.length < 5) {
            // Follow-up questions based on previous answers
            return this.generateFollowUpQuestion();
        }
        return null; // End after 5 deep questions
    }

    generateFollowUpQuestion() {
        const followUps = [
            "Can you elaborate on that specific aspect?",
            "What challenges did you encounter with that approach?",
            "How did you measure success in that situation?",
            "What would you do differently if you faced a similar situation today?",
            "Tell me more about how you made that decision.",
        ];
        return followUps[this.questionHistory.length - 1] || followUps[0];
    }

    getRandomQuestion(questions) {
        if (!questions || questions.length === 0) return null;
        const usedQuestions = this.questionHistory.map(q => q.text);
        const availableQuestions = questions.filter(q => !usedQuestions.includes(q));

        if (availableQuestions.length === 0) {
            // All questions used, pick a random one
            return questions[Math.floor(Math.random() * questions.length)];
        }

        return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    evaluateAnswer(transcript) {
        if (!this.currentQuestion || !transcript) {
            return null;
        }

        const answerDuration = Date.now() - this.questionStartTime;
        const wordCount = transcript.trim().split(/\s+/).length;

        // Store the answer
        const answerRecord = {
            questionText: this.currentQuestion.text,
            answerText: transcript,
            duration: answerDuration,
            wordCount: wordCount,
            timestamp: Date.now(),
        };

        this.answerHistory.push(answerRecord);

        // Evaluate based on criteria
        const evaluation = {
            duration: answerDuration,
            wordCount: wordCount,
            isComplete: wordCount > 20, // Basic completeness check
            answerQuality: this.assessAnswerQuality(transcript, wordCount, answerDuration),
        };

        console.log('[PracticeMode] Answer evaluation:', evaluation);
        return evaluation;
    }

    assessAnswerQuality(transcript, wordCount, duration) {
        // Basic quality assessment
        const durationSeconds = duration / 1000;

        if (wordCount < 20 || durationSeconds < 10) {
            return 'too-short';
        } else if (wordCount > 200 || durationSeconds > 180) {
            return 'too-long';
        } else if (wordCount >= 50 && durationSeconds >= 30) {
            return 'good';
        } else {
            return 'adequate';
        }
    }

    provideFeedback(evaluation) {
        if (!evaluation) return "Please provide an answer to the question.";

        switch (evaluation.answerQuality) {
            case 'too-short':
                return "Your answer was quite brief. Try to provide more detail and specific examples to strengthen your response.";
            case 'too-long':
                return "Your answer was quite lengthy. Try to be more concise and focus on the key points.";
            case 'good':
                return "Good answer! You provided sufficient detail. Let's move to the next question.";
            case 'adequate':
                return "That's a solid start. Consider adding more specific examples or details.";
            default:
                return "Keep going!";
        }
    }

    getNextQuestion() {
        // Generate the next question in the sequence
        return this.generateQuestion();
    }

    endSession() {
        if (!this.isActive) {
            return null;
        }

        const sessionEndTime = Date.now();
        const sessionDuration = sessionEndTime - this.sessionStartTime;

        const summary = {
            sessionId: this.sessionId,
            profile: this.profile,
            difficulty: this.difficulty,
            flow: this.flow,
            duration: sessionDuration,
            questionsAsked: this.questionHistory.length,
            questionsAnswered: this.answerHistory.length,
            averageAnswerLength: this.calculateAverageWordCount(),
            averageAnswerTime: this.calculateAverageAnswerTime(),
            startTime: this.sessionStartTime,
            endTime: sessionEndTime,
        };

        console.log('[PracticeMode] Session ended. Summary:', summary);

        // Reset session state
        this.isActive = false;
        this.currentQuestion = null;

        return summary;
    }

    calculateAverageWordCount() {
        if (this.answerHistory.length === 0) return 0;
        const totalWords = this.answerHistory.reduce((sum, a) => sum + a.wordCount, 0);
        return Math.round(totalWords / this.answerHistory.length);
    }

    calculateAverageAnswerTime() {
        if (this.answerHistory.length === 0) return 0;
        const totalTime = this.answerHistory.reduce((sum, a) => sum + a.duration, 0);
        return Math.round(totalTime / this.answerHistory.length / 1000); // in seconds
    }

    getSessionStats() {
        return {
            questionsAsked: this.questionHistory.length,
            questionsAnswered: this.answerHistory.length,
            currentQuestion: this.currentQuestion,
            isActive: this.isActive,
            sessionDuration: this.isActive ? Date.now() - this.sessionStartTime : 0,
        };
    }

    isSessionActive() {
        return this.isActive;
    }

    getCurrentQuestion() {
        return this.currentQuestion;
    }
}

// Export singleton instance
const practiceModeInstance = new PracticeMode();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PracticeMode, practiceModeInstance };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PracticeMode = PracticeMode;
    window.practiceModeInstance = practiceModeInstance;
}
