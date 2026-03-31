#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# split-repos.sh
# Splits ashley643/Projects branches into individual repos,
# preserving full commit history on each.
#
# Prerequisites:
#   - git installed locally
#   - GitHub Personal Access Token with 'repo' scope
#     (Settings → Developer settings → Personal access tokens)
#
# Usage:
#   export GITHUB_TOKEN=ghp_yourtoken
#   bash split-repos.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

: "${GITHUB_TOKEN:?Please set GITHUB_TOKEN before running. Example: export GITHUB_TOKEN=ghp_yourtoken}"

GITHUB_USER="ashley643"
SOURCE_REPO="Projects"

declare -A BRANCHES=(
  ["assessment-sampler"]="assessment-sampler"
  ["report-builder"]="claude/report-builder-app-FLPqS"
  ["assessment-player"]="claude/assessment-player-videoask-G6SRq"
  ["impacter-assessment-demo"]="claude/impacter-assessment-demo-EDEHQ"
  ["csv-ingest"]="claude/scaffold-csv-ingest-nj5Zg"
)

declare -A DESCRIPTIONS=(
  ["assessment-sampler"]="Impacter Pathway sample assessment demo — VideoAsk experience (Next.js 16, TypeScript, Tailwind v4)"
  ["report-builder"]="Impacter Pathway Report Builder — AI-powered data-to-slides generator (Next.js 16, Claude API)"
  ["assessment-player"]="Impacter Pathway assessment player with VideoAsk activity slots"
  ["impacter-assessment-demo"]="Impacter Pathway 3-screen assessment demo platform with SEL competency tracking"
  ["csv-ingest"]="Impacter Pathway Python data pipeline — CSV ingest, analysis, and reporting scaffold"
)

WORKDIR=$(mktemp -d)
trap "rm -rf '$WORKDIR'" EXIT
echo "Working in $WORKDIR"

# 1. Clone the source repo (bare clone = all branches, no checkout needed)
echo "Cloning source repo..."
git clone --bare \
  "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${SOURCE_REPO}.git" \
  "$WORKDIR/source.git"

for NEW_REPO in "${!BRANCHES[@]}"; do
  SOURCE_BRANCH="${BRANCHES[$NEW_REPO]}"
  DESC="${DESCRIPTIONS[$NEW_REPO]}"

  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  $NEW_REPO  ←  $SOURCE_BRANCH"
  echo "══════════════════════════════════════════════════════"

  # 2. Create the new empty GitHub repo (no auto-init — we supply the history)
  echo "  Creating github.com/${GITHUB_USER}/${NEW_REPO}..."
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.github.com/user/repos" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "{\"name\":\"${NEW_REPO}\",\"description\":\"${DESC}\",\"private\":false,\"auto_init\":false}")

  if [ "$HTTP" = "201" ]; then
    echo "  ✓ Repo created"
  elif [ "$HTTP" = "422" ]; then
    echo "  ⚠  Repo already exists — pushing to it anyway"
  else
    echo "  ✗  Unexpected HTTP $HTTP — skipping $NEW_REPO"
    continue
  fi

  # Small delay to let GitHub provision the repo
  sleep 2

  # 3. Push that branch's full history as 'main' in the new repo
  echo "  Pushing commit history..."
  (
    cd "$WORKDIR/source.git"
    git push --force \
      "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${NEW_REPO}.git" \
      "refs/remotes/origin/${SOURCE_BRANCH}:refs/heads/main"
  )
  echo "  ✓ https://github.com/${GITHUB_USER}/${NEW_REPO}"
done

echo ""
echo "═══════════════════════════════════"
echo "  All repos created successfully:"
echo "═══════════════════════════════════"
for R in "${!BRANCHES[@]}"; do
  echo "  https://github.com/${GITHUB_USER}/${R}"
done
