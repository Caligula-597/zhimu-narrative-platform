# 勿将本目录作为 Railway Root Directory

生产部署使用仓库根的 **`deploy/Dockerfile.fullstack`**（见 `../railway.toml`）。

若 Railway Build 的 Root Directory 设为 `backend`，会使用本目录的 `Dockerfile`（**仅 API**），`https://getzhimu.com/` 会返回 JSON 404。

正确设置见 [docs/ops/MANUAL_SETUP_CHECKLIST.md](../docs/ops/MANUAL_SETUP_CHECKLIST.md)。
