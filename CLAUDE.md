# study-todo-app

공부 할 일 관리 + 망각곡선 복습(1·3·7·16·30일). 웹(PWA)과 앱(iOS·안드로이드)이
**같은 서버를 보는 서로 다른 화면**이다.

- `backend/app.js` — Express 앱·모델·라우트. DB 연결도 listen도 하지 않으므로 테스트에서 그대로 import한다.
- `backend/server.js` — 실제 구동 전용(포트 리슨 + MongoDB 연결).
- `backend/lib/` — DB·Express에 의존하지 않는 순수 로직.
- `shared/` — 웹과 앱이 **함께 쓰는** 순수 로직. 아래 "공유 코드" 절을 먼저 읽는다.
- `frontend/` — 웹. Vite + React 18 (JSX, ESM). 화면 규칙은 아래 "화면" 절을 먼저 읽는다.
- `mobile/` — 앱. Expo SDK 57 + Expo Router (TypeScript). 아래 "앱" 절을 읽는다.
- 실행: `npm start` (서버 + 웹) / `npm run start:mobile` (앱) / 테스트: `npm test`

**`배포전-체크리스트.md`** — 개발 중에는 비워 두고 스토어에 올리기 직전에 채우는 값들
(방침의 담당자 연락처, `ascAppId`, 방침 URL 등)과 손으로 눌러봐야 하는 목록.
코드에 플레이스홀더로 박혀 있어 빌드도 테스트도 통과하므로, 지우거나 옮기지 않는다.

## 공유 코드 (`shared/`)

화면 기술을 모르는 계산만 여기 둔다 — 웹의 DOM도, 앱의 `View`도 모른다.
`timeline`(타임라인 배치) · `dates`(날짜) · `labels`(말과 판단 기준) ·
`session`(세션의 형태) · `authFetch`(토큰 fetch) · `apiUrl`(주소 가드).

- **의존성이 없는 순수 ESM이다.** 라이브러리를 쓰는 코드가 들어오면 웹과 앱이 각각
  그것을 설치해야 하므로, 그때는 공유를 포기하거나 별도 패키지로 올린다.
- 양쪽 모두 **상대 경로**로 가져온다(`frontend`는 `../../shared/x.js`,
  `mobile`은 `@shared/x.js`). npm 워크스페이스로 묶지 않았다 —
  기존 세 패키지의 설치 구조를 건드리지 않기 위해서다.
- `mobile/metro.config.js`의 `watchFolders`가 이 폴더를 가리킨다. 지우면 앱이 `shared/`를
  못 찾는다.
- **웹 배포가 이 폴더에 의존한다.** 아래 "웹 배포(Vercel)" 절을 반드시 읽는다 —
  `.vercelignore`에 `shared/`를 넣으면 배포가 깨진다.

무엇을 공유하지 **않는가**: 색값(웹은 CSS 변수, 앱은 스타일 객체), 저장소
(웹은 `localStorage` 동기, 앱은 SecureStore 비동기), 화면 컴포넌트 전부.

## 배포 — 세 곳이 따로 나간다

| 대상 | 어디로 | 무엇이 트리거하나 |
| --- | --- | --- |
| 웹(PWA) | Vercel | `main` 푸시 (그 외 브랜치는 프리뷰) |
| 서버 | Railway (`railway.toml` → `node backend/server.js`) | 푸시 |
| 앱(iOS·안드로이드) | EAS Build → 스토어 심사 | **사람이 `eas build`를 부를 때만** |

**앱은 푸시로 나가지 않는다.** 웹·서버는 즉시 바뀌는데 앱은 심사를 거쳐 며칠 뒤에,
그마저도 사용자가 갱신해야 바뀐다. 그래서 **서버는 이미 나가 있는 앱 버전과 계속 호환돼야
한다** — 라우트를 지우거나 응답 모양을 바꾸면 구버전 앱이 조용히 깨진다. 필드는 더하고,
빼야 할 때는 앱 강제 업데이트 장치를 먼저 만든다.

### 웹 배포(Vercel) — Root Directory는 **저장소 루트**다

대시보드의 Root Directory를 `frontend`로 두면 안 된다. `frontend`가 빌드 시점에
**그 바깥의 `shared/`를 읽기 때문**이다(`../../shared/*.js`). 루트에서 빌드해야 닿는다.

- `vercel.json` → `buildCommand: npm run vercel-build`, `outputDirectory: frontend/dist`.
  이 두 값은 **Root Directory가 루트일 때만 맞다.** 빌드가 `Missing script: "vercel-build"`로
  죽으면 대시보드 설정이 `frontend`로 돌아가 있는 것이다 —
  `vercel.json`을 고치지 말고 **대시보드를 고친다.**
