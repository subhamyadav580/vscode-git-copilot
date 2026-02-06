# Git Copilot

**Your AI copilot for Git workflows in VS Code.**

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

## ▶️ Usage

1. Open **any Git repository** in VS Code
2. Open Command Palette  
   **`Cmd + Shift + P`** (macOS) / **`Ctrl + Shift + P`** (Windows/Linux)
3. Run: Git Copilot: Run Agent
4. Follow the prompts to stage files, generate a commit message, and push changes.

---

## 🛠 Requirements

### System Requirements
- VS Code **≥ 1.108**
- Git installed and available in PATH
- Python **3.10+**

---

## 🔑 Environment Variables (.env)

Git Copilot uses an AI model to generate commit messages.  
You must provide an **OpenAI API key** via a `.env` file.

### 📄 Create `.env` file

Inside the extension’s Python directory: `git-copilot/python/.env`

Add the following:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## 🐍 Python Setup.

```cmd
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
