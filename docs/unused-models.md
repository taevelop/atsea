# 받은 팩의 미사용 모델 분석

2026-09-08, 다운로드 폴더와 게임 모델 생성 경로를 대조했습니다. 두 팩의 서로 다른 원본 모델 15개 중 이번 추가 전에는 9개를 사용했고, 아래 6개는 사용하지 않았습니다. 같은 원본을 여러 게임 종에 재사용한 경우 원본 수는 한 번만 셌습니다.

| 원본 | 팩 / 보유 형식 | 삼각형 | 뼈 | 수영 클립 | 이번 적용 |
|---|---|---:|---:|---|---|
| Dolphin | Animated Fish / .blend·FBX·OBJ | 440 | 13 | Swim, 약 1.04초 | 돌고래로 추가 |
| Whale | Animated Fish / .blend·FBX·OBJ | 444 | 13 | Swim, 약 2.79초 | 고래로 추가 |
| Fish2 | Animated Fish / .blend·FBX·OBJ | 502 | 8 | Swim, 약 1.29초 | 미사용 유지 |
| Clownfish | Cute Fish / GLB | 1,530 | 6 | Swimming_Normal, 약 2.29초 | 미사용 유지 |
| RoyalGramma | Cute Fish / GLB | 1,378 | 6 | Swimming_Normal, 약 2.29초 | 미사용 유지 |
| Tuna | Cute Fish / GLB | 1,446 | 6 | Swimming_Normal, 약 2.29초 | 미사용 유지 |

삼각형·뼈·클립 수치는 보유 FBX/GLB 원본 기준이며, 변형한 웹 모델의 최종 정점 수·용량과는 다릅니다.

돌고래와 고래에는 척추·꼬리·양쪽 지느러미의 움직임이 이미 들어 있습니다. 이번에는 네이티브 `.blend` 원본에서 불필요한 요소를 정리하고 `Swim` 클립을 유지해 게임에 추가했습니다.

Cute Fish 세 모델에는 수영 3개, 공격·사망·물 밖 움직임을 합쳐 6개 클립이 있습니다. 이 팩의 보유 파일은 GLB이며 제작자의 원본 `.blend`는 없습니다. Blender로 불러와 편집용 `.blend`로 저장할 수 있습니다.

현재 게임의 `fish2`는 Cute Fish의 **BlueTang**입니다. Animated Fish의 **Fish2**와 서로 다릅니다. 현재 흰동가리 `fish6`은 Animated Fish의 **Fish3** 기반이므로 Cute Fish의 **Clownfish**는 여전히 미사용입니다.

두 팩은 로컬 원본 라이선스 고지상 Quaternius의 CC0 자료입니다. 출처와 고지문은 [모델 문서](assets.md)에 연결했습니다. 거북·게·새우·산갈치는 이 두 팩에 없어서 프로젝트용 Blender 모델과 수영 애니메이션을 새로 제작했습니다.

이번 적용 후 미사용 원본은 **Fish2·Clownfish·RoyalGramma·Tuna의 4개**입니다. 원본 팩에서 재사용한 모델은 11개가 되었습니다.
