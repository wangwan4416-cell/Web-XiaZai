# BugPk API 解析服务（后端备选，主流程走 Vercel API Routes 代理）
# 此文件作为独立部署 BugPk 实例时的解析逻辑预留


PLATFORM_MAP = {
    "douyin": "https://api.bugpk.com/douyin/?url={url}",
    "kuaishou": "https://api.bugpk.com/kuaishou/?url={url}",
    "bilibili": "https://api.bugpk.com/bilibili/?url={url}",
}
