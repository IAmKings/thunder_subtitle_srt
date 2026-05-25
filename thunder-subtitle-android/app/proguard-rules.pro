# ProGuard rules for Thunder Subtitle Android

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep all app classes
-keep class com.thundersubtitle.app.** { *; }

# Keep WebView
-dontwarn android.webkit.**
