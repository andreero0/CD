# 📚 Prism Documentation

Welcome to the Prism documentation! This guide will help you find the information you need.

## 🚀 Quick Start

- **New to Prism?** → Start with [README.md](README.md)
- **Setting up development?** → Read [AGENTS.md](AGENTS.md)
- **Looking for specific docs?** → See [Complete Documentation Index](docs/DOCUMENTATION_INDEX.md)

## 📖 Documentation Structure

All documentation has been organized into the `docs/` directory with the following structure:

```
docs/
├── DOCUMENTATION_INDEX.md          # Complete documentation index
├── RAG_SYSTEM.md                   # RAG architecture documentation
├── RAG_USAGE_EXAMPLES.md           # RAG usage examples
├── agent-reports/                  # Implementation reports from AI agents
├── development/                    # Development and PR documentation
├── guides/                         # User and developer guides
├── implementations/                # Technical implementation details
├── reference/                      # Reference materials and code docs
├── security/                       # Security documentation
└── setup/                          # Setup and configuration guides
```

## 🔍 Find What You Need

### For Users

| I want to... | Go to... |
|--------------|----------|
| Understand what Prism does | [README.md](README.md) |
| Set up audio capture on macOS | [docs/setup/BLACKHOLE_SETUP.md](docs/setup/BLACKHOLE_SETUP.md) |
| Learn about the coaching loop | [docs/guides/QUICK_START_COACHING_LOOP.md](docs/guides/QUICK_START_COACHING_LOOP.md) |
| Use the RAG system | [docs/guides/RAG_USAGE_EXAMPLES.md](docs/guides/RAG_USAGE_EXAMPLES.md) |
| Configure the system | [docs/reference/CONFIGURATION.md](docs/reference/CONFIGURATION.md) |

### For Developers

| I want to... | Go to... |
|--------------|----------|
| Understand the codebase | [docs/reference/CODE_EXPLANATION.md](docs/reference/CODE_EXPLANATION.md) |
| Follow development guidelines | [AGENTS.md](AGENTS.md) |
| Review security fixes | [docs/security/SECURITY_FIXES.md](docs/security/SECURITY_FIXES.md) |
| Understand RAG architecture | [docs/implementations/RAG_SYSTEM.md](docs/implementations/RAG_SYSTEM.md) |
| See implementation details | [docs/implementations/](docs/implementations/) |
| Configure system settings | [docs/reference/CONFIGURATION.md](docs/reference/CONFIGURATION.md) |

### For Contributors

| I want to... | Go to... |
|--------------|----------|
| Submit a PR | [docs/development/PR_DESCRIPTION.md](docs/development/PR_DESCRIPTION.md) (example) |
| Understand past implementations | [docs/agent-reports/](docs/agent-reports/) |
| Review improvements made | [docs/agent-reports/IMPROVEMENTS_SUMMARY.md](docs/agent-reports/IMPROVEMENTS_SUMMARY.md) |

## 📂 Key Documents

### Essential Reading
1. **[README.md](README.md)** - Project overview and quick start
2. **[AGENTS.md](AGENTS.md)** - Development guidelines and standards
3. **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)** - Complete documentation index

### Feature Documentation
- **RAG System**: [docs/implementations/RAG_SYSTEM.md](docs/implementations/RAG_SYSTEM.md)
- **Coaching Loop**: [docs/implementations/COACHING_LOOP_IMPLEMENTATION.md](docs/implementations/COACHING_LOOP_IMPLEMENTATION.md)
- **Correlation ID System**: [docs/implementations/CORRELATION_ID_IMPLEMENTATION.md](docs/implementations/CORRELATION_ID_IMPLEMENTATION.md)
- **Configuration**: [docs/reference/CONFIGURATION.md](docs/reference/CONFIGURATION.md)

### Implementation Reports
All agent implementation reports are in [docs/agent-reports/](docs/agent-reports/):
- Agent 6: UX Controls & Analytics Dashboard
- Agent 9: Session Flow & Permission Handling
- Agent 11: Response Context Capture & View Modes
- And more...

## 🗂️ Document Categories

### Agent Reports (`docs/agent-reports/`)
Historical records of features implemented by AI agents. These provide detailed implementation notes, decisions made, and testing guidance.

### Development (`docs/development/`)
Documentation for developers contributing to the project, including PR templates and workflows.

### Guides (`docs/guides/`)
Step-by-step guides for accomplishing specific tasks, both for users and developers.

### Implementations (`docs/implementations/`)
Detailed technical documentation of major system implementations and architectures.

### Reference (`docs/reference/`)
Comprehensive reference materials including line-by-line code explanations.

### Security (`docs/security/`)
Security-related documentation including vulnerability reports and fixes.

### Setup (`docs/setup/`)
Configuration and setup guides for external dependencies and system requirements.

## 🔄 Documentation Updates

When adding new documentation:

1. Place it in the appropriate `docs/` subdirectory
2. Update [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)
3. Follow the naming convention: `UPPERCASE_WITH_UNDERSCORES.md`
4. Add cross-references to related documents

## 📞 Need Help?

- **Can't find what you're looking for?** Check the [Complete Documentation Index](docs/DOCUMENTATION_INDEX.md)
- **Found outdated documentation?** Please submit an issue or PR
- **Want to contribute documentation?** Follow the guidelines in [AGENTS.md](AGENTS.md)

---

**Last Updated**: 2024-11-28
