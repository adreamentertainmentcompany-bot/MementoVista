// Top-level build file. Plugin versions are declared here (with `apply false`)
// and applied per-module in app/build.gradle.kts.
//
// Versions were pinned against what's actually current in Google's Maven
// and Maven Central at the time this was scaffolded (see comments below) —
// verified via each artifact's maven-metadata.xml rather than guessed, since
// Android Studio 2026.1 / AGP / Kotlin here are newer than any specific
// version numbers a static reference could reliably assume. If Android
// Studio's "AGP Upgrade Assistant" prompts you when you open this project,
// that's expected — go ahead and accept it.
plugins {
    id("com.android.application") version "9.4.0" apply false
    id("org.jetbrains.kotlin.android") version "2.4.10" apply false
}
