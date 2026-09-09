# At Sea 3D 모델과 출처

웹은 `public/models/`의 로컬 GLB만 읽습니다. 외부 모델 서버에 런타임으로 의존하지 않습니다. 모든 생물·잠수함·배경 소품은 편집 가능한 Blender 장면을 `assets/source/atsea-adapted/`에 함께 보관합니다.

## 다운로드한 원본

| 자료 | 제작자 / 라이선스 | 보관 위치 |
|---|---|---|
| [Animated Fish Pack](https://quaternius.com/packs/animatedfish.html) | Quaternius / [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `assets/source/quaternius-animated-fish.zip`, 같은 이름의 압축 해제 폴더 |
| [Animated Cute Fish Pack](https://quaternius.com/packs/cutefish.html) | Quaternius / CC0 1.0 | `assets/source/quaternius-cute-fish/*.glb` |

Animated Fish의 ZIP은 [제작자 본인이 등록한 OpenGameArt 배포 페이지](https://opengameart.org/content/animated-fish)에서 받았습니다. ZIP에는 수정하지 않은 `.blend`, FBX, OBJ 및 제작자의 `License.txt`가 포함되어 있습니다.

Cute Fish 공식 페이지가 연결하는 Google Drive는 2026-09-08 다운로드 시 `Quota exceeded`를 반환했습니다. 대신 [Quaternius의 Poly Pizza 배포 묶음](https://poly.pizza/bundle/Animated-Fish-Bundle-44zhHN1UbT)에서 CC0로 표시된 원본 GLB 8개를 받았습니다. 각 모델의 개별 페이지, 직접 다운로드 URL과 파일명은 `assets/source/quaternius-cute-fish/sources.json`에 기록했습니다. Cute Fish의 제작자 원본 `.blend`를 받았다고 표시하지 않습니다. 이 모델들의 `atsea-adapted/*.blend`는 받은 GLB를 Blender로 불러와 수정하고 저장한 편집본입니다.

보완 모델은 이 프로젝트를 위해 Blender Python으로 새로 제작했으며 타인의 모델·텍스처를 포함하지 않습니다. Blender는 제작 도구이며 Blender 프로그램의 GPL은 이 프로젝트 모델의 라이선스를 의미하지 않습니다.

## 게임 식별자와 모델 연결

| 키 | 표현 / 원본 | 변경 |
|---|---|---|
| `fish0` | 네온 고비 / Cute Fish Tetra | 가늘고 긴 체형, 청록색 발색 |
| `fish1` | 블루 담셀 / Animated Fish Fish1 | 파랑 몸체와 따뜻한 꼬리, 눈 보완 |
| `fish2` | 리갈 탱 / Cute Fish Blue Tang | 파랑·노랑 무늬, 작은 눈 |
| `fish3` | 엠퍼러 엔젤피시 / Cute Fish Butterfly Fish | 엔젤피시형 측면 윤곽, 금색·남색 배색 |
| `fish4` | 복어 / Cute Fish Puffer | 가시·둥근 체형, 작은 눈 |
| `fish5` | 바라쿠다 / Animated Fish Fish1 | 길쭉한 은빛 몸체와 낮은 지느러미 |
| `fish6` | 흰동가리 / Animated Fish Fish3 | 주황색·아이보리 줄무늬, 눈 보완 |
| `ray` | 가오리 / Animated Fish Manta ray | 청회색 등과 밝은 배 |
| `shark` | 상어 / Animated Fish Shark | 청회색 등, 눈 보완 |
| `megalodon` | 메갈로돈 / Animated Fish Shark | 넓은 몸통, 어두운 배색; 게임에서 크게 표시 |
| `angler` | 아귀 / Cute Fish Anglerfish | 작은 눈, 발광 미끼 |
| `dolphin` | 돌고래 / Animated Fish Dolphin | 원본 뼈대 수영 유지, 상어와 비슷한 크기 |
| `whale` | 고래 / Animated Fish Whale | 원본 뼈대 수영 유지, 상어보다 약 20% 크게 표시 |
| `turtle` | 바다거북 / 새 Blender 모델 | 등딱지, 앞뒤 네 지느러미의 독립 운동 |
| `crab` | 헤엄치는 게 / 새 Blender 모델 | 집게 2개, 다리 8개와 뒤쪽 노 모양 다리 운동 |
| `shrimp` | 새우 / 새 Blender 모델 | 굽은 분절 몸통, 수염, 수영다리와 꼬리 운동; 3D 길이는 두 번째 작은 물고기와 같은 5칸 |
| `oarfish` | 심해 산갈치 / 새 Blender 모델 | 세로 자세, 붉은 등지느러미와 파동 운동; 납작한 물고기형 머리와 턱·입선·아가미 |
| `lantern` | 랜턴피시 / Animated Fish Fish1 | 가늘고 어두운 몸체, 양옆 발광점 |
| `jelly` | 해파리 / 새 Blender 모델 | 우산형 갓, 구강완과 긴 촉수 |
| `seahorse` | 해마 / 새 Blender 모델 | 말린 꼬리, 주둥이, 골질 융기 |
| `squid` | 오징어 / 새 Blender 모델 | 긴 외투막, 팔 8개와 긴 촉수 2개 |
| `octopus` | 문어 / 새 Blender 모델 | 외투막, 팔 8개, 흡반 |
| `sub` | 잠수함 / 새 Blender 모델 | 금색 선체, 현창, 잠망경, 프로펠러 |
| `coral` | 산호 / 새 Blender 모델 | 부드러운 가지형 산호 |
| `starfish` | 불가사리 / 새 Blender 모델 | 팔 5개와 표면 알갱이 |
| `seaweed` | 해초 / 새 Blender 모델 | 가지와 얇은 잎이 있는 해초 군락 |
| `rock` | 바위 / 새 Blender 모델 | 비대칭 해저 바위 |

어종은 게임의 기존 구분을 유지하는 스타일드 표현입니다. Tetra·Butterfly Fish·Fish1을 바탕으로 변형한 모델은 해당 생물의 과학적 복원 모델이 아닙니다.

## 제작과 재생 계약

- GLB는 **+X 진행 방향, +Y 위쪽**입니다. 게는 카메라를 바라보며 옆으로 이동하고, 산갈치는 머리가 +Y인 세로 자세를 유지합니다. 별도의 카메라·광원을 포함하지 않습니다. 게임 렌더러가 전체 경계 상자로 중심·크기를 맞춥니다.
- 가오리와 불가사리는 실제처럼 넓고 평평한 모델입니다. 측면 화면에서는 가오리를 X축 약 0.4rad, 불가사리를 약 1.0rad 기울이면 윤곽을 읽기 쉽습니다.
- 움직이는 모델은 `Swim`이라는 단일 클립을 제공합니다. Quaternius 모델은 원래 뼈대 수영 모션을 유지합니다. 새 거북·게·새우는 뼈대 애니메이션, 산갈치와 기존 보완 생물·해초는 반복되는 모프 애니메이션을 사용합니다. 잠수함·산호·불가사리·바위는 정적 모델입니다.
- 수영에 필요하지 않은 공격·사망·물 밖 동작과 원본의 보조 표시 오브젝트를 웹 파일에서 제외했습니다. 내려받은 원본에는 손대지 않습니다.
- FBX에서 파생된 GLB의 분리된 면 정점을 병합하고 원본의 평면 분할 노멀을 초기화했습니다. 뼈대 가중치는 유지하며 유기체의 표면을 부드럽게 표시합니다. Cute Fish의 눈은 홍채·테두리까지 함께 축소했습니다.
- 모든 재질은 GLB 내의 PBR 단색 재질입니다. 별도 텍스처가 없어 이미지 로딩 요청이나 누락 경로가 없습니다. 도감 이미지는 앱이 같은 모델·재질에서 생성합니다.
- 바닷속 일반 생물의 피부색은 2D와 같은 개체별 `color`를 반영합니다. 원본 모델의 눈·줄무늬·치아·발광점은 유지하며, 피부의 보조 재질에는 원래 음영을 일부 남깁니다. 색상별 재질은 모델별로 캐시하고 개체 재사용 시 다시 연결합니다. 일반 도감의 대표 색상은 유지합니다.
- 희귀 생물·메갈로돈은 눈과 무늬를 보존한 밝은 청백색 발광 피부와 청록색 후광으로 구분합니다. 후광은 공유 텍스처·재질을 사용하는 스프라이트로, 작은 물고기에도 최소 여백을 주며 게임 시계에 맞춰 부드럽게 맥동합니다. 일시정지 시 맥동도 멈추고 화면 밖 개체와 함께 회수됩니다. 도감에도 후광을 표시하되 미발견 실루엣에는 숨깁니다.
- 새 6종의 희귀형도 같은 GLB·뼈대·수영 클립을 재사용하며 기존 희귀종 재질과 후광을 적용합니다. 별도 희귀 GLB 다운로드는 없습니다. 생성 시 0.6% 확률과 바다 전체 1마리 제한을 기존 생물과 공유하고, 희귀 도감과 저장 키도 공유합니다.

## 재생성

Blender **4.5 LTS**에서 프로젝트 루트를 작업 디렉터리로 지정해 실행합니다. npm이나 웹 서버 실행에는 Blender가 필요하지 않습니다.

```powershell
blender --background --factory-startup --python scripts/assets/build_assets.py
```

이 환경에서는 공식 배포 파일의 SHA-256을 대조한 휴대용 Blender 4.5.13을 `.tools/blender-4.5.13-windows-x64/`에 사용했습니다. `.tools/`는 제작·검증용이며 배포하지 않습니다.

6종 추가 작업은 macOS ARM64용 Blender **4.5.3 LTS**로 진행했습니다. 공식 DMG의 SHA-256 `73ea841053b55404bb3a71a9a22366f1f8821787fe5c899f8b55a7fff929d01b`를 대조했습니다. 기존 21개 GLB는 유지하고 아래 선택 빌드로 6종만 생성했습니다.

```sh
.tools/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/assets/build_assets.py -- --only turtle crab shrimp dolphin whale oarfish
```

`--only`를 생략하면 27개 전체를 재생성합니다. 새로 제작한 4종의 형상·관절·모션은 `scripts/assets/new_species.py`에 있고, 미사용 원본의 분석과 이번 재사용 내역은 [미사용 모델 분석](unused-models.md)에 기록했습니다.

```powershell
.tools/blender-4.5.13-windows-x64/blender.exe --background --factory-startup --python scripts/assets/build_assets.py
```

재생성은 편집본 `.blend`, 웹 GLB, `public/models/manifest.json`을 다시 만듭니다. 다운로드 원본은 변경하지 않습니다. 직접 `.blend`를 편집할 경우 스크립트를 다시 실행하면 편집본이 재생성되므로, 수동 편집 내용을 먼저 별도 보관하거나 제작 스크립트에 반영합니다.

`manifest.json`은 모델별 용량, 정점 수, 축, 경계 크기, 애니메이션과 원본 경로를 기록합니다. `assets/source/checksums.sha256`은 내려받은 원본의 SHA-256입니다. 웹 파일을 다시 생성하면 용량과 바이너리 내용은 Blender 버전에 따라 조금 달라질 수 있습니다.

## 모델 검증

- Blender 4.5.13에서 21개 GLB를 모두 내보내고 다시 불러왔습니다.
- GLB JSON을 검사해 생물의 뼈대와 `Swim` 클립, 보완 모델의 모프 애니메이션이 존재함을 확인했습니다.
- `scripts/assets/validate_assets.py`로 GLB를 재수입한 뒤 0·12프레임의 실제 정점 좌표를 비교했습니다. 모든 애니메이션 모델의 변형을 확인했고 총 21개가 통과했습니다. 수치 결과는 `assets/source/validation.json`에 보관합니다.
- 최종 21개 GLB의 합계 용량은 2,121,172바이트입니다. 원본·편집용 Blender 파일은 웹 배포 대상이 아닙니다.
- `scripts/assets/preview_assets.py`로 렌더링한 측면 모델 시트를 확인했습니다. 결과는 `.tools/asset-preview/`에 생성되며 앱 배포에는 포함하지 않습니다.
- 가오리·불가사리의 자연스러운 평면 형태는 앱에서 기울여 표시하도록 렌더러와 연결했습니다.

## 2026-09-09 형상·시인성 보정

- 돌고래·고래·흰동가리와 기존 눈 보완 어종은 종별 머리 표면 좌표를 사용합니다. 휴식 자세에서 눈을 배치하고 인접 피부의 뼈대 가중치를 공유하며, 밝은 테두리와 돌출된 동공을 추가했습니다. 수영 주기의 8개 자세에서 양쪽 눈이 피부에 가려지지 않는지 실제 GLB로 검사합니다.
- 거북의 앞뒤 지느러미는 몸 안쪽의 회전축에서 시작하는 연속 형상입니다. 수영 주기의 16개 자세에서 네 지느러미 뿌리가 등딱지 안쪽에 연결되는지 검사합니다. 바닷속 3D 표시 크기는 기존의 50%이며 2D 크기와 관찰 기록은 유지합니다.
- 새우의 머리 덮개·이마 돌기·아래쪽 볼을 앞으로 확장해 2D의 돌출된 머리 윤곽을 반영했습니다.
- 3D 포식은 섬광, 두 겹의 충격파와 방사형 파편으로 표시합니다. 물안개나 생물에 가려지지 않고 시뮬레이션의 포식 수명에 맞춰 사라지며, 일시정지 시 멈춥니다. 인스턴싱과 동시 효과 수 제한을 적용하고 화면 재구성 시 GPU 자원을 회수합니다.

Blender 4.5.13으로 관련 10개 모델의 편집본과 GLB를 다시 생성했습니다. 전체 27개 GLB의 재수입·애니메이션 검증 결과는 assets/source/validation.json에 기록했습니다.
