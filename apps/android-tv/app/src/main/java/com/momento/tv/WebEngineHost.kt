package com.momento.tv

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Shared setup for hosting the bundled web rendering engine (apps/tv-app)
 * in a WebView, used by both [MomentoDreamService] (the real screensaver)
 * and [PreviewActivity] (an in-app "see it before you enable it" preview
 * — also how this integration gets exercised/tested without waiting for
 * the system idle timeout or navigating into Settings).
 */
object WebEngineHost {
    private const val ENGINE_URL = "https://appassets.androidplatform.net/assets/web/index.html"

    @SuppressLint("SetJavaScriptEnabled")
    fun createView(context: Context): WebView {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()

        val view = WebView(context)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }
        view.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
        }
        view.loadUrl(ENGINE_URL)
        return view
    }

    fun teardown(view: WebView) {
        view.apply {
            loadUrl("about:blank")
            onPause()
            removeAllViews()
            destroy()
        }
    }
}