- `.vercelignore`가 `mobile/`·`backend/`를 뺀다. 웹 배포에 필요한 것은 `frontend/`와
  그것이 읽는 `shared/`뿐이다. **`shared/`를 여기 넣으면 배포가 깨진다.**
- **`VITE_API_URL`은 Preview 환경에도 등록해야 한다.** `vite build`는 Vercel 환경과 무관하게
  항상 production 모드라, `shared/apiUrl.js`의 가드가 프리뷰 빌드도 똑같이 막는다.
  Production에만 등록해 두면 PR 프리뷰가 전부 실패한다.

> 이 설정으로 여러 번 헤맨 기록이 `vercel.json` 히스토리에 남아 있다
> (`init` → `8e79e9f` → `b78e63f`). 실패하면 위 세 줄부터 확인한다.

## 다중 사용자

이메일 + 비밀번호 회원가입, JWT(30일)를 프론트 `localStorage`에 보관한다.

- `/api/auth/*`를 제외한 모든 `/api` 라우트는 `requireAuth`를 지난다. 새 라우트를 추가할 때
  **반드시 `userId`로 범위를 좁힌다** — 남의 데이터는 404로 취급한다(존재 여부도 알리지 않는다).
  할 일 조회는 `findOwnTodo(req)`를 쓴다.
- `Todo`·`Review`·`Category` 문서는 모두 `userId`를 가진다. 새로 만들 때 빠뜨리면 저장이 실패한다.
- 프론트는 `src/auth/session.js`(저장소)와 `shared/authFetch.js`(토큰 첨부 + 401 처리)를 지난다.
  `SessionExpiredError`는 **실패가 아니다** — 이 예외에는 배너도 alert도 띄우지 않는다(이미 로그인 화면이다).
- 서버에 `JWT_SECRET` 환경변수가 필요하다. 없으면 인증 라우트가 503을 준다(배포 시 Railway에 등록).

### 토큰 무효화

`User.token_version`이 토큰 안의 `ver`와 다르면 그 토큰은 죽는다. 비밀번호를 바꿀 때 1 올려서
기존 로그인을 한 번에 끊는다. 그래서 `requireAuth`는 서명만 보지 않고 **사용자를 실제로 읽는다**
(요청당 조회 1회). 토큰을 발급하는 곳에서는 반드시 `issueToken(user)`을 쓴다 —
버전을 빠뜨리면 발급 즉시 무효가 된다.

`ver`가 없는 토큰은 `0`으로 읽는다. 이 기능을 넣기 전에 발급된 토큰을 살려두기 위한 것이다.

## 할 일 성격 (`Category`)

사용자가 직접 만드는 분류("영어", "과제"…)에 색을 붙여 목록에서 종류가 눈에 잡히게 한다.
할 일 하나에 성격 하나(`Todo.category_id`, 없어도 된다). 관리는 계정 메뉴의 "성격 관리" 시트.

**색은 색값이 아니라 칸 번호(1~8)를 저장한다.** 실제 색은 화면에만 있다 —
웹은 `App.css`의 `--cat-N`/`-bg`/`-fg`. 그래야 색을 다시 맞춰도 이미 저장된 성격이
그대로 따라오고, 화면 조정 패널로 여덟 색을 만질 수 있다.
**앱(`mobile/`)에는 아직 이 색이 없다** — 앱에도 칩을 그리게 되면 `constants/tokens.ts`에
여덟 칸을 옮겨 적어야 한다(중요도 색과 같은 방식의 중복이다).
칸 수와 색 이름은 `shared/labels.js`의 `CAT_SLOTS`·`CAT_COLOR_LABELS`에 있다
(백엔드는 CommonJS라 그 파일을 못 읽어 `backend/lib/categories.js`가 개수를 한 번 더 들고 있다).

**`PUT /api/todos/:id`의 `category_id`는 `progress`와 똑같이 `!== undefined`로 감싼다.**
이 라우트는 나열된 필드를 무조건 덮어쓰기 때문에, 무조건 대입하면 이 필드를 모르는 옛 화면이
수정을 보낼 때마다 성격이 지워진다 — 홈 화면에 설치한 앱은 사용자가 갱신을 수락할 때까지
캐시된 옛 번들로 돈다. 그래서 성격을 없앨 때는 생략이 아니라 `category_id: null`을 보낸다.
(`app.test.js`의 "수정 요청에 성격이 없으면 기존 성격을 지우지 않는다"가 이것을 지킨다)

- 성격을 지울 때는 **성격을 먼저 지우고 그 다음에 할 일을 비운다.** 트랜잭션이 없어서 둘 사이에서
  죽을 수 있는데, 이 순서로 남는 상태만이 사용자가 누른 그대로다(화면은 없는 성격을 조용히 무시한다).
