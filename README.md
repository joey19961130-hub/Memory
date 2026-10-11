# 品牌官網（前台＋後台）

- **前台**：電影感捲動影片首頁 → 商品一覽（分類篩選、價格、LINE 詢問）→ 品牌故事 → 聯絡我們
- **後台**：網址加上 `#/admin`（例如 `https://你的網域/#/admin`），可新增／編輯／上下架／排序商品、上傳商品照片，並修改首頁所有文字、品牌故事照片、背景影片與 LINE 連結

技術：Vite + React 18 + TypeScript + Tailwind CSS 3 + Supabase（資料庫、圖片、登入）

## 本機執行

```bash
npm install
npm run dev        # 開發模式 http://localhost:5173
npm run build      # 產生 dist/ 可上傳到任何靜態主機
```

沒有設定 Supabase 時會以 **示範模式** 執行：後台可以操作，但資料只存在你自己的瀏覽器，其他人看不到。

## 正式上線：設定 Supabase（約 10 分鐘）

1. 到 <https://supabase.com> 註冊並建立新專案（免費方案即可）。
2. 左側 **SQL Editor** → 貼上 `supabase/schema.sql` 的全部內容 → Run。
   這會建立商品表、主頁內容表、公開的 `images` 圖片空間與權限（所有人可讀、只有登入者可改）。
3. 左側 **Authentication → Users → Add user**，建立管理員帳號（Email＋密碼）。
   建議到 **Authentication → Sign In / Providers** 關閉「Allow new users to sign up」，避免陌生人自行註冊成管理員。
4. **Project Settings → API** 複製 `Project URL` 與 `anon public` key，
   複製 `.env.example` 為 `.env.local` 並填入：
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. 部署（Vercel / Netlify / Cloudflare Pages 皆可）：Build command `npm run build`、輸出資料夾 `dist`，
   並在主機的環境變數設定同樣兩個值。

## LINE 詢問按鈕

後台「主頁內容 → 品牌與 LINE」：

- **LINE 官方帳號 ID**（例如 `@abc1234`）：填了之後，客人按任一商品的「LINE 詢問」，會開啟官方帳號聊天並自動帶入「您好，我想詢問「商品名稱」」。
- **LINE 加好友連結**（例如 `https://lin.ee/xxxx`）：沒有填官方帳號 ID 時使用。

## 背景影片（程式渲染的 15 秒動態影片）

首頁背景預設是 `public/hero-showreel.mp4`：用程式逐格渲染的 15 秒動態圖像影片，跟著捲動播放。
節奏配合首頁三段文字：前段淡色（深藍文字清楚），最後轉為深藍夜空（白色文字清楚），中間文字帶保持乾淨。

- `media/showreel.mp4`：同一支影片加上動態標題的作品集版本，可以單獨分享。
- 修改影片：編輯 `tools/showreel/showreel.html`（直接用瀏覽器打開可即時預覽，網址加 `?titles=1` 看標題版），再執行：
  ```bash
  node tools/showreel/render.mjs                              # 重新產生網站背景版
  node tools/showreel/render.mjs --titles media/showreel.mp4  # 重新產生作品集版
  ```
  需要 Playwright（Chromium）與 ffmpeg。
- 想換回原本的雲景空拍影片，到後台「首頁影片」貼上：
  `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4`
  外部影片需允許跨網域（CORS）才能逐格順暢捲動；不允許時會自動改用一般影片定位方式。

## 動態效果一覽

| 區塊 | 效果 |
|---|---|
| 進站 | 載入動畫：彩色圓點彈跳 → 品牌名逐字浮現 → 布幕向上掀開 |
| 首頁（Parallax） | 背景與文字分層跟著滑鼠移動（越前面的層移動越多）、捲動時各層不同速度位移、背景緩慢推近；標題逐字浮現 |
| 首頁第二、三段 | 逐字浮現；強調文字與兩行標題以不同速度滑入（文字視差） |
| 商品一覽（Scroll-triggered） | 標題逐字＋畫線、商品卡片依序浮上、照片由下往上展開；分類切換有滑動底色、切換後重新依序出現 |
| 商品詳情 | 電腦版縮放淡入、手機版由下往上滑出；內容依序出現 |
| 品牌故事 | 照片框展開＋捲動視差、文字浮現 |
| 導覽列 | 進場滑入、滑過時底線展開 |

手機（觸控）不啟用滑鼠視差；系統開啟「減少動態效果」時，所有動畫會自動關閉、內容直接顯示。

## 檔案結構

```
src/App.tsx               前台：捲動影片場景 + 各區塊
src/useVideoScrub.ts      捲動驅動影片（WebCodecs 解碼成影格庫、lerp 平滑、LRU 快取、失敗自動退回）
src/lib/motion.ts         動畫工具：進入畫面偵測、捲動視差、滑鼠視差
src/components/Reveal.tsx 捲動觸發動畫、逐字浮現、畫線
src/components/Loader.tsx 進站載入動畫
tools/showreel/           背景影片的原始碼與渲染腳本
src/lib/mp4demux.ts       mp4box 解析影片
src/lib/content.ts        資料存取（Supabase／示範模式）、LINE 連結、價格格式
src/components/           導覽列、手機選單、商品目錄、品牌故事、聯絡區
src/admin/Admin.tsx       後台
supabase/schema.sql       資料庫建立腳本
```
