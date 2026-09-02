package com.momento.tv

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView

/**
 * Full-screen in-app preview of the Momento wall, using the exact same
 * [WebEngineHost] setup as [MomentoDreamService]. Lets a user (or a
 * developer testing without waiting for the system idle timeout / a
 * signed-in Google account gating Settings > Ambient Screensaver) see
 * the real thing immediately from [MainActivity]. Press Back to return.
 */
class PreviewActivity : Activity() {
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()
        val view = WebEngineHost.createView(this)
        webView = view
        setContentView(view)
    }

    override fun onDestroy() {
        webView?.let(WebEngineHost::teardown)
        webView = null
        super.onDestroy()
    }
}