- 남의 성격을 내 할 일에 붙이려 하면 **404가 아니라 400**이다. 그 라우트의 404는 이미
  "이 할 일이 없다"는 뜻이라 화면에 엉뚱한 말이 뜬다. 없는 성격·남의 성격·형식이 틀린 값에
  똑같은 400을 주므로 존재 여부는 여전히 새어 나가지 않는다.
- 성격 목록을 못 받아와도 **화면 전체를 막지 않는다**(`App.jsx`의 `fetchCategories`는 조용히 빈 목록으로 둔다).
  이 기능이 없는 옛 서버는 404를 주는데, 곁다리 하나로 "서버에 연결할 수 없습니다"가 뜨면 안 된다.

### 운영 스크립트

- `node backend/scripts/migrate-to-user.js <이메일>` — 사용자 구분이 없던 시절의 데이터를 계정에 붙인다.
- `node backend/scripts/reset-password.js <이메일> <새 비밀번호>` — 비밀번호를 잊었을 때의 유일한 구제 수단
  (이메일 발송 기반 찾기는 없다). 재설정하면 그 계정의 모든 로그인이 끊긴다.

둘 다 여러 번 실행해도 안전하고, 조건이 맞지 않으면 아무것도 바꾸지 않고 실패한다.
핵심 로직은 `module.exports`로 빼두어 `app.test.js`에서 직접 테스트한다.

## 화면

모바일 우선이다. 이 앱은 설치형 PWA라 폰이 주 사용 환경이고, 데스크탑 3열은 넓어졌을 때의 모습이다.

### 디자인 토큰

색·간격·모양은 **`frontend/src/App.css` 맨 위 `:root` 토큰에서만** 나온다.
컴포넌트나 CSS 규칙에 색값(`#4d6b57`)을 직접 적지 않는다 — 한 곳을 고쳐도 화면이 따로 노는 원인이 된다.
JS가 인라인 스타일로 색을 넣어야 하면 `src/theme.js`가 주는 `var(--...)` 문자열을 쓴다.

- `/* theme:start */` ~ `/* theme:end */` 표시선 사이는 **개발 서버가 고쳐 쓴다**
  (`vite.config.js`의 `themeWriter`). 표시선을 지우면 화면 조정 패널의 "확정"이 죽는다.
- 개발 모드에서 왼쪽 아래 **◑** 버튼 → 화면 조정 패널. 색·모서리·배율을 화면 보면서 맞추고
  "확정"을 누르면 App.css의 해당 값이 실제로 바뀐다. 패널은 운영 빌드에 들어가지 않는다
  (`App.jsx`에서 `import.meta.env.DEV`일 때만 지연 로딩한다 — 정적 import로 바꾸면 CSS가 딸려 나간다).
- 간격·글자는 화면 폭마다 기준값이 다르므로 고정값이 아니라 `--space-scale` / `--type-scale`
  **배율**로 조정한다. 그래야 폰·태블릿·데스크탑에 같이 반영된다.

### 이모지를 쓰지 않는다

📌 ✏️ 🗑️ 대신 `components/icons.jsx`의 선 아이콘을 쓰고, 뜻은 `title`/`aria-label`이 전달한다.
텍스트에서도 마찬가지다 — "📅 D-1"이 아니라 "마감 D-1"처럼 말로 쓴다.

### 그 밖의 화면 규칙

- **타임라인 블록 안에 시각을 적지 않는다.** 시각은 블록이 어느 눈금에 걸쳐 있는지가 말해준다.
  좁은 칸에서 "21:51 – 12:51"이 말줄임표로 끊기면 적은 의미가 없다. 정확한 값은 목록 보기와
  블록의 `title`에 있다.
- 타임라인 계산은 순수 함수 두 개다 — `layoutTimed`(겹치는 항목을 나란한 칸으로),
  `buildTimeAxis`(세로 축). **축은 06–24시 눈금을 하나도 빼지 않되 빈 시간대의 높이만 접는다**
  (52px → 18px). 시각↔좌표 변환은 반드시 `axis.yOf`를 쓴다 — 시간대마다 높이가 달라서
  `(분/60)×52` 같은 계산은 더 이상 맞지 않는다.
- **입력칸은 `<label>`로 감싼다.** `for`/`id` 없이 라벨과 칸을 나란히만 두면 둘이 연결되지 않아
  화면 낭독기가 무슨 칸인지 읽어주지 못하고, 테스트도 `getByLabelText`로 찾지 못한다.
- 한 줄로 못박은 글자(`white-space: nowrap`)의 줄 높이는 CSS에 고정해 둔다 —
  JS 쪽 최소 높이 계산이 그 값에 기대고 있다(`TodaySection`의 `MIN_BLOCK_PX`).

