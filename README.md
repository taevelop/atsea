# At Sea 2.0.0

ASCII 문자 바다와 3D 바다를 하나의 버튼으로 오가는 열대 바다입니다. 두 화면이 같은 게임 상태를 사용하므로 생물 위치, 수심, 진행 중인 낚시와 업적·칭호·수집 기록이 이어집니다.

## 2.0.0 주요 변경

- **단일 화면 전환 버튼:** 타이틀 오른쪽 버튼에 전환할 모드를 표시합니다. WATER·언어 버튼과 같은 스타일이며, 배경화면 모드에서도 화면을 건드리면 나타납니다.
- **전체 상태 공유:** 낚싯줄·잠수함·특별 먹이·일시정지·설정과 도감·희귀종·칭호·트로피를 두 모드에서 함께 사용합니다.
- **모드별 그림과 제목:** 2D는 원본 ASCII 도안과 실루엣, 3D는 모델 이미지를 사용합니다. 타이틀과 브라우저 탭 제목, 도감·포획 알림도 함께 바뀝니다.
- **3D 준비 중에도 플레이:** 준비 중에는 2D로 플레이할 수 있으며, 다시 누르면 전환을 취소합니다. 3D 오류가 나면 같은 상태로 2D를 유지하고 재시도를 제공합니다.
- **오프라인 단일 HTML:** 모델과 코드를 내장한 HTML 한 파일을 인터넷이나 웹서버 없이 실행할 수 있습니다.

| 현재 모드 | 화면 타이틀 | 전환 버튼 |
|---|---|---|
| 2D | ASCII Tropical Sea | `3D` |
| 3D | Animated Tropical Sea | `2D` |

첫 선택은 3D이며, 이후에는 마지막으로 성공한 사용자 선택을 기억합니다. 기존 `atsea.*` 저장 기록과 식별자는 유지하며 표시 모드만 `atsea.view`에 추가합니다. 새로고침 후에는 기존 저장 항목과 표시 모드를 복원합니다.

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

`npm run build`의 `dist/`가 정적 호스팅 결과물입니다. 원본 Blender 파일, 제작 도구, 테스트 코드는 배포물에 들어가지 않습니다.

## Cloudflare 배포

Cloudflare Workers의 Git 연동 빌드에서는 다음 값을 사용합니다. 프로젝트 루트의 `wrangler.jsonc`가 `dist/` 전체를 정적 파일로 배포하도록 지정합니다.

| 설정 | 값 |
|---|---|
| Worker 이름 | `atsea3d` |
| 빌드 명령 | `npm run build` |
| 배포 명령 | `npx wrangler deploy` |
| 루트 디렉터리 | 저장소 루트 |

`wrangler.jsonc`를 연결된 Git 브랜치에 함께 올려야 Cloudflare 빌드에도 적용됩니다. 이 설정 파일이 있으면 Wrangler가 Vite 플러그인을 자동으로 설치하거나 `vite.config.js`를 수정하는 설정 단계를 건너뜁니다. 앱에는 별도 Worker 서버 코드나 Cloudflare Vite 플러그인이 필요하지 않습니다.

실제 업로드 없이 배포 설정을 확인하려면 다음 명령을 실행합니다.

```powershell
npm run build
npx wrangler deploy --dry-run
```

Cloudflare Pages를 사용하는 경우에는 Pages 프로젝트의 빌드 명령을 `npm run build`, 빌드 출력 디렉터리를 `dist`로 지정합니다. Pages의 Git 연동 배포에는 별도 `npx wrangler deploy` 명령을 입력하지 않습니다. Direct Upload에서는 로컬 빌드 후 `dist/` 폴더 전체를 올리며, ZIP으로 올릴 때는 최상위에 `index.html`이 위치하도록 압축합니다.

