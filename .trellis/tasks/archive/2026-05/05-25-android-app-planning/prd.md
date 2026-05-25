# thunder-subtitle-android 安卓客户端（WebView）

## Goal

创建 Android WebView 壳工程，APK 安装即用，直连 Docker 后端。解决 PWA 自签名 HTTPS 无法安装的问题。

## Decision (ADR-lite)

**Context**: PWA 自签名 HTTPS + 局域网 IP 下 SW 被 Chrome 静默拒绝，安装提示永远不触发。
**Decision**: WebView 壳 — 原生 Android App 内嵌现有 Web UI，自签名证书可信任，安装即全屏。
**Consequences**: 1 天交付，零 API 改动，Web 端更新自动同步。

## Requirements

1. 启动页输入服务器地址（支持 HTTP/HTTPS + 端口）
2. WebView 加载 Web UI，全屏无地址栏
3. HTTPS 自签名证书自动信任（`onReceivedSslError` handler）
4. JWT token 存在 WebView localStorage，正常鉴权
5. 首页可配置/修改服务器地址
6. 图标使用正式 PNG

## 项目结构

```
thunder-subtitle-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/thundersubtitle/app/
│   │   │   ├── MainActivity.kt        # WebView 主界面
│   │   │   ├── SetupActivity.kt        # 首次配置服务器地址
│   │   │   └── ThunderSubtitleApp.kt   # Application 类
│   │   ├── res/
│   │   │   ├── values/strings.xml
│   │   │   └── mipmap-*/ic_launcher.png
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle/
```

## Acceptance Criteria

- [ ] APK 安装后首次启动显示服务器地址配置页
- [ ] 输入 HTTP 地址后正确加载 Web UI
- [ ] 输入 HTTPS 自签名地址后不报证书错误
- [ ] 所有 4 个页面功能正常（Search/Scanner/Verification/Settings）
- [ ] 可修改服务器地址（长按或设置入口）

## Out of Scope

- Jetpack Compose 重写
- Google Play 上架
- 原生通知
- 离线缓存