### 설치한 앱(PWA)의 갱신

홈 화면에 설치한 앱은 캐시에서 뜨므로 배포해도 저절로 최신이 되지 않는다.
**서비스 워커는 `registerType: 'prompt'`다** — 새 버전이 설치돼도 나서지 않고 기다리고,
`UpdatePrompt`가 "새 버전이 있습니다"를 띄운 뒤 사용자가 누를 때 교체한다.
자동으로 갈아끼우면 할 일을 적던 도중에 화면이 다시 읽혀 입력이 날아간다.

- 등록은 `src/registerServiceWorker.js`가 직접 한다. `injectRegister: null`인 이유 —
  플러그인이 넣어주는 스크립트는 등록만 하고 새 버전을 알려주지 않는다.
- 교체는 대기 중인 워커에 `{ type: 'SKIP_WAITING' }`을 보내고 `controllerchange`에서
  새로고침한다. 워크박스가 만든 워커가 이 메시지를 처리한다 —
  **`registerType`을 바꾸면 이 약속이 깨지므로 `dist/sw.js`에서 확인할 것.**

### 반응형 — 경계는 700 / 1100px 둘뿐

| 폭 | 레이아웃 |
| --- | --- |
| < 700px | 1열 + 하단 탭바(`BottomTabBar`) |
| 700–1099px | 왼쪽 칸 전체가 오늘, 오른쪽 칸을 목록·복습이 위아래로 |
| ≥ 1100px | 3열. **드래그 앤 드롭은 여기서만** |

- 할 일 추가·수정 폼은 **어느 폭에서나 + 버튼 뒤에 있다**(`BottomSheet`). 목록 위에 상시 두면
  자리를 크게 먹는다. 좁으면 아래에서 올라오는 시트, 넓으면 가운데 대화상자 — 생김새만 CSS가 가른다.
- 2열일 때 두 행 모두 `minmax(0, ...)`로 잡는다. 위 행을 `auto`로 두면 내용이 길 때
  아래 행이 0으로 눌려 통째로 사라진다.

- **레이아웃은 되도록 CSS로 처리한다.** 세 열은 항상 DOM에 있고 `.app[data-tab]`이 보이는 것만 바꾼다.
  `useMediaQuery`는 DOM 구조 자체가 달라질 때만 쓴다(같은 폼을 카드에 둘지 시트에 둘지 등).
- `draggable`은 터치에서 동작하지 않는다. 드래그로만 되는 기능을 만들지 않는다 —
  좁은 화면에는 반드시 버튼 경로를 함께 둔다.
- 모바일 입력칸은 **16px 미만으로 두지 않는다.** iOS가 누를 때 화면을 확대한다.
- 누르는 것은 `--tap`(모바일 44px) 이상으로 둔다.

## 알림 (웹 푸시)

매일 정해진 시각에 **그날 복습할 항목을 요약해 1건** 보낸다. 앱이 닫혀 있어도 오도록 서버가 밀어준다
(Web Push + VAPID). 건별 알림이 아니라 하루 1건이다 — 복습이 5개면 알림도 5개가 되면 안 된다.

- `backend/lib/push.js` — 문구·시각 판단 등 순수 로직. `backend/lib/webpush.js` — `web-push` 껍데기.
  이 둘은 우리 모델을 모른다. 그래서 `app.js`와 `reminders.js` 양쪽에서 써도 순환 import가 없다.
- `backend/reminders.js` — 조회·발송. `server.js`가 DB 연결 후 `startReminderScheduler()`로 켠다.
- 수동 실행: `node backend/scripts/send-reminders.js [--force]` (`--force`는 시각 검사를 건너뛴다).

### 환경변수

