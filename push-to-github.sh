#!/bin/bash
# push-to-github.sh - upload Plan Manager to GitHub.
# Run this from the PROJECT ROOT (the folder containing Flow.html), not mac-app/.
set -e

REPO_URL="https://github.com/YJ901102/Plan-Manager.git"
BRANCH="main"

echo ""
echo "=================================================="
echo "      Plan Manager - push to GitHub"
echo "=================================================="
echo ""

if [ ! -f "Flow.html" ]; then
  echo "  x  Run this from the project root (the folder with Flow.html in it)."
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "  x  git isn't installed. Install Xcode Command Line Tools:"
  echo "     xcode-select --install"
  exit 1
fi

# ---- Init repo if needed --------------------------------------------------
if [ ! -d ".git" ]; then
  git init -q
  # Older git defaults to 'master'. 'git branch -M' can't rename a branch that
  # has no commits yet, so point HEAD at the right branch directly instead.
  git symbolic-ref HEAD "refs/heads/$BRANCH"
  echo "  ok  Initialised a git repository on '$BRANCH'"
fi

# ---- Point at the GitHub repo ---------------------------------------------
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi
echo "  ok  Remote: $REPO_URL"

# ---- Commit everything ----------------------------------------------------
git add -A
if git diff --cached --quiet; then
  echo "  --  Nothing new to commit"
else
  read -p "  Commit message [Update Plan Manager]: " MSG
  MSG=${MSG:-Update Plan Manager}
  git commit -q -m "$MSG"
  echo "  ok  Committed"
fi

# ---- Make sure we're actually ON $BRANCH ----------------------------------
# (A repo initialised by an older git, or by hand, may be on 'master'.)
CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$BRANCH" ] && [ "$CURRENT" != "HEAD" ]; then
  git branch -M "$BRANCH"
  echo "  ok  Renamed branch '$CURRENT' -> '$BRANCH'"
fi

# ---- Merge whatever is already up there -----------------------------------
git fetch -q origin "$BRANCH" 2>/dev/null || true
if git rev-parse --verify -q "origin/$BRANCH" >/dev/null; then
  echo "  ..  Merging existing remote history"
  git pull --rebase --allow-unrelated-histories -q origin "$BRANCH" || {
    echo ""
    echo "  !  The rebase hit a conflict (most likely README.md)."
    echo "     Fix the marked file, then:  git add . && git rebase --continue"
    echo "     Then re-run this script."
    exit 1
  }
fi

# ---- Push -----------------------------------------------------------------
echo "  ..  Pushing to $BRANCH"
git push -u origin "$BRANCH"

echo ""
echo "  ok  Done. https://github.com/YJ901102/Plan-Manager"
echo ""
echo "  From now on, the installed Plan Manager.app checks this repo on"
echo "  launch and offers to update itself."
echo ""
