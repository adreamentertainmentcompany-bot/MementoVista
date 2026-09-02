package com.momento.tv

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Minimal info screen. Momento's actual experience lives entirely inside
 * [MomentoDreamService] (the Daydream/screensaver) — this activity only
 * exists so the app shows something sensible if launched directly from
 * the home screen, and so the system Dream picker's "Settings" button
 * (see res/xml/momento_dream_info.xml) has somewhere to go: a shortcut
 * straight into the system's Screen Saver settings via the documented
 * public `Settings.ACTION_DREAM_SETTINGS` intent action.
 */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#100F0D"))
            setPadding(96, 96, 96, 96)
        }

        val title = TextView(this).apply {
            text = "Momento"
            textSize = 32f
            setTextColor(Color.parseColor("#F4EFE6"))
        }

        val body = TextView(this).apply {
            text = "Momento is a living wall of family photos and videos.\n\n" +
                "To turn it on, open your TV's Screen Saver settings and " +
                "choose Momento."
            textSize = 18f
            setTextColor(Color.parseColor("#CFC7B8"))
            setPadding(0, 32, 0, 48)
        }

        val previewButton = Button(this).apply {
            text = "Preview"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, PreviewActivity::class.java))
            }
        }

        val openSettingsButton = Button(this).apply {
            text = "Open Screen Saver Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_DREAM_SETTINGS))
            }
        }

        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        buttonRow.addView(previewButton)
        buttonRow.addView(
            openSettingsButton,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                marginStart = 24
            }
        )

        root.addView(title)
        root.addView(body)
        root.addView(buttonRow)

        setContentView(root)
    }
}
