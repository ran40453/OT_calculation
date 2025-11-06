# OT_calculation

這是我的加班薪資計算小工具，部署在 GitHub Pages：

🔗 [https://ran40453.github.io/OT_calculation/](https://ran40453.github.io/OT_calculation/)

---

## 🧭 更新網站流程（用 VS Code + GitHub）

每次修改完任何檔案（例如 `main.js`, `style.css`, `index.html`）後，執行以下指令即可更新線上版本：

```bash
git add .
git commit -m "update: 說明修改內容"
git push
```

GitHub Pages 會自動重新部署，大約 30 秒～1 分鐘更新完成。

重新整理頁面即可看到最新版本。

---

## 🛠 初次設定（只需做一次）

若在新電腦或環境中第一次設定專案，可使用以下指令重新連接 GitHub：

```bash
git init
git remote add origin https://github.com/ran40453/OT_calculation.git
git branch -M main
```

---

## 📂 專案結構

```
OT_calculation/
├── index.html      # 主頁面
├── style.css       # 樣式設定
├── main.js         # 主程式邏輯
└── overtime.csv    # 匯入/匯出資料
```

---

## ✅ 快速連結

- 專案 GitHub：<https://github.com/ran40453/OT_calculation>
- 線上頁面：<https://ran40453.github.io/OT_calculation/>