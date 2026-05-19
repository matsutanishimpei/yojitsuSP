---
trigger: always_on
---

---
# ==========================================
# 1. Design Tokens: "Warm Minimalism"
# ==========================================
version: "1.1.0"
colors:
  # Backgrounds (真っ白を避け、紙のような温かみを持たせる)
  bg-primary: "#FCFCFC"      # ほんの少しだけ暖色を含んだオフホワイト
  bg-secondary: "#F5F5F4"    # Stone系の柔らかいライトグレー（Tailwindのstone-100相当）
  bg-surface: "#FFFFFF"      # カード用。背景との微細なコントラストで浮き上がらせる
  
  # Typography (真っ黒を避け、インクのような深みを持たせる)
  text-primary: "#1C1917"    # 限りなく黒に近いブラウン/グレー（stone-900）
  text-secondary: "#57534E"  # 落ち着いた補足テキスト（stone-600）
  text-tertiary: "#A8A29E"   # プレースホルダーや非活性テキスト（stone-400）
  
  # Accents & Brand (原色の青を避け、くすんだトーンで品を出す)
  brand-primary: "#292524"   # ボタン等のメインアクション（stone-800）
  brand-hover: "#44403C"     # ホバー時の柔らかな変化（stone-700）
  accent-muted: "#0D9488"    # リンクやハイライト用。落ち着いたティール（Teal）
  
  # Borders (AIっぽさを消すための極薄ライン)
  border-subtle: "#E7E5E4"   # 非常に控えめな区切り線（stone-200）

typography:
  # システムフォントを活用しつつ、行間を広く取って「読ませる」
  font-sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
  line-height-relaxed: "1.6" 

spacing:
  # 詰め込みすぎず、人間が息継ぎできる余白
  component-padding: "24px"
  section-margin: "64px"

radii:
  # 丸すぎず、尖りすぎない「人懐っこい」角丸
  base: "10px"
  card: "16px"
---

# ==========================================
# 2. Human-Centric Design Principles
# ==========================================

## Concept: "Tactile & Comfortable" (触覚的で心地よいUI)
このプロジェクトは、ユーザーに「ツールを使わされている」という圧迫感を与えないことを最優先する。
紙とインクのような自然なコントラスト、滑らかなインタラクション、そして十分な余白によって、長時間使用しても疲れない「心地よい空間」を構築すること。

## Layout & Whitespace (余白の美学)
- **Let it breathe:** 要素同士を密着させないこと。セクション間には最低でも `48px`（`gap-12` や `mt-12`）、可能なら `64px` の余白を取り、視覚的な休符を入れること。
- **Card Design:** カード要素に濃いドロップシャドウを適用してはならない。シャドウは `shadow-sm` 程度に留め、`border border-stone-200` と組み合わせることで、紙が1枚重なっているような繊細な表現にすること。

## Typography & Contrast (文字と階層)
- **No Pure Colors:** `#000` (純黒)、`#FFF` (純白)、`#00F` (純青) などの彩度/明度が極端なデジタルカラーを一切禁止する。
- 階層表現は、フォントサイズを大きくするだけでなく、「色の濃淡（text-primary / text-secondary）」を組み合わせて上品に差をつけること。

## Micro-Interactions (心地よい手触り)
- **Soft Transitions:** ホバーやフォーカス時の状態変化には、必ず `transition-all duration-200 ease-in-out` を付与し、フワッとした人間らしい滑らかな反応を実装すること。
- **Focus Rings:** フォームやボタンにフォーカスが当たった際は、原色の青いアウトラインではなく、`focus:ring-2 focus:ring-stone-400 focus:ring-offset-2` のような落ち着いたリングを表示すること。

## 🚫 AI Slop Prevention (AI特有のダサさの禁止)
- [ ] Tailwindのデフォルトの青（`blue-500` や `blue-600`）をメインカラーに使わないこと。
- [ ] 意味のないグラデーション（紫〜ピンクなど）を背景やボタンに配置しないこと。
- [ ] 情報を区切るために、むやみに太い線や濃いグレーの背景ブロックを多用しないこと。余白（Whitespace）を使って情報を区切るのが第一選択である。