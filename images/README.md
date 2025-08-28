# 画像フォルダ

このフォルダには、マインドマップで使用する画像ファイルを配置します。

## 推奨形式
- PNG（透過画像対応）
- JPG/JPEG（写真など）
- SVG（グラフやチャートなど）

## ファイル名の例
- `population-graph.png` - 人口推移グラフ
- `tourist-numbers.jpg` - 観光客数の写真
- `success-case-1.png` - 成功事例の画像

## 使用方法
data/kotohira-data.jsonで以下のように参照：
```json
"image": {
  "url": "images/population-graph.png",
  "alt": "人口推移グラフ",
  "caption": "出典：○○"
}
```