package com.momento.tv

import android.service.dreams.DreamService
import android.webkit.WebView

/**
 * Momento's Daydream screensaver — the real, public, third-party
 * screensaver extension point on Android/Google TV (see
 * docs/ARCHITECTURE.md §1 for why this doesn't exist on Tizen/webOS).
 *
 * This hosts the shared HTML/CSS/JS rendering engine (apps/tv-app) inside
 * a full-screen WebView (see [WebEngineHost]) rather than a native
 * rewrite — the fast path to validate the whole Daydream approach by
 * reusing the engine that's already built and tested. See
 * docs/ARCHITECTURE.md for the native Compose-for-TV rewrite this could
 * graduate to later if WebView performance isn't sufficient on real
 * hardware.
 *
 * Non-interactive by default (DreamService's default `isInteractive`),
 * meaning any remote input wakes and tears down the dream automatically —
 * no custom key handling needed here.
 */
class MomentoDreamService : DreamService() {

    private var webView: WebView? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()

        isFullscreen = true
        isScreenBright = true

        val view = WebEngineHost.createView(this)
        webView = view
        setContentView(view)
    }

    override fun onDetachedFromWindow() {
        webView?.let(WebEngineHost::teardown)
        webView = null
        super.onDetachedFromWindow()
    }
}
