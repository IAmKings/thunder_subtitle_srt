/**
 * Internationalization (i18n) support for Thunder Subtitle Web UI.
 * Supports English and Chinese translations.
 */

import { useCallback } from "react";
import { useLanguage } from "@/components/ThemeProvider";

type Language = "en" | "zh";

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    title: "Thunder Subtitle",
    subtitle: "Subtitle Manager",

    // Scanner
    library_path: "Library Path",
    total_files: "Total Files",
    items: "items",
    active_jellyfin_scan: "Active Jellyfin Scan",
    sync_desc: "Syncing metadata and identifying missing subtitle tracks",
    scan_now: "SCAN NOW",
    scanning: "Scanning",
    recent_findings: "Recent Findings",
    all_status: "All Status",
    media_file: "Media File",
    type: "Type",
    action: "Action",
    files: "files",

    // Verification
    pending_verification: "Pending Verification",
    untagged: "Untagged",
    match: "Chinese Ratio",
    size: "Size",
    off_sync: "Off-sync",
    wrong_lang: "Wrong Language",
    confirm_verification: "Confirm Verification",
    play_pause: "Play/Pause",
    mark_correct: "Mark Correct",
    confirm: "Confirm",

    // Search
    find_perfect: "Find the perfect translation",
    search_desc: "Access millions of subtitles for movies and TV shows in over 50 languages.",
    search_placeholder: "Search for movies, TV series, or documentaries...",
    search_btn: "SEARCH",
    recent_searches: "Recent Searches",
    clear: "Clear",
    top_results: "Top Results",
    filter: "Filter",
    sort_relevance: "Relevance",
    sort_newest: "Newest",
    sort_score: "Score",
    score_label: "Score",
    download: "DOWNLOAD",
    load_more: "LOAD MORE RESULTS",
    lang_52: "52 Languages",
    lang_desc: "Our community translates content into more than fifty regional languages daily.",
    instant_sync: "Instant Sync",
    sync_feature_desc: "One-click download and automatic synchronization with your local media library.",
    verified_only: "Verified Only",
    verified_desc: "All uploads are scanned for malicious scripts and formatted for readability.",

    // Mobile Nav
    nav_search: "Search",
    nav_scanner: "Scanner",
    nav_verification: "Verification",
    nav_settings: "Settings",

    // Auth
    logged_in_as: "Logged in as",
    logout: "Sign Out",
    search_failed: "Search failed. Please try again.",

    // Settings
    system_settings: "System Settings",
    settings_desc: "Configure your media integration and subtitle automation workflows.",
    general: "General",
    save_path: "Default Save Path",
    save_path_hint: "Empty = download subtitles to current directory",
    save_path_placeholder: "Leave empty to download to current directory",
    lang_priority: "Preferred Groups",
    subtitle_sources: "Subtitle Sources",
    configure: "Configure",
    automation: "Automation",
    auto_scan: "Auto-scan Library",
    auto_scan_desc: "Automatically scan new media for missing subtitles every 6 hours.",
    auto_download: "Auto-download",
    auto_download_desc: "Download best-match subtitles without manual approval.",
    cleanup_orphans: "Cleanup Orphan Subs",
    cleanup_desc: "Remove subtitle files if the main media file is deleted.",
    notify_success: "Notify on Success",
    notify_desc: "Send a push notification when a batch download completes.",
    reset_defaults: "Reset to Defaults",
    save_changes: "Save Changes",

    // Common
    refresh: "Refresh",
    loading: "Loading...",
    cancel: "Cancel",
    starting: "Starting...",
    no_directories: "No directories configured",
    scan_progress: "Scan in progress... Results will appear here.",
    no_results_scan: 'No scan results yet. Click "Scan Now" to start scanning your media library.',
    view: "View",
    change_password: "Change Password",
    current_password: "Current Password",
    new_password: "New Password",
    confirm_password: "Confirm New Password",
    advanced_settings: "Advanced Settings",
    media_paths: "Media Paths",
    api_timeout: "API Timeout (seconds)",
    download_timeout: "Download Timeout (seconds)",
    chunk_size: "Chunk Size (bytes)",
    rate_limit: "Rate Limit (seconds)",
    retry_count: "Retry Count",
    retry_delay: "Retry Delay (seconds)",
    password_mismatch: "Passwords do not match",
    password_length: "Password must be at least 4 characters",
    configuration_saved: "Configuration saved successfully",
    configuration_reset: "Configuration reset to defaults",
    review_list_error: "Failed to load reviews",
    mark_error: "Failed to mark review",
    format_encoding_short: "Encoding",
    reviewing: "Reviewing",

    // Scanner (additional)
    failed_load_dirs: "Failed to load media directories",
    failed_start_scan: "Failed to start scan",
    failed_cancel_task: "Failed to cancel task",
    x_results: "{x} results",
    edit_paths: "Edit Paths",
    save_paths: "Save Paths",
    cancel_edit: "Cancel",
    filter_placeholder: "Filter keywords, e.g. Star Wars",
    failed_save_paths: "Failed to save paths",

    // Scan result statuses
    status_downloaded: "Downloaded",
    status_skipped: "Skipped",
    status_no_match: "No Match",
    status_error: "Error",
    scan_results: "Scan Results",
    subtitle_file: "Subtitle File",
    reason: "Reason",

    // Scan mode labels
    scan_mode_scan: "Scan",
    scan_mode_dry_run: "Preview",
    scan_mode_dump: "Dump",
    scan_mode_force: "Force Dump",
    dry_state: "State",
    dry_need_download: "Need Download",
    dry_need_review: "Need Review",
    dry_reviewed_ok: "Reviewed OK",
    dry_reviewed_fail: "Reviewed FAIL",
    dry_reviewed_fail_new_subs: "Re-review",

    // Dry-state filter labels (shorter, for filter buttons)
    dry_state_need_download: "Need Download",
    dry_state_need_review: "Need Review",
    dry_state_reviewed_ok: "Reviewed OK",
    dry_state_reviewed_fail: "Reviewed FAIL",
    dry_state_reviewed_fail_new_subs: "New Subs",
    dry_state_skipped: "Skipped",

    // Verification (additional)
    loading_reviews: "Loading reviews...",
    no_pending_subs: "No subtitles pending verification in this directory.",
    no_media_dirs_settings: "No media directories configured. Add paths in Settings.",
    run_scan_first: "Run a scan first to populate this list.",
    no_file_selected: "No file selected",
    unknown_encoding: "unknown encoding",
    select_file_panel: "Select a file from the left panel",
    chinese_content_ratio: "Chinese content ratio:",
    quality_score: "Quality score:",
    subtitle_preview_here: "Subtitle content preview will appear here",

    // Verification — dialog / action translations
    delete_unselected: "Delete Unselected",
    delete_all: "Delete All",
    mark_all_fail: "Mark All Fail",
    mark_all_fail_confirm: "Mark all subtitles for this movie as FAIL without deleting files? .rejected records will be updated for incremental re-download.",
    confirm_delete: "Confirm Delete",
    irreversible: "This action cannot be undone.",
    delete: "Delete",
    rename: "Rename",
    current: "Current:",
    pin: "Pin",
    unpin: "Unpin",
    delete_subtitle_file: "Delete subtitle file",
    delete_failed: "Delete failed",
    rename_failed: "Rename failed",
    delete_all_subs: "Delete All Subtitles",
    keep: "Keep",

    // Settings (additional)
    failed_load_config: "Failed to load configuration",
    failed_save_config: "Failed to save configuration",
    failed_reset_config: "Failed to reset configuration",
    failed_change_password: "Failed to change password",
    password_changed: "Password changed successfully",
    xunlei_subtitle_api: "Xunlei Subtitle API",
    active_default_source: "Active \u2022 Default Source",
    changing: "Changing...",

    // Scanner — path toggle (was hardcoded Chinese)
    path_enabled: "Enabled",
    path_disabled: "Disabled",

    // Scanner — carousel scroll remaining
    scroll_remaining: "{x} pages",

    // Search — duration / empty (was hardcoded English)
    unknown_duration: "Unknown duration",
    no_results_try_again: "No subtitles found. Try a different keyword or adjust filters.",

    // Search — filter labels (were hardcoded English strings)
    filter_mode_all: "All",
    filter_mode_chinese_only: "Chinese Only",
    filter_mode_chinese_first: "Chinese First",

    // Health Check
    health_check: "Health Check",
    health_check_desc: "Check media library directory structure integrity",
    health_check_running: "Checking...",
    health_check_results: "Health Check Results",
    health_check_warning: "Warning",
    health_check_info: "Info",
    health_check_error: "Error",
    health_check_no_issues: "No issues found",
    health_check_failed: "Health check failed",
    health_check_collapse: "Collapse",
    health_check_expand: "Expand",
  },
  zh: {
    // Nav
    title: "\u96f7\u9706\u5b57\u5e55",
    subtitle: "\u5b57\u5e55\u7ba1\u7406\u5668",

    // Scanner
    library_path: "\u5e93\u8def\u5f84",
    total_files: "\u6587\u4ef6\u603b\u6570",
    items: "\u4e2a\u9879\u76ee",
    active_jellyfin_scan: "\u6d3b\u8dc3\u7684 Jellyfin \u626b\u63cf",
    sync_desc: "\u6b63\u5728\u540c\u6b65\u5143\u6570\u636e\u5e76\u8bc6\u522b\u7f3a\u5931\u7684\u5b57\u5e55\u8f68\u9053",
    scan_now: "\u7acb\u5373\u626b\u63cf",
    scanning: "\u626b\u63cf\u4e2d",
    recent_findings: "\u6700\u8fd1\u53d1\u73b0",
    all_status: "\u6240\u6709\u72b6\u6001",
    media_file: "\u5a92\u4f53\u6587\u4ef6",
    type: "\u7c7b\u578b",
    action: "\u64cd\u4f5c",
    files: "个文件",

    // Verification
    pending_verification: "\u7b49\u5f85\u9a8c\u8bc1",
    untagged: "\u672a\u6807\u8bb0",
    match: "中文占比",
    size: "大小",
    off_sync: "\u97f3\u753b\u4e0d\u540c\u6b65",
    wrong_lang: "\u8bed\u8a00\u9519\u8bef",
    confirm_verification: "\u786e\u8ba4\u9a8c\u8bc1",
    play_pause: "\u64ad\u653e/\u6682\u505c",
    mark_correct: "\u6807\u8bb0\u4e3a\u6b63\u786e",
    confirm: "\u786e\u8ba4",

    // Search
    find_perfect: "\u5bfb\u627e\u5b8c\u7f8e\u7684\u7ffb\u8bd1",
    search_desc: "\u8bbf\u95ee\u8d85\u8fc7 50 \u79cd\u8bed\u8a00\u7684\u6570\u767e\u4e07\u4e2a\u7535\u5f71\u548c\u7535\u89c6\u8282\u76ee\u5b57\u5e55\u3002",
    search_placeholder: "\u641c\u7d22\u7535\u5f71\u3001\u7535\u89c6\u5267\u6216\u7eaa\u5f55\u7247...",
    search_btn: "\u641c\u7d22",
    recent_searches: "\u6700\u8fd1\u641c\u7d22",
    clear: "\u6e05\u9664",
    top_results: "\u70ed\u95e8\u7ed3\u679c",
    filter: "\u7b5b\u9009",
    sort_relevance: "\u76f8\u5173\u5ea6",
    sort_newest: "\u6700\u65b0",
    sort_score: "\u8bc4\u5206",
    score_label: "\u8bc4\u5206",
    download: "\u4e0b\u8f7d",
    load_more: "\u52a0\u8f7d\u66f4\u591a\u7ed3\u679c",
    lang_52: "52 \u79cd\u8bed\u8a00",
    lang_desc: "\u6211\u4eec\u7684\u793e\u533a\u6bcf\u5929\u63d0\u4f9b\u4e94\u5341\u591a\u79cd\u5730\u533a\u8bed\u8a00\u7684\u7ffb\u8bd1\u5185\u5bb9\u3002",
    instant_sync: "\u5373\u65f6\u540c\u6b65",
    sync_feature_desc: "\u4e00\u952e\u4e0b\u8f7d\u5e76\u81ea\u52a8\u4e0e\u60a8\u7684\u672c\u5730\u5a92\u4f53\u5e93\u540c\u6b65\u3002",
    verified_only: "\u4ec5\u9650\u9a8c\u8bc1",
    verified_desc: "\u6240\u6709\u4e0a\u4f20\u5185\u5bb9\u90fd\u4f1a\u7ecf\u8fc7\u6076\u610f\u811a\u672c\u626b\u63cf\u5e76\u8fdb\u884c\u683c\u5f0f\u5316\u4ee5\u63d0\u9ad8\u53ef\u8bfb\u6027\u3002",

    // Mobile Nav
    nav_search: "\u641c\u7d22",
    nav_scanner: "\u626b\u63cf",
    nav_verification: "\u5ba1\u6838",
    nav_settings: "\u8bbe\u7f6e",

    // Auth
    logged_in_as: "\u5f53\u524d\u767b\u5f55",
    logout: "\u9000\u51fa\u767b\u5f55",
    search_failed: "\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002",

    // Settings
    system_settings: "\u7cfb\u7edf\u8bbe\u7f6e",
    settings_desc: "\u914d\u7f6e\u60a8\u7684\u5a92\u4f53\u96c6\u6210\u548c\u5b57\u5e55\u81ea\u52a8\u5316\u5de5\u4f5c\u6d41\u7a0b\u3002",
    general: "\u5e38\u89c4",
    save_path: "\u9ed8\u8ba4\u4fdd\u5b58\u8def\u5f84",
    save_path_hint: "留空则字幕下载到当前工作目录",
    save_path_placeholder: "留空则下载到当前目录",
    lang_priority: "字幕组偏好",
    subtitle_sources: "\u5b57\u5e55\u6765\u6e90",
    configure: "\u914d\u7f6e",
    automation: "\u81ea\u52a8\u5316",
    auto_scan: "\u81ea\u52a8\u626b\u63cf\u5e93",
    auto_scan_desc: "\u6bcf 6 \u5c0f\u65f6\u81ea\u52a8\u626b\u63cf\u65b0\u5a92\u4f53\u662f\u5426\u7f3a\u5931\u5b57\u5e55\u3002",
    auto_download: "\u81ea\u52a8\u4e0b\u8f7d",
    auto_download_desc: "\u65e0\u9700\u624b\u52a8\u6279\u51c6\u5373\u53ef\u4e0b\u8f7d\u6700\u4f73\u5339\u914d\u5b57\u5e55\u3002",
    cleanup_orphans: "\u6e05\u7406\u5b64\u7acb\u5b57\u5e55",
    cleanup_desc: "\u5982\u679c\u5220\u9664\u4e3b\u5a92\u4f53\u6587\u4ef6\uff0c\u5219\u5220\u9664\u5b57\u5e55\u6587\u4ef6\u3002",
    notify_success: "\u6210\u529f\u65f6\u901a\u77e5",
    notify_desc: "\u5f53\u6279\u91cf\u4e0b\u8f7d\u5b8c\u6210\u65f6\u53d1\u9001\u63a8\u9001\u901a\u77e5\u3002",
    reset_defaults: "\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e",
    save_changes: "\u4fdd\u5b58\u66f4\u6539",

    // Common
    refresh: "\u5237\u65b0",
    loading: "\u52a0\u8f7d\u4e2d...",
    cancel: "\u53d6\u6d88",
    starting: "\u542f\u52a8\u4e2d...",
    no_directories: "\u672a\u914d\u7f6e\u76ee\u5f55",
    scan_progress: "\u626b\u63cf\u8fdb\u884c\u4e2d\uff0c\u7ed3\u679c\u5c06\u5728\u6b64\u663e\u793a\u3002",
    no_results_scan: "\u5c1a\u65e0\u626b\u63cf\u7ed3\u679c\uff0c\u70b9\u51fb\u201c\u7acb\u5373\u626b\u63cf\u201d\u5f00\u59cb\u626b\u63cf\u5a92\u4f53\u5e93\u3002",
    view: "\u67e5\u770b",
    change_password: "\u4fee\u6539\u5bc6\u7801",
    current_password: "\u5f53\u524d\u5bc6\u7801",
    new_password: "\u65b0\u5bc6\u7801",
    confirm_password: "\u786e\u8ba4\u65b0\u5bc6\u7801",
    advanced_settings: "\u9ad8\u7ea7\u8bbe\u7f6e",
    media_paths: "\u5a92\u4f53\u8def\u5f84",
    api_timeout: "API \u8d85\u65f6\uff08\u79d2\uff09",
    download_timeout: "\u4e0b\u8f7d\u8d85\u65f6\uff08\u79d2\uff09",
    chunk_size: "\u5206\u5757\u5927\u5c0f\uff08\u5b57\u8282\uff09",
    rate_limit: "\u901f\u7387\u9650\u5236\uff08\u79d2\uff09",
    retry_count: "\u91cd\u8bd5\u6b21\u6570",
    retry_delay: "\u91cd\u8bd5\u5ef6\u8fdf\uff08\u79d2\uff09",
    password_mismatch: "\u4e24\u6b21\u5bc6\u7801\u4e0d\u4e00\u81f4",
    password_length: "\u5bc6\u7801\u81f3\u5c11\u9700\u8981 4 \u4e2a\u5b57\u7b26",
    configuration_saved: "\u914d\u7f6e\u5df2\u4fdd\u5b58",
    configuration_reset: "\u914d\u7f6e\u5df2\u91cd\u7f6e\u4e3a\u9ed8\u8ba4\u503c",
    review_list_error: "\u52a0\u8f7d\u5ba1\u67e5\u5217\u8868\u5931\u8d25",
    mark_error: "\u6807\u8bb0\u5ba1\u67e5\u7ed3\u679c\u5931\u8d25",
    format_encoding_short: "编码",
    reviewing: "审核中",

    // Scanner (additional)
    failed_load_dirs: "\u52a0\u8f7d\u5a92\u4f53\u76ee\u5f55\u5931\u8d25",
    failed_start_scan: "\u542f\u52a8\u626b\u63cf\u5931\u8d25",
    failed_cancel_task: "\u53d6\u6d88\u4efb\u52a1\u5931\u8d25",
    x_results: "{x} \u4e2a\u7ed3\u679c",
    edit_paths: "编辑路径",
    save_paths: "保存路径",
    cancel_edit: "取消",
    filter_placeholder: "关键词过滤，如：星球大战",
    failed_save_paths: "保存路径失败",

    // Scan result statuses
    status_downloaded: "已下载",
    status_skipped: "已跳过",
    status_no_match: "无匹配",
    status_error: "错误",
    scan_results: "扫描结果",
    subtitle_file: "字幕文件",
    reason: "原因",

    // Scan mode labels
    scan_mode_scan: "扫描下载",
    scan_mode_dry_run: "仅预览",
    scan_mode_dump: "暴力下载",
    scan_mode_force: "暴力刷新",
    dry_state: "状态",
    dry_need_download: "需下载",
    dry_need_review: "待审查",
    dry_reviewed_ok: "审查通过",
    dry_reviewed_fail: "审查失败",
    dry_reviewed_fail_new_subs: "待重审",

    // Dry-state filter labels (shorter, for filter buttons)
    dry_state_need_download: "需下载",
    dry_state_need_review: "待审查",
    dry_state_reviewed_ok: "已通过",
    dry_state_reviewed_fail: "已失败",
    dry_state_reviewed_fail_new_subs: "有新字幕",
    dry_state_skipped: "已跳过",

    // Verification (additional)
    loading_reviews: "\u52a0\u8f7d\u5ba1\u67e5\u5217\u8868\u4e2d...",
    no_pending_subs: "\u8be5\u76ee\u5f55\u4e0b\u6ca1\u6709\u5f85\u9a8c\u8bc1\u7684\u5b57\u5e55\u3002",
    no_media_dirs_settings: "\u672a\u914d\u7f6e\u5a92\u4f53\u76ee\u5f55\uff0c\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u6dfb\u52a0\u8def\u5f84\u3002",
    run_scan_first: "\u8bf7\u5148\u8fd0\u884c\u626b\u63cf\u4ee5\u586b\u5145\u6b64\u5217\u8868\u3002",
    no_file_selected: "\u672a\u9009\u62e9\u6587\u4ef6",
    unknown_encoding: "\u672a\u77e5\u7f16\u7801",
    select_file_panel: "\u4ece\u5de6\u4fa7\u9762\u677f\u9009\u62e9\u6587\u4ef6",
    chinese_content_ratio: "\u4e2d\u6587\u5185\u5bb9\u6bd4\u4f8b\uff1a",
    quality_score: "\u8d28\u91cf\u8bc4\u5206\uff1a",
    subtitle_preview_here: "字幕内容预览将在此显示",

    // Verification — dialog / action translations
    delete_unselected: "删除未选中",
    delete_all: "全部删除",
    mark_all_fail: "全部失败",
    mark_all_fail_confirm: "确定将此电影所有字幕标记为失败（不删除文件）？.rejected 记录将更新以便下次增量下载。",
    confirm_delete: "确认删除",
    irreversible: "此操作不可撤销。",
    delete: "删除",
    rename: "重命名",
    current: "当前：",
    pin: "固定",
    unpin: "取消固定",
    delete_subtitle_file: "删除字幕文件",
    delete_failed: "删除失败",
    rename_failed: "重命名失败",
    delete_all_subs: "删除全部字幕",
    keep: "保留",

    // Settings (additional)
    failed_load_config: "\u52a0\u8f7d\u914d\u7f6e\u5931\u8d25",
    failed_save_config: "\u4fdd\u5b58\u914d\u7f6e\u5931\u8d25",
    failed_reset_config: "\u91cd\u7f6e\u914d\u7f6e\u5931\u8d25",
    failed_change_password: "\u4fee\u6539\u5bc6\u7801\u5931\u8d25",
    password_changed: "\u5bc6\u7801\u4fee\u6539\u6210\u529f",
    xunlei_subtitle_api: "\u8fc5\u96f7\u5b57\u5e55 API",
    active_default_source: "\u6d3b\u8dc3 \u2022 \u9ed8\u8ba4\u6765\u6e90",
    changing: "\u4fee\u6539\u4e2d...",

    // Scanner — path toggle (was hardcoded Chinese)
    path_enabled: "\u5df2\u542f\u7528",
    path_disabled: "\u5df2\u7981\u7528",

    // Scanner — carousel scroll remaining
    scroll_remaining: "\u5269 {x} \u9875",

    // Search — duration / empty (was hardcoded English)
    unknown_duration: "\u672a\u77e5\u65f6\u957f",
    no_results_try_again: "\u672a\u627e\u5230\u5b57\u5e55\uff0c\u8bf7\u5c1d\u8bd5\u5176\u4ed6\u5173\u952e\u8bcd\u6216\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u3002",

    // Search — filter labels (were hardcoded English strings)
    filter_mode_all: "\u5168\u90e8",
    filter_mode_chinese_only: "\u4ec5\u4e2d\u6587",
    filter_mode_chinese_first: "\u4e2d\u6587\u4f18\u5148",

    // Health Check
    health_check: "\u5065\u5eb7\u68c0\u67e5",
    health_check_desc: "\u68c0\u67e5\u5a92\u4f53\u5e93\u76ee\u5f55\u7ed3\u6784\u5b8c\u6574\u6027",
    health_check_running: "\u68c0\u67e5\u4e2d...",
    health_check_results: "\u5065\u5eb7\u68c0\u67e5\u7ed3\u679c",
    health_check_warning: "\u8b66\u544a",
    health_check_info: "\u63d0\u793a",
    health_check_error: "\u9519\u8bef",
    health_check_no_issues: "\u672a\u53d1\u73b0\u95ee\u9898",
    health_check_failed: "\u5065\u5eb7\u68c0\u67e5\u5931\u8d25",
    health_check_collapse: "\u6298\u53e0",
    health_check_expand: "\u5c55\u5f00",
  },
};

export type TranslationKey = keyof typeof translations.en;

export function useTranslations() {
  const { language } = useLanguage();

  const t = useCallback(
    (key: keyof typeof translations.zh): string => {
      const dict = translations[language as Language] ?? translations.en;
      return dict[key] ?? key;
    },
    [language]
  );

  return t;
}

export { translations };
export type { Language };
