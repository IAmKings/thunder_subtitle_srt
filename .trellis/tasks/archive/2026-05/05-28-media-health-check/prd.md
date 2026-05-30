# 媒体库目录结构健康检查

## Goal

集成用户脚本 `check_thumb.py` 的检查逻辑，在扫描器页面提供可关闭的目录结构健康提示。设计可扩展的检查规则系统，方便不同用户自定义检查规则。

## 用户脚本分析

`check_thumb.py` 对每个电影目录做了 4 种检查：

| 检查 | 脚本行为 | 我们的实现 |
|------|---------|-----------|
| 缺少 `folder.jpg` + `landscape.jpg` | 打印缺失 → 继续 | 警告提示（只看不动） |
| 缺少 `backdrop*.jpg` | 打印缺失 → 继续 | 警告提示（只看不动） |
| 存在 `extrafanart/` 文件夹 | 自动删除 ❌ | **⚠️ 不能自动删** — 仅提示 |
| 存在 `thumb.jpg` | 自动删除 ❌ | **⚠️ 不能自动删** — 仅提示 |
| 同名字幕缺少 `.zh` 标识 | 自动重命名 ❌ | **⚠️ 不能自动改** — 仅提示 |

**关键改动**：脚本里有自动删除/重命名操作，集成到产品中时**默认改为纯检测模式**——只提示不操作。自动修复需要用户显式确认。

## 架构设计：可扩展检查规则

### 规则基类

```python
@dataclass
class CheckResult:
    level: str          # "ok" | "warning" | "error"
    path: str           # 电影目录路径
    message: str        # 中文提示

class BaseChecker(ABC):
    name: str           # 检查器名称
    description: str    # 描述

    @abstractmethod
    def check(self, movie_path: str) -> list[CheckResult]:
        """检查单个电影目录，返回问题列表"""
```

### 内置检查器（初次实现）

| 检查器 | 规则 |
|--------|------|
| `ImageAssetsChecker` | 检查 folder.jpg / landscape.jpg / backdrop*.jpg |
| `CleanupRemindersChecker` | 提示 extrafanart 文件夹和 thumb.jpg 可清理 |
| `SubtitleNamingChecker` | 检查同名字幕是否缺 .zh 前缀 |
| `NFOExistsChecker` | 检查 movie.nfo 是否存在 |

### 扩展方式

用户或社区可继承 `BaseChecker` 添加自定义规则，通过配置注册：

```python
# 内置的可通过 Web UI 勾选启/停
# 自定义的可放置到插件目录
```

## 设计决策

### 健康检查 ≠ 扫描：独立操作，互不干扰

健康检查是纯文件系统操作，不需要网络。与扫描的"仅预览"模式本质相同——都不联网、都不改文件、都只读目录结构。

**如果耦合到扫描流程**：4000 部电影 × 4 个检查器 × 3 次文件检查 = 每次扫描多 8-10 秒。不划算。

**独立按钮方案**：扫描和健康检查是两个独立操作，用户按需执行：

```
[扫描下载] [仅预览] [暴力下载] [暴力刷新]    ← 字幕扫描
[健康检查]                                    ← 独立按钮
```

点击"健康检查"→ 后端启动一个 light task，只跑文件系统检查，不触发任何网络请求。和仅预览扫描一样快。

### 展示位置

扫描器页面新增"健康检查"按钮，点击后：
- 后端创建健康检查任务（复用 scan_service 的任务机制）
- 结果以卡片列表展示：电影名 + 问题图标 + 详情
- 问题按严重度着色：⚠️ 黄色（缺 optional 文件）/ ❌ 红色（缺 NFO）
- 可手动关闭，不影响扫描结果

## 文件改动规划

| 文件 | 新增/改动 | 说明 |
|------|---------|------|
| `thunder-subtitle-py/src/health/__init__.py` | 新 | 检查器注册 + 调度 |
| `thunder-subtitle-py/src/health/base.py` | 新 | `BaseChecker` + `CheckResult` |
| `thunder-subtitle-py/src/health/checkers/image_assets.py` | 新 | 图片资源检查 |
| `thunder-subtitle-py/src/health/checkers/naming.py` | 新 | 字幕命名检查 |
| `thunder-subtitle-py/src/health/checkers/nfo.py` | 新 | NFO 检查 |
| `thunder-subtitle-py/src/health/checkers/cleanup.py` | 新 | 可清理文件提示 |
| `thunder-subtitle-api/app/services/health_service.py` | 新 | API 服务层 |
| `thunder-subtitle-api/app/api/health_check.py` | 新 | API 路由 |
| `thunder-subtitle-web/src/app/scanner/page.tsx` | 改 | 健康检查按钮 + 结果展示 |

## Acceptance Criteria

- [ ] 扫描器页面新增"健康检查"开关/按钮
- [ ] 检查结果以卡片展示，可按目录分组
- [ ] 缺失图片、缺失 NFO、字幕命名问题均能检测
- [ ] 所有检查仅检测不修改文件
- [ ] `BaseChecker` 可继承扩展
- `tsc --noEmit` 零错误 / `ruff check` 全绿

## Out of Scope

- 自动删除/重命名文件（仅提示不操作）
- 自定义规则 UI 编辑
- 社区插件系统
