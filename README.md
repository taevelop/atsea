# At Sea 3D

기존 At Sea v4.5.0의 화면과 게임 규칙을 유지하는 3D 열대 바다입니다. Three.js 직교 카메라가 위아래로만 이동하며, 공개 CC0 모델과 Blender로 만든 보완 모델을 사용합니다.

## 실행

Node.js 22.12 이상 또는 24 LTS와 npm이 필요합니다. 이 작업은 Node.js 24.16.0에서 검증했습니다.

```powershell
npm ci
npm run dev
```

브라우저에서 터미널에 표시되는 `http://127.0.0.1:5173/`을 엽니다. 앱 실행에는 Blender가 필요하지 않습니다. GLB는 프로젝트 안에 포함되어 있으며, 모델 서버에 별도로 접속하지 않습니다. UI 글꼴은 Google Fonts를 사용하며 로딩되지 않으면 시스템 글꼴로 표시합니다.

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
npm run preview
```

브라우저 테스트는 로컬 Vite 서버가 실행된 상태에서 수행합니다. 기본 설정은 설치된 Microsoft Edge를 사용하며 데스크톱과 모바일 화면 크기를 검증합니다. 테스트 결과의 모바일 화면은 실제 휴대전화 성능 측정과 구분합니다.

`npm run build`의 `dist/`가 정적 호스팅 결과물입니다. 원본 Blender 파일, 제작 도구, 테스트 코드는 배포물에 들어가지 않습니다. 이번 작업에서는 운영 사이트를 배포하거나 변경하지 않았습니다.

## 사용법

| 조작 | 동작 |
|---|---|
| 휠, ↑/↓, W/S, J/K | 위아래로 잠수 |
| PageUp / PageDown | 반 화면 이동 |
| Home / End, Surface / Seabed | 수면 / 해저 이동 |
| 수심계 드래그 | 원하는 깊이로 이동 |
| 두 손가락 상하 이동 | 모바일 잠수 |
| 물속 클릭 / 한 손가락 탭 | 가까운 생물 흩어뜨리기 |
| R, 낚싯대 버튼 | 낚싯줄 드리우기 / 챔질 / 건져 올리기 |
| 낚싯대가 나와 있을 때 포인터 이동 | 미끼 위치 조절 |
| B / D | 잠수함 / 도감 |
| Space / N / T | 일시정지 / 다시 채우기 / 물빛 |
| C / F / Esc | 조작부 접기 / 배경화면 / 닫기 |

일시정지 중에도 수심은 옮길 수 있습니다. 도감·희귀종·칭호·트로피와 조건을 달성한 뒤의 특별 먹이·메갈로돈을 그대로 지원합니다. Fish 슬라이더는 일반 물고기를 기준으로 다른 수영 생물도 원래 비율에 맞춰 조절합니다. 상어와 바닥 장식은 별도 슬라이더를 사용합니다.

## 구조와 저장 호환

- `atsea2d/`: 수정하지 않은 로컬 비교용 v4.5.0 원본. 기존 `.gitignore` 설정에 따라 Git 저장소에는 포함하지 않습니다. 3D 앱 실행과 빌드에는 필요하지 않습니다.
- `src/game/`: 생물·낚시·포식·진행 조건·저장 데이터. 문자 도안 대신 논리 크기를 사용합니다.
- `src/main.js`, `src/ui/`, `src/styles.css`: 기존 화면 배치, 입력, 도감, 한국어/영어.
- `src/render/`: 모델 로딩·미리보기, 수심별 3D 환경, 애니메이션과 시각 효과.
- `public/models/`: 웹용 GLB와 모델별 메타데이터.
- `assets/source/`, `scripts/assets/`: 받은 원본, 편집 가능한 Blender 파일과 재생성 스크립트.

기존 `atsea.lang`, `atsea.sliders`, `atsea.controls`, `atsea.guide`, `atsea.rare`, `atsea.stats`, `atsea.seen`, `atsea.titles` 키와 `fish0`~`fish6` 등의 식별자를 유지합니다. 같은 출처(프로토콜·도메인·포트)로 배포한 경우 기존 기록을 읽습니다. 다른 도메인이나 로컬 개발 주소는 브라우저 저장소가 분리됩니다.

3D 로딩 실패 시 재시도할 수 있으며, WebGL 컨텍스트 복구 후에도 저장한 수집 기록을 읽습니다. `prefers-reduced-motion`이 설정된 환경은 정지 상태로 시작합니다.

## 자료

- [모델 출처·라이선스·Blender 재생성](docs/assets.md)
- [기존 기능 대응표](docs/feature-parity.md)
- [검증 결과와 성능 측정 조건](docs/verification.md)

모델별 공개 라이선스는 출처 문서와 원본 폴더에 기록했습니다. 공개 팩에서 변형한 어종은 스타일드 게임 표현입니다.
