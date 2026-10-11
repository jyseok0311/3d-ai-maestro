# 3D AI Maestro · WareTrack

물류센터 3곳을 실시간 전략(RTS) 게임처럼 내려다보며 관제하는 3D 창고 관리 앱입니다.
React Three Fiber + drei + Zustand + TypeScript + Vite.

- **라이브 데모:** https://3d-ai-maestro.vercel.app
- **GitHub:** https://github.com/jyseok0311/3d-ai-maestro

`main` 브랜치에 푸시하면 Vercel이 자동으로 프로덕션에 배포합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # 타입 체크
npm run build      # 프로덕션 빌드 (dist/)
```

## 조작

| 동작 | 입력 |
| --- | --- |
| 지도 이동 | 마우스 드래그 |
| 줌 | 마우스 휠 |
| 상세 보기 | 트럭·지게차·도크·선반 클릭 |
| 선택 해제 | 빈 곳 클릭 또는 `Esc` |
| 사이트 이동 | 상단 BNP / GHE / YSN / 전체 |

## 구조 (영상의 5단계 프롬프트 순서)

| 단계 | 내용 | 파일 |
| --- | --- | --- |
| 1. 데이터 모델 | Site·Dock·Truck·Forklift·InventoryItem·Shipment 타입, 시드 데이터(3 사이트, 18 도크, 12 트럭, 8 지게차, 40 SKU, 25 배송) | `src/data/` |
| 2. 3D 씬 | 로우폴리 도크·트럭·지게차·선반, 아이소메트릭 카메라(드래그/휠/맵 경계), 소프트 섀도, 그리드 바닥 | `src/scene/` |
| 3. 클릭 상세 | 클릭 시 윤곽선+바닥 링, 우측 상세 패널, 2초마다 상태 시뮬레이션(Zustand) | `src/sim/`, `src/store/`, `src/ui/InspectorPanel.tsx` |
| 4. KPI·사이트·필터 | 사이트 전환 시 카메라 부드럽게 이동, 정시 도착률·도크 사용·운행 트럭·재고 부족, 지연/트럭 상태 필터 | `src/ui/TopBar.tsx`, `src/ui/FilterPanel.tsx`, `src/store/selectors.ts` |
| 5. 리뷰·최적화 | 선반 540개를 인스턴싱 4 draw call로, 도로·주차 마킹 인스턴싱, 공유 지오메트리/머티리얼, memo + 원시값 props로 변경된 객체만 리렌더 | 전체 |

### 데이터 모델 요약
- `Site`가 루트이며 나머지 엔티티는 모두 `siteId`로 사이트에 속합니다.
- `Truck`↔`Dock`(`dockId`/`truckId`), `Truck`↔`Shipment`(`shipmentId`/`truckId`)는 양방향 1:1 참조입니다.
- `Shipment.lines`가 `InventoryItem`을 수량과 함께 참조합니다(N:N).
- `Forklift`는 처리 중인 `Shipment`를 선택적으로 참조하고, 사이트 내 좌표로 위치를 가집니다.
- 모든 컬렉션은 id로 정규화된 `Record`이며, 시뮬레이션은 바뀐 레코드만 교체하는 순수 함수입니다.

> 시뮬레이션 시간은 압축되어 있어(ETA 수십 초) 지연·정시 도착이 짧은 시간 안에 계속 발생합니다.