참고: [Workers 정적 파일 설정](https://developers.cloudflare.com/workers/static-assets/binding/), [Wrangler 자동 설정 건너뛰기](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/#skipping-automatic-configuration), [Pages 빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## 웹서버 없이 실행하는 단일 HTML

```powershell
npm run build:single
```

생성된 **`dist-single/atsea3d.html` 한 파일만 전달**하면 됩니다. 받는 사람은 압축 해제나 Node.js 설치, 웹서버 실행 없이 HTML을 최신 Edge 또는 Chrome에서 열 수 있습니다. 인터넷 연결도 필요하지 않습니다. Node.js와 npm은 이 파일을 만드는 개발 환경에서만 필요합니다.

단일 파일 빌드는 JavaScript·Three.js·CSS·아이콘을 HTML에 넣고, GLB 모델 21개는 gzip으로 무손실 압축한 뒤 Base64로 내장합니다. 브라우저의 `DecompressionStream`으로 모델을 복원해 `GLTFLoader.parseAsync`에 전달합니다. Google Fonts 요청과 설치용 웹앱 매니페스트는 제외하며, 기존 시스템 글꼴 대체 설정을 사용합니다. 일반 웹 배포는 `npm run build`의 `dist/`를 사용합니다.

현재 단일 HTML은 **1,981,806바이트(1.89MiB)**이며, 일반 배포 폴더 약 2.89MiB보다 **약 35% 작습니다**. 크기는 ZIP 전의 파일 크기 기준이며, 코드·모델 변경 후 빌드할 때마다 콘솔에 다시 표시됩니다.

수집 기록과 언어·슬라이더 설정은 브라우저 저장소를 사용합니다. `file://` 저장소는 브라우저와 파일 경로에 따라 달라질 수 있어, 파일을 이동하거나 이름을 바꾸면 이전 기록이 보이지 않을 수 있습니다. 기존 웹사이트의 기록도 자동으로 옮겨지지 않습니다. 저장소를 사용할 수 없는 환경에서도 화면과 조작은 실행되지만 기록은 유지되지 않습니다.

```powershell
npm run test:single
```

단일 HTML 빌드와 검증은 웹 E2E를 마치고 개발 서버를 종료한 뒤 실행합니다. 개발 서버가 생성된 HTML을 변경 파일로 감지해 테스트 중인 페이지를 새로고침하는 일을 피할 수 있습니다.

이 명령은 HTML을 빌드한 다음 한글·공백이 있는 별도 폴더에 파일 하나만 복사하고, 네트워크를 차단한 Edge에서 데스크톱·모바일 화면을 검증합니다. 웹서버는 시작하지 않습니다. 모델 로딩, 2D·3D 전환, 수면·해저 렌더링, 도감, 도구, 설정·기록·표시 모드의 새로고침 유지, 저장소 사용 불가 및 WebGL 없는 2D 시작을 확인합니다.

## 사용법

| 조작 | 동작 |
|---|---|
| 상단 타이틀 우측 2D 또는 3D 버튼 | 버튼에 표시된 모드로 전환; 하나의 버튼으로 번갈아 전환하며 제목도 변경 |
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

- `atsea2d/`: 수정하지 않은 로컬 비교용 v4.5.0 원본. 기존 `.gitignore` 설정에 따라 Git 저장소에는 포함하지 않습니다. 앱 실행과 빌드에는 필요하지 않습니다.
- `src/game/`: 생물·낚시·포식·진행 조건·저장 데이터. 문자 도안 대신 논리 크기를 사용합니다.
- `src/main.js`, `src/ui/`, `src/styles.css`: 기존 화면 배치, 입력, 도감, 한국어/영어.
- `src/render/`: 원본 ASCII 도안·그리기, 3D 모델·미리보기·환경과 두 렌더러의 수명 관리. 게임 루프와 입력은 공용이며 비활성 화면은 그리기를 멈춥니다.
- `public/models/`: 웹용 GLB와 모델별 메타데이터.
- `assets/source/`, `scripts/assets/`: 받은 원본, 편집 가능한 Blender 파일과 재생성 스크립트.

기존 `atsea.lang`, `atsea.sliders`, `atsea.controls`, `atsea.guide`, `atsea.rare`, `atsea.stats`, `atsea.seen`, `atsea.titles` 키와 `fish0`~`fish6` 등의 식별자를 유지합니다. 같은 출처(프로토콜·도메인·포트)로 배포한 경우 기존 기록을 읽습니다. 다른 도메인이나 로컬 개발 주소는 브라우저 저장소가 분리됩니다.

처음에는 3D를 선택하고, 이후에는 마지막으로 성공한 사용자 선택을 `atsea.view`(`2d` / `3d`)로 기억합니다. 3D 준비 중에도 ASCII 2D로 플레이할 수 있습니다. 모델 로딩 실패나 WebGL 컨텍스트 손실 시 같은 게임 상태로 2D를 계속 표시하며 3D를 다시 시도할 수 있습니다. 2D로 저장된 경우에는 모델 다운로드나 WebGL 초기화 없이 시작합니다.

2D에서는 바다·도감·포획 알림 모두 원본 ASCII 도안으로, 3D에서는 기존 모델로 표현합니다. 모드 전환은 바다를 다시 채우거나 도감을 재집계하지 않습니다. 새로고침은 기존처럼 저장된 수집 기록·설정과 표시 모드를 복원하며, 생물 위치나 낚시 세션 전체를 저장하지는 않습니다. `prefers-reduced-motion`이 설정된 환경은 정지 상태로 시작합니다.

## 라이선스 및 외부 자료

앱에서 사용하는 외부 라이브러리·글꼴과 가져온 원본 모델의 라이선스입니다. 각 항목의 라이선스 원문과 제작자 페이지를 함께 표기합니다.

### 앱 실행과 콘텐츠

| 구성 요소 | 제작자 | 용도 | 라이선스 / 출처 |
|---|---|---|---|
| Three.js | three.js authors | 3D 렌더링·GLTF 로딩·모델 애니메이션 | [MIT](https://github.com/mrdoob/three.js/blob/r183/LICENSE) |
| Animated Fish Pack | Quaternius | 물고기·가오리·상어 등의 원본 및 변형 모델 | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) · [공식 팩](https://quaternius.com/packs/animatedfish.html) |
| Animated Cute Fish Pack | Quaternius | 탱·복어·아귀 등의 원본 및 변형 모델 | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) · [공식 팩](https://quaternius.com/packs/cutefish.html) |
| IBM Plex Mono / IBM Plex Sans Condensed | IBM | 웹 UI와 ASCII 글꼴 | [SIL Open Font License 1.1](https://github.com/IBM/plex/blob/master/LICENSE.txt) |

원본 모델 고지문은 [Animated Fish의 License.txt](<assets/source/quaternius-animated-fish/Animated Fish Pack by @Quaternius/License.txt>)와 [Cute Fish의 LICENSE.txt](assets/source/quaternius-cute-fish/LICENSE.txt)에 보관합니다. Cute Fish는 제작자의 [Poly Pizza 배포 묶음](https://poly.pizza/bundle/Animated-Fish-Bundle-44zhHN1UbT)에서 받았으며, [개별 모델 출처](assets/source/quaternius-cute-fish/sources.json)와 [변형·제작 내역](docs/assets.md)을 함께 기록했습니다.

IBM Plex는 웹에서 Google Fonts로 불러옵니다. 오프라인 단일 HTML은 글꼴 파일을 내장하지 않고 시스템 글꼴을 사용합니다.

### 개발·테스트·모델 제작 도구

아래 npm 항목은 `package.json`의 직접 개발 의존성입니다. 구체적인 설치 버전은 `package-lock.json`에 기록됩니다.

| 도구 | 용도 | 라이선스 원문 |
|---|---|---|
| Vite | 개발 서버와 웹·단일 HTML 빌드 | [MIT](https://github.com/vitejs/vite/blob/main/LICENSE) |
| Vitest | 단위 테스트 | [MIT](https://github.com/vitest-dev/vitest/blob/main/LICENSE) |
| ESLint / @eslint/js | 코드 정적 검사 | [MIT](https://github.com/eslint/eslint/blob/main/LICENSE) |
| globals | 정적 검사 환경의 전역 이름 정의 | [MIT](https://github.com/sindresorhus/globals/blob/main/license) |
| @playwright/test / Playwright | 데스크톱·모바일·오프라인 브라우저 검사 | [Apache License 2.0](https://github.com/microsoft/playwright/blob/main/LICENSE) |
| pngjs | 브라우저 캡처의 PNG 픽셀 검사 | [MIT](https://github.com/pngjs/pngjs/blob/main/LICENSE) |
| Blender | 모델 제작·변형·GLB 내보내기 | [GNU GPL — 배포본은 GPL-3.0-or-later](https://www.blender.org/about/license/) |

Blender는 제작 도구로 사용합니다. 앱 자체 코드와 직접 제작한 보완 모델에는 아직 별도의 프로젝트 라이선스가 선언되어 있지 않으며, 로컬 ASCII 원본 파일에도 라이선스 문구가 없습니다.

## 자료

- [모델 출처·라이선스·Blender 재생성](docs/assets.md)
- [기존 기능 대응표](docs/feature-parity.md)
- [검증 결과와 성능 측정 조건](docs/verification.md)

모델별 공개 라이선스는 출처 문서와 원본 폴더에 기록했습니다. 공개 팩에서 변형한 어종은 스타일드 게임 표현입니다.
