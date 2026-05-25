package com.thundersubtitle.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class SetupActivity : AppCompatActivity() {

    private lateinit var urlInput: EditText
    private lateinit var connectButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If a server URL is already configured, skip to MainActivity
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(PREFS_KEY_SERVER_URL, null)
        if (!savedUrl.isNullOrBlank()) {
            startMainActivityAndFinish()
            return
        }

        setContentView(R.layout.activity_setup)

        urlInput = findViewById(R.id.url_input)
        connectButton = findViewById(R.id.connect_button)

        connectButton.setOnClickListener {
            val url = urlInput.text.toString().trim()
            if (url.isBlank()) {
                Toast.makeText(this, getString(R.string.invalid_url), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val normalizedUrl = normalizeUrl(url)
            if (normalizedUrl == null) {
                Toast.makeText(this, getString(R.string.invalid_url), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            prefs.edit().putString(PREFS_KEY_SERVER_URL, normalizedUrl).apply()
            startMainActivityAndFinish()
        }
    }

    /**
     * Normalizes a server URL by ensuring it has a scheme.
     * Returns null if the URL is invalid.
     */
    private fun normalizeUrl(input: String): String? {
        var url = input.trim()

        // Add scheme if missing
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }

        // Remove trailing slash
        if (url.endsWith("/")) {
            url = url.removeSuffix("/")
        }

        // Basic validation: must contain a host
        return try {
            val parsed = java.net.URL(url)
            if (parsed.host.isNullOrBlank()) null else url
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Shows a dialog to modify the server URL (called from MainActivity).
     */
    fun showModifyUrlDialog(context: Context, currentUrl: String, onSaved: () -> Unit) {
        val input = EditText(context).apply {
            setText(currentUrl)
            hint = context.getString(R.string.server_url_hint)
        }

        AlertDialog.Builder(context)
            .setTitle(R.string.server_address_hint)
            .setView(input)
            .setPositiveButton(R.string.connect) { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotBlank()) {
                    val normalized = normalizeUrl(newUrl)
                    if (normalized != null) {
                        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit()
                            .putString(PREFS_KEY_SERVER_URL, normalized)
                            .apply()
                        onSaved()
                    } else {
                        Toast.makeText(context, R.string.invalid_url, Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun startMainActivityAndFinish() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    companion object {
        const val PREFS_NAME = "thunder_subtitle_prefs"
        const val PREFS_KEY_SERVER_URL = "server_url"
    }
}
