import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Sync
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.momento.tv"
    // androidx.core 1.19.0 requires compiling against API 37+ (see AAR
    // metadata check). targetSdk is intentionally kept at 36 to match the
    // Google TV emulator system image actually available/tested against
    // (see docs/ARCHITECTURE.md) — compileSdk and targetSdk can differ.
    compileSdk = 37

    defaultConfig {
        applicationId = "com.momento.tv"
        // Android TV/Google TV devices in the wild skew older than phones;
        // 24 (Android 7.0) is a reasonably safe floor for a WebView-based
        // DreamService while still covering the vast majority of real
        // Android TV hardware.
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.0")
    // WebViewAssetLoader + WebViewClientCompat: lets the DreamService serve
    // the bundled web engine over a synthetic https:// origin instead of
    // file://, which is required for the ES module <script> tags in
    // apps/tv-app's build output to load correctly inside a WebView.
    // https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader
    implementation("androidx.webkit:webkit:1.17.0")
}

// --- Shared web engine integration --------------------------------------
// apps/tv-app is the shared HTML/CSS/JS rendering engine (see
// docs/ARCHITECTURE.md). These tasks build it and copy its output into
// this module's assets so MomentoDreamService can serve it from a WebView
// via WebViewAssetLoader. Requires Node/npm on PATH; run manually with
// `./gradlew :app:syncWebEngineAssets` if you just want to refresh assets
// without a full app build.
val webEngineDir = file("../../tv-app")

tasks.register<Exec>("buildWebEngine") {
    description = "Builds the shared web rendering engine (apps/tv-app)"
    workingDir = webEngineDir
    commandLine("npm", "run", "build")
}

tasks.register<Sync>("syncWebEngineAssets") {
    description = "Copies the built web engine into app/src/main/assets/web"
    dependsOn("buildWebEngine")
    from(webEngineDir.resolve("dist"))
    into(file("src/main/assets/web"))
}

tasks.named("preBuild") {
    dependsOn("syncWebEngineAssets")
}
