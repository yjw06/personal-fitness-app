#!/bin/bash
# 지인에게 공유하기 전에 실행 — 웹을 다시 빌드해서 iOS에 동기화하고,
# 친구가 Node 없이 Xcode만으로 빌드할 수 있도록 결과물을 git에 담아둔다.
# (맥에서 이 파일을 더블클릭하면 실행됩니다.)

cd "$(dirname "$0")" || exit 1

echo "════════════════════════════════════════"
echo "  WORK OUT! 공유용 빌드 갱신"
echo "════════════════════════════════════════"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Node/npm 이 없습니다. https://nodejs.org 에서 LTS 설치 후 다시 실행하세요."
  read -r -p "엔터를 누르면 닫힙니다…" _
  exit 1
fi

echo "▶ 1/3 의존성 확인 (npm install)…"
npm install || { echo "❌ npm install 실패"; read -r -p "엔터…" _; exit 1; }

echo "▶ 2/3 웹 빌드 + iOS 동기화 (npm run ios:build)…"
npm run ios:build || { echo "❌ 빌드 실패"; read -r -p "엔터…" _; exit 1; }

echo "▶ 3/3 빌드 결과물 git 에 담기…"
git add ios/App/App/public ios/App/App/capacitor.config.json

echo ""
echo "✅ 완료! 이제 변경사항을 커밋·푸시하면 친구들이 최신 버전을 받습니다:"
echo "     git commit -m \"chore: 공유용 iOS 빌드 갱신\""
echo "     git push"
echo ""
read -r -p "엔터를 누르면 닫힙니다…" _
