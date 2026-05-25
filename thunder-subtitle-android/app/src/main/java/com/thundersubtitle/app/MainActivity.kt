package com.thundersubtitle.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var serverBar: TextView
    private var currentUrl: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(SetupActivity.PREFS_NAME, Context.MODE_PRIVATE)
        currentUrl = prefs.getString(SetupActivity.PREFS_KEY_SERVER_URL, null) ?: ""

        if (currentUrl.isBlank()) {
            // No URL configured, go back to setup
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(createLayout())

        setupServerBar()
        setupWebView()
        setupSwipeRefresh()
    }

    private fun createLayout(): FrameLayout {
        val root = FrameLayout(this)

        // Server address bar at the top
        serverBar = TextView(this).apply {
            id = android.R.id.text1
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(36)
            )
            gravity = android.view.Gravity.CENTER
            textSize = 12f
            setTextColor(0xFFAAAAAA.toInt())
            setBackgroundColor(0xCC000000.toInt())
            setPadding(dpToPx(12), 0, dpToPx(12), 0)
            isSingleLine = true
            ellipsize = android.text.TextUtils.TruncateAt.MARQUEE
            isSelected = true // enables marquee
        }

        // Swipe-to-refresh wrapper for WebView
        swipeRefresh = SwipeRefreshLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ).also {
                it.topMargin = dpToPx(36)
            }
            setColorSchemeResources(
                android.R.color.holo_blue_light,
                android.R.color.holo_green_light,
                android.R.color.holo_orange_light
            )
        }

        webView = WebView(this)

        root.addView(serverBar)
        swipeRefresh.addView(webView)
        root.addView(swipeRefresh)

        return root
    }

    private fun setupServerBar() {
        serverBar.text = getString(R.string.current_server, currentUrl)
        serverBar.setOnClickListener {
            SetupActivity().showModifyUrlDialog(this, currentUrl) {
                val newUrl = getSharedPreferences(
                    SetupActivity.PREFS_NAME, Context.MODE_PRIVATE
                ).getString(SetupActivity.PREFS_KEY_SERVER_URL, "") ?: ""
                if (newUrl != currentUrl) {
                    // URL changed, reload WebView
                    currentUrl = newUrl
                    serverBar.text = getString(R.string.current_server, currentUrl)
                    loadWebPage()
                }
            }
        }
        serverBar.setOnLongClickListener {
            // Long press also opens the modify dialog
            serverBar.performClick()
            true
        }
    }

    private fun setupWebView() {
        webView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = settings.userAgentString + " ThunderSubtitleAndroid"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedSslError(
                view: WebView,
                handler: SslErrorHandler,
                error: android.net.http.SslError
            ) {
                // Trust all SSL certificates (self-signed included)
                handler.proceed()
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                serverBar.text = getString(R.string.current_server, currentUrl)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                // Load all URLs inside the WebView
                return false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                swipeRefresh.isRefreshing = false

                // Only show toast for main frame errors
                if (request.isForMainFrame) {
                    Toast.makeText(
                        this@MainActivity,
                        R.string.network_error,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    swipeRefresh.isRefreshing = true
                }
            }
        }

        // Clear any cached data from previous sessions
        webView.clearCache(true)
        webView.clearHistory()

        loadWebPage()
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun loadWebPage() {
        if (currentUrl.isNotBlank()) {
            webView.loadUrl(currentUrl)
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        // Handle back button for WebView history navigation
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    override fun onDestroy() {
        // Clean up WebView to avoid memory leaks
        swipeRefresh.removeAllViews()
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }
}
