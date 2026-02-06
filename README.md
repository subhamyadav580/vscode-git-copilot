# Git Copilot

**AI copilot for Git workflows in VS Code.**

Git Copilot is a VS Code extension that automates common Git operations using an intelligent agent.  
It detects the current repository, guides you through staging files, generates commit messages using AI, and pushes changes — all with real-time progress updates inside VS Code.

---

## ✨ Features

- 🔍 Automatic Git repository detection
- 📁 Detects current working directory or workspace
- 🗂 Lists unstaged files
- ✅ Interactive file staging
  - Select all files
  - Manually select files
  - Cancel safely
- ✍️ AI-generated commit messages
- 🚀 Commit and push workflow
- 📡 Live progress streaming inside VS Code
- 🔐 Safe-by-default Git operations

---

## 🧠 How It Works

Git Copilot consists of two layers:

### 1️⃣ VS Code Extension (TypeScript)
- Detects repository context
- Displays progress banners
- Collects user input (file selection, confirmations)
- Streams agent updates in real time

### 2️⃣ Python Agent (LangGraph)
- Executes Git workflow as a state graph
- Streams structured status events back to VS Code
- Uses AI to generate commit messages

---

## 🚀 Installation & Setup

### Prerequisites

- **VS Code** ≥ 1.108
- **Git** installed and available in PATH
- **Python** 3.10+
- **Node.js** 18+ (for development)
- **OpenAI API Key** (for AI-generated commit messages)

---

### Option 1: Install from VSIX (Recommended for Users)

1. **Download** the latest `.vsix` file from releases
2. **Install** the extension:
```bash
   code --install-extension git-copilot-0.0.1.vsix
```
   Or via VS Code:
   - Open Command Palette (`Cmd/Ctrl + Shift + P`)
   - Type: `Extensions: Install from VSIX...`
   - Select the downloaded `.vsix` file

3. **Reload VS Code**
   - `Cmd/Ctrl + Shift + P` → `Developer: Reload Window`

4. **Configure OpenAI API Key**
   - Run `Git Copilot: Run Agent` command
   - Enter your OpenAI API key when prompted
   - The key is stored securely in VS Code's secret storage

---

### Option 2: Local Development Setup

#### 1️⃣ Clone the Repository
```bash
git clone https://github.com/yourusername/git-copilot.git
cd git-copilot
```

#### 2️⃣ Install Dependencies

**TypeScript/Node.js:**
```bash
npm install
```

**Python:**
```bash
cd python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

#### 3️⃣ Set Up OpenAI API Key

The extension will prompt you for your API key on first run and store it securely.

Alternatively, for development/testing, create a `.env` file:
```bash
# python/.env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

> **Note:** The `.env` file is only for local development. When installed as an extension, the API key is stored in VS Code's secure storage.

#### 4️⃣ Compile TypeScript
```bash
npm run compile
```

Or watch mode for development:
```bash
npm run watch
```

#### 5️⃣ Run the Extension

Press **F5** in VS Code to:
- Compile the code
- Launch Extension Development Host
- Test the extension in a new VS Code window

---

## 🔧 Building & Packaging

### Package the Extension
```bash
npm install -g @vscode/vsce
vsce package
```

This creates `git-copilot-0.0.1.vsix` that you can:
- Install locally: `code --install-extension git-copilot-0.0.1.vsix`
- Share with others
- Publish to VS Code Marketplace

### Publishing to Marketplace
```bash
vsce publish
```

---

## ▶️ Usage

1. **Open any Git repository** in VS Code
2. **Open Command Palette**  
   - macOS: `Cmd + Shift + P`  
   - Windows/Linux: `Ctrl + Shift + P`
3. **Run:** `Git Copilot: Run Agent`
4. **Follow the prompts:**
   - Select files to stage
   - Review AI-generated commit message
   - Confirm push to remote

---

## 📁 Project Structure
```
git-copilot/
├── src/
│   └── extension.ts          # VS Code extension entry point
├── python/
│   ├── main.py               # Python agent entry point
│   ├── requirements.txt      # Python dependencies
│   ├── venv/                 # Python virtual environment (created on setup)
│   └── core/
│       ├── agent_schemas.py  # Data schemas
│       ├── git_utils.py      # Git operations
│       ├── pagent.py         # Agent orchestration
│       └── review_agent.py   # Commit message generation
├── out/                      # Compiled TypeScript output
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── .vscodeignore             # Files excluded from packaging
```

---

## 🔐 Security

- **API Keys:** Stored securely using VS Code's Secret Storage API
- **Git Operations:** Read-only by default; writes only with explicit user confirmation
- **Network:** Only communicates with OpenAI API for commit message generation

---

## 🐛 Troubleshooting

### Extension Not Working

1. **Check Output Panel:**
   - `View` → `Output`
   - Select `Extension Host` from dropdown
   - Look for `[git-copilot]` logs

2. **Verify Python Setup:**
```bash
   cd python
   source venv/bin/activate
   python --version  # Should be 3.10+
   pip list          # Check installed packages
```

3. **Verify Git Repository:**
```bash
   git status  # Should show repository status
```

### Python Process Fails

- Ensure Python virtual environment exists: `python/venv/`
- Reinstall dependencies:
```bash
  cd python
  source venv/bin/activate
  pip install -r requirements.txt --force-reinstall
```

### API Key Issues

- Delete and re-enter your API key:
  - Run command again and enter key when prompted
  - Or clear VS Code secrets and restart

---

## 📝 Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Watch Mode
```bash
npm run watch
```

### Debug Extension

1. Open project in VS Code
2. Press **F5** to launch Extension Development Host
3. Set breakpoints in `src/extension.ts`
4. Run `Git Copilot: Run Agent` in the debug window

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE.txt](LICENSE.txt) for details

---

## 🙏 Acknowledgments

- Built with [LangGraph](https://github.com/langchain-ai/langgraph)
- Powered by [OpenAI](https://openai.com/)
- VS Code Extension API

---

## 📧 Support

Found a bug or have a feature request?  
[Open an issue](https://github.com/subhamyadav580/vscode-git-copilot/issues)