`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `VAPID_SUBJECT`,
`REMINDER_TIME`(기본 `09:00`), 그리고 **`TZ=Asia/Seoul`**.

- 키가 없으면 알림 라우트만 503이 되고 서버는 그대로 산다(JWT_SECRET과 같은 방식).
  **VAPID 키도 모듈 로드 시점이 아니라 호출 시점에 읽는다** — 그러지 않으면 테스트가 환경변수를
  나중에 넣는 패턴이 깨진다.
- **`TZ`는 배포 환경에 진짜 환경변수로 넣어야 한다.** 컨테이너 기본값이 UTC라서, 없으면 `localDate()`가
  한국 날짜와 어긋나 알림 시각도 복습 날짜도 하루씩 밀린다. `.env`로 넣는 것은 프로세스가 이미 뜬 뒤라
  로컬에서는 확실하지 않다.

### 하루 1건과 자기 복구

보낼지 말지는 `shouldSendNow`가 정하는데, **"정각과 일치하는가"가 아니라 "지정 시각을 지났는데
오늘 아직 안 보냈는가"**로 본다. 09:00:30에 재시작하거나 tick 하나를 놓쳐도 알림이 사라지지 않는다.
"오늘 보냄" 표시는 구독 행의 `last_sent_date`에 남는다 — 기기별로 남으므로 기기가 둘이면 둘 다 받는다.
발송에 실패하면 표시를 남기지 않아 다음 tick에 다시 시도하고, 404/410(만료)이면 그 구독 행을 지운다.

### 구독은 기기 하나당 한 행

`PushSubscription.endpoint`가 unique다. 같은 기기에서 다시 켜거나 **다른 계정으로 로그인하면
upsert가 주인을 최신 계정으로 갈아끼운다.** 로그아웃할 때 구독을 지우지는 않는다.
설정 화면의 기준은 서버가 아니라 브라우저다 — `pushManager.getSubscription()`이 있으면 켜진 것으로
보고, 시트를 열 때 서버로 한 번 다시 올려 양쪽을 맞춘다.

### 서비스 워커에 얹는 방식

`push`·`notificationclick` 핸들러는 `frontend/public/push-sw.js`에 있고, 워크박스가 만든 워커가
`importScripts`로 불러온다(`vite.config.js`의 `workbox.importScripts`).
**`strategies`를 `injectManifest`로 바꾸지 않는다** — 그러면 `precacheAndRoute`와 `SKIP_WAITING`
처리를 직접 떠안게 되어 위의 "설치한 앱(PWA)의 갱신" 약속이 깨진다. 빌드 후 `dist/sw.js`에
`importScripts("/push-sw.js")`와 `SKIP_WAITING` 처리가 **둘 다** 있는지 확인할 것.

`pushManager`는 서비스 워커 등록을 통해서만 닿는다. 등록은 `registerServiceWorker.js`의
`getRegistration()`이 준다(같은 URL·scope의 `register()`는 브라우저가 같은 등록을 돌려주므로
여러 번 불러도 된다 — 모듈에 캐시를 두지 않는다).

### 로컬에서 확인하기

**개발 서버(`npm run dev`)에는 서비스 워커가 없다**(`devOptions`를 켜지 않았다). 알림을 확인하려면
빌드해서 띄운다:

```
cd frontend && npx vite build --mode development && npx vite preview
```

`--mode development`여야 `.env.local`의 로컬 API 주소를 쓴다. 그냥 `build`하면 `.env.production`의
배포 주소가 박힌다. 09시를 기다리지 않으려면 설정 시트의 "테스트 알림 보내기"를 쓴다.

### iOS

iOS는 **홈 화면에 설치한 PWA에서만** 푸시가 온다(16.4+). 사파리 탭에서는 오지 않으므로,
설정 화면은 iOS이면서 설치 상태가 아니면 토글 대신 설치 안내를 보여준다.

## 시간에 의존하는 기능 확인하기

복습은 1·3·7·16·30일 뒤에 뜨고, 마감 표시는 날짜가 지나야 바뀐다. 그대로 두면 확인에 한 달이 걸린다.

**시스템 시계를 바꾸지 않는다.** TLS 인증서가 만료로 뜨고 JWT가 깨지며 git 커밋 시각과 빌드 캐시가
오염된다. 되돌려도 한동안 이상하게 동작한다. 대신 **데이터를 뒤로 민다** — "나중에 떠야 할 것"을
오늘 마감으로 미리 넣는다.

### 시드 데이터 (손으로 볼 때)

무엇을 넣을지는 `backend/fixtures.js`가 목적별 묶음(`reviewChain` / `deadlines` / `yesterday`)으로
정하고, `backend/scripts/seed-demo.js`가 그것을 DB에 넣는다. **같은 정의를 `backend/fixtures.test.js`도
쓴다** — 정의를 두 벌로 만들면 반드시 한쪽만 썩는다. 기능이 늘면 `SCENARIOS`에 묶음을 하나 더한다.

```
npm --prefix backend run seed                          # 전부
npm --prefix backend run seed -- --only reviewChain    # 특정 묶음만
npm --prefix backend run seed -- --clean               # 넣었던 것만 삭제
```

`테스트데이터.bat`을 더블클릭해도 된다(넣기/지우기 선택). 윈도우 PowerShell의 기본 실행 정책은
`npm`(실제로는 `npm.ps1`)을 막으므로, `시작하기.bat`과 함께 정책을 건드리지 않고 쓰는 경로다.
배치 파일 안의 안내문은 cmd 코드페이지 문제를 피해 **영문으로 쓴다**(기존 배치들과 같은 규칙).
파일 이름은 한글이어도 되지만 **내용에 한글이 하나라도 들어가면 cmd가 파일 전체를 잘못 읽어
명령이 조각난다** — 실제로 겪은 적이 있다.

### 앱이 안 뜰 때: 남은 프로세스

창을 `[X]`로 닫으면 `node`가 백그라운드에 남아 **3001·5173을 계속 붙잡는다.** 그러면 다음 실행에서
백엔드가 `EADDRINUSE`로 즉시 죽고, vite는 5173 대신 5174로 밀려나 브라우저에는
`ERR_CONNECTION_REFUSED`만 보인다. `종료하기.bat`이 그 포트들을 정리한다. 끌 때는 창에서 `Ctrl+C`.

참고로 **vite는 `::1`(IPv6)에만 바인딩한다.** `localhost`로는 열리지만 `127.0.0.1`로는 안 열린다.

시드는 **테스트 전용 계정(`test@test.local`, 없으면 만들고 비밀번호를 출력)에만** 들어간다.
이 앱은 남의 할 일을 보여주지 않으므로 실제 계정으로 로그인하면 시드는 한 개도 보이지 않는다.
할 일 이름의 `[시드]` 접두어는 `--clean`이 지울 대상을 특정하는 2차 장치다. 대상 계정에 시드가 아닌
할 일이 있으면 스크립트는 "실제로 쓰는 계정"으로 보고 중단한다.

시드를 넣으면 복습 1~5단계가 전부 오늘 마감으로 깔리므로, 완료를 눌러 가며 다음 마감이
**+2 / +4 / +9 / +14일**로 잡히는지(누적값이 아니라 `INTERVALS`의 차분값이다) 한 자리에서 볼 수 있다.

### 알림

`node backend/scripts/send-reminders.js --force`는 빠르지만 **시각 검사를 건너뛴다** — 09시 판정
로직을 지나지 않는다. 그 경로까지 태우려면 `--reset-push`로 "오늘 이미 보냄" 표시를 지우고
`REMINDER_TIME`을 지금보다 이른 시각으로 낮춘 뒤 `--force` 없이 실행한다.

### 자동화 테스트

시각을 인자로 받는 함수(`runReminderTick({ now })`, `buildScenarios(today)`)는 그 인자에 고정 날짜를
꽂는다. 그럴 수 없는 곳은 `vi.useFakeTimers()` + `vi.setSystemTime()`으로 시계를 세운다.

`localDate()`(`backend/lib/dates.js`)는 아직 주입을 받지 않으므로 라우트를 거치는 테스트는 실제 오늘을
쓴다 — 픽스처에도 `localDate()`를 그대로 넘겨 양쪽의 "오늘"을 맞춘다.

## TDD는 사용자가 요청할 때만 (Red → Green → Refactor)

**기본값은 TDD가 아니다.** 평소에는 그냥 구현하고, 필요하면 구현 후 테스트를 붙인다.

사용자가 "TDD로", "테스트 먼저", "Red-Green" 같이 **명시적으로 요청한 경우에만** 아래 절차를 따른다.
요청받지 않았는데 TDD 사이클을 시작하거나, "TDD로 할까요?"라고 되묻지 않는다.

TDD 요청을 받았다면 **구현 코드부터 쓰지 않는다.** 아래 순서를 지킨다.
각 단계 사이에서 멈추고 사용자 확인을 받는다. 여러 단계를 한 번에 처리하지 않는다.

### 0. 명세 확인
아이디어를 **검증 가능한 요구사항 목록**으로 바꿔서 사용자에게 보여주고 동의를 받는다.
- 입력 / 기대 출력, 엣지 케이스, 실패 시 동작을 문장으로 적는다.
- 애매한 부분이 있으면 여기서 질문한다. 나중에 추측으로 채우지 않는다.

### 1. Red — 테스트만 작성
테스트 파일만 만든다. **구현은 아직 쓰지 않는다.**
- 백엔드 순수 로직 → `backend/lib/<이름>.test.js`
- API 라우트 → `backend/*.test.js` (supertest 사용)
- 화면 → `frontend/src/**/<이름>.test.jsx` (@testing-library/react)
- 좁은 화면 동작 → `frontend/src/App.mobile.test.jsx` (matchMedia를 흉내낸다)

작성 후 `npm test`를 **실제로 실행해서 실패를 확인**하고, 실패 로그를 사용자에게 보여준다.
처음부터 통과하는 테스트는 아무것도 검증하지 못한다. 이 단계를 건너뛰지 않는다.

### 2. Green — 최소 구현
실패한 테스트를 통과시키는 **최소한의 코드**만 쓴다. 요청받지 않은 최적화·추가 기능은 넣지 않는다.
`npm test`를 실행해 전부 통과(초록)하는 것을 확인하고 결과를 보여준다.

### 3. 엣지 케이스 보강
놓친 케이스를 스스로 찾아 테스트를 추가한다 (경계값, 빈 값/null, 날짜 경계, 중복 요청 등).
새 테스트가 실패하면 구현을 고친다 → 다시 Red-Green.

### 4. Refactor
테스트가 모두 통과하는 상태에서 가독성·구조만 개선한다. **기능은 추가하지 않는다.**
리팩토링 후 `npm test`가 여전히 통과해야 한다. 깨졌으면 리팩토링이 아니라 버그다.

### 규칙 요약 (TDD 요청 시에만 적용)
- 한 사이클 = 기능 하나. 크면 쪼개서 여러 사이클로.
- 테스트와 구현을 같은 응답에서 동시에 작성하지 않는다.
- "테스트를 실행했다"고 말하려면 실제로 `npm test`를 돌린 출력이 있어야 한다.
- 기존 테스트를 통과시키려고 테스트 쪽을 고치지 않는다. 명세가 바뀐 경우에만 사용자 확인 후 수정.

## 테스트 작성 규칙

(TDD 여부와 무관하게, 테스트를 쓸 때는 항상 적용)

- 러너는 **Vitest**. 백엔드는 `backend/vitest.config.js`(node 환경), 프론트는 `frontend/vite.config.js`의 `test` 섹션(jsdom).
- 순수 로직은 `backend/lib/`에 두고 직접 테스트한다. DB·Express를 끌어들이지 않는다.
- API 라우트는 `backend/app.test.js`처럼 `mongodb-memory-server`를 띄우고 `backend/app.js`를
  supertest로 호출한다. `backend/server.js`는 리슨·연결 전용이므로 import하지 않는다.
- **사용자 범위를 넓히는 변경에는 격리 테스트를 같이 쓴다** — 다른 사용자로 접근하면 404인지,
  원본 데이터가 그대로인지까지 확인한다(상태 코드만 보면 조용히 수정되는 버그를 놓친다).
- 날짜는 `backend/lib/dates.js`의 `localDate` / `addDays` / `toDateStr`를 쓴다. 새로 만들지 않는다.
- 테스트 이름은 한국어로, "무엇을 보장하는지" 서술형으로 쓴다.
- **jsdom에는 `matchMedia`가 없다.** `useMediaQuery`가 늘 false를 주므로 테스트는 기본적으로
  넓은 화면을 본다. 좁은 화면 동작을 확인하려면 `App.mobile.test.jsx`처럼 `matchMedia`를 흉내낸다.
- 화면 구조에 거는 단언은 클래스명이 아니라 역할로 건다 — 섹션 제목은 `getByRole('heading')`,
  ⋯ 메뉴 항목은 `getByRole('menuitem')`. 스타일을 손봤다고 테스트가 깨지면 안 된다.
- 시간에 의존하는 테스트는 `vi.useFakeTimers()` + `vi.setSystemTime()`으로 고정한다.
- **경계값은 바깥쪽까지 확인한다.** 마감 임박은 3일 이하이므로 D-3만 보면 조건이 `<= 4`로 넓어져도
  통과한다. D-4도 함께 본다. 다만 이 둘은 화면 글자가 "마감 D-3" / "마감 D-4"로 똑같고 차이가
  클래스(`dl-soon` vs `dl-normal`)뿐이라, **여기서만은** 클래스에 단언을 건다(`TodoItem.test.jsx`).
  구분을 나르는 것이 클래스밖에 없을 때의 예외이고, 구조에 거는 단언은 여전히 역할로 건다.
- 버그를 고치고 회귀 테스트를 붙였다면 **수정을 잠깐 되돌려 그 테스트가 실제로 실패하는지** 본다.
  통과만 보고 넘어가면 아무것도 검증하지 않는 테스트가 남는다.

## 앱 (`mobile/`)

Expo SDK 57 + React Native 0.86 + Expo Router. **TypeScript다** — 저장소에서 유일하게.
실행은 `npm run start:mobile`(= `mobile/`에서 `npx expo start`).

- 화면은 `mobile/src/app/`의 파일 경로가 곧 라우트다. 탭 넷(`(tabs)/index` 오늘 ·
  `list` 목록 · `review` 복습 · `settings` 설정)과 `login` 하나.
- **로그인 관문은 `src/app/_layout.tsx`에서 통째로 가른다.** 라우터로 가르지 않는 이유 —
  로그인하지 않은 사람에게는 탭 자체가 없어야 뒤로가기·딥링크로 새어 들어갈 구멍이 없다.
- 할 일을 보는 세 탭은 `TodosProvider`가 쥔 목록 하나를 함께 본다. 탭마다 받아오면 같은
  데이터를 세 번 부르고, 한 탭에서 완료한 것이 다른 탭에 반영되지 않는다.
- **설정을 메뉴가 아니라 탭으로 둔 것은 의도다.** 심사자가 계정 삭제를 직접 찾아 눌러봐야
  통과한다 — 접어 두면 "못 찾았다"로 반려된다. 웹처럼 헤더 메뉴에 접지 않는다.
- 앱 밖으로 나가는 주소는 `Linking`이 아니라 `WebBrowser.openBrowserAsync`로 연다.
  앱을 떠나지 않고 그 위에 뜬다(Expo 문서가 개인정보처리방침을 이 함수의 예로 든다).
- 토큰은 **SecureStore**에 둔다(iOS 키체인 / 안드로이드 키스토어). AsyncStorage에 두면
  기기를 잃었을 때 평문으로 남는다. 웹의 `localStorage`와 달리 전부 async다.
- 색은 `src/constants/tokens.ts`에서만 나온다. **이 파일은 `frontend/src/App.css`의
  `:root`를 손으로 옮긴 것이다** — 앱에는 CSS 변수가 없어 화면 조정 패널을 그대로 가져올 수
  없었다. 한쪽을 고치면 다른 쪽도 고친다. 지금 웹·앱 사이의 유일한 중복이다.
- 웹의 화면 규칙은 여기서도 그대로다: 이모지 대신 선 아이콘(`@expo/vector-icons`),
  입력칸 16px 이상, 누르는 것 44px 이상, 드래그로만 되는 기능을 만들지 않는다.

### 아직 없는 것

목록 화면의 추가·수정 폼(웹의 `BottomSheet`에 해당), 오늘 화면의 타임라인 보기
(계산은 `shared/timeline.js`에 이미 있고 그리는 부분만 없다), 알림, 비밀번호 변경.
설정 화면에는 아직 계정에 관한 것만 있다.

### 스토어에 올리기 전에 반드시 필요한 것

- **계정 삭제 — 웹·앱 모두 붙었다.** 웹은 계정 메뉴 → 회원 탈퇴, 앱은 설정 탭 → 회원 탈퇴.
  둘 다 `DELETE /api/auth/me`를 부르고, 성공하면 이 기기의 세션을 지운다.
- **알림은 웹 푸시로 앱에 가지 않는다.** `backend/lib/webpush.js`의 VAPID는 브라우저 전용이라
  APNs/FCM을 타야 한다. `reminders.js`의 "하루 1건 요약" 판단은 그대로 두고 발송 어댑터만 는다.
- 개인정보처리방침 주소는 로그인 화면 아래에 둔다(`src/constants/links.ts`).
  문서 본문은 `frontend/public/privacy.html` 하나뿐이고 웹·앱이 같은 것을 본다.

### 회원 탈퇴 (`DELETE /api/auth/me`)

비밀번호를 다시 받아 확인하고 **그 자리에서 전부 지운다** — 유예 기간도, 보관용 사본도 없다.
`PushSubscription` → `Review` → `Todo` → `User` 순서로 지운다. **`User`가 마지막이어야**
중간에 실패해도 다시 로그인해 재시도할 수 있다(먼저 지우면 주인 없는 문서만 남는다).

- **비밀번호가 틀리면 401이 아니라 403이다.** `shared/authFetch.js`는 401을 세션 만료로 보고
  무조건 로그아웃시키므로, 401을 주면 오타 한 번에 화면째로 튕겨나간다.
  (같은 이유의 버그가 `PUT /api/auth/password`에 아직 남아 있다 — 거기는 401을 준다.)
- 남은 토큰을 따로 무효화하지 않는다. `requireAuth`가 요청마다 사용자를 읽으므로
  계정 문서가 사라지는 순간 모든 기기의 토큰이 401이 된다.
- 확인 창은 웹 `DeleteAccountModal.jsx` / 앱 `delete-account-modal.tsx`. 성공 화면이 없다 —
  성공하면 곧바로 로그아웃해서 트리째 사라지므로 보여줄 다음 화면이 없다.
  앱에서 `Alert`를 쓰지 않는 이유는 비밀번호를 받아야 하는데 `Alert.prompt`가 iOS 전용이어서다.

### 빌드·제출 (EAS)

`mobile/eas.json`에 프로필 셋(development / preview / production)이 있다.
**Mac이 없어도 iOS 빌드가 된다** — EAS가 클라우드에서 빌드한다.

```
eas build --platform ios --profile production --auto-submit
eas submit --platform android
```

`submit.production.ios.ascAppId`는 App Store Connect에서 앱을 만든 뒤 채운다.
서버 주소는 `EXPO_PUBLIC_API_URL`로 **빌드 시점에 박힌다** — 잘못 박으면 앱을 다시
심사받아야 고쳐지므로, `shared/apiUrl.js`가 운영 빌드에서 값이 없거나 상대 경로면
빌드를 실패시킨다.
