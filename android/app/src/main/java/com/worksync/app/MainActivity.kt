package com.worksync.app

import android.Manifest
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.*
import android.widget.Toast
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import java.io.OutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1001
    private val CAMERA_PERMISSION_REQUEST_CODE = 2001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize high-performance hardware accelerated WebView full screen
        webView = WebView(this)
        setContentView(webView)

        setupWebView()
        checkPermissions()
    }

    private fun setupWebView() {
        val settings = webView.settings

        // 1. Core JS, Storage & Local Offline Protocol Features
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        // Support zooming and scaling
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        // 2. High-performance WebView Asset Loader (runs local assets over a secure HTTPS mock origin)
        // This is crucial to bypass browser file protocol limits such as IndexedDB sandbox restrictions
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest
            ): WebResourceResponse? {
                // Map requests starting with web domain over HTTPS directly to local raw app assets
                val url = request.url
                if (url.host == "appassets.androidplatform.net") {
                    return assetLoader.shouldInterceptRequest(url)
                }
                return null
            }
        }

        // 3. Setup Custom Chrome Client for full camera stream granting and CSV files selector
        webView.webChromeClient = object : WebChromeClient() {

            // Overrides permissions granting inside WebView (crucial for local face attendance camera access)
            override fun onPermissionRequest(request: PermissionRequest) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val approvedResources = mutableListOf<String>()
                    for (res in request.resources) {
                        if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                            approvedResources.add(res)
                        }
                    }
                    if (approvedResources.isNotEmpty()) {
                        request.grant(approvedResources.toTypedArray())
                    } else {
                        request.deny()
                    }
                }
            }

            // Supports local file picking for CSV Upload / Employee CSV Imports
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    fileChooserParams?.createIntent()
                } else null

                try {
                    startActivityForResult(
                        intent ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" },
                        FILE_CHOOSER_REQUEST_CODE
                    )
                } catch (e: ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    Toast.makeText(this@MainActivity, "No File Chooser application found", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }
        }

        // 4. Custom Local Downloader with Base64 Interceptor (CSV Export functionality)
        // Resolves typical WebView blobs export blockages by parsing content and saving to device downloads
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            if (url.startsWith("data:")) {
                // Intercept Base64 export (such as Javascript CSV trigger)
                saveBase64FileToDownloads(url, mimetype)
            } else {
                try {
                    // Standard download request fallback
                    val request = DownloadManager.Request(Uri.parse(url)).apply {
                        setMimeType(mimetype)
                        addRequestHeader("User-Agent", userAgent)
                        setDescription("Downloading system file...")
                        val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                        setTitle(fileName)
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    }
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                    Toast.makeText(this, "Downloading file...", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Boot and load the bundled React application entry point via secure web context
        webView.loadUrl("https://appassets.androidplatform.net/www/index.html")
    }

    private fun checkPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                CAMERA_PERMISSION_REQUEST_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Permission granted, re-fire webview to gain feed
                webView.reload()
            } else {
                Toast.makeText(this, "Camera permission is required for face scanner recognition.", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Handles the response from standard Android file pickers
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return
            val results = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else null
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    // Custom data URI decoder allowing pure offline CSV file exports straight to device Downloads folder
    private fun saveBase64FileToDownloads(dataUri: String, mimeType: String) {
        try {
            val commaIndex = dataUri.indexOf(",")
            if (commaIndex == -1) return
            val base64Data = dataUri.substring(commaIndex + 1)
            val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)

            // Dynamic filename based on exported file type
            val extension = if (mimeType.contains("csv")) "csv" else "txt"
            val fileName = "WorkSync_Attendance_${System.currentTimeMillis()}.$extension"

            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, if (mimeType.isEmpty()) "text/csv" else mimeType)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
            }

            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                val outputStream: OutputStream? = contentResolver.openOutputStream(uri)
                outputStream?.use {
                    it.write(decodedBytes)
                    it.flush()
                }
                Toast.makeText(this, "Report exported: Saved to Downloads/$fileName", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this, "Error inserting into Downloads directory", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Base64 export failure: ${e.message}", e)
            Toast.makeText(this, "Failed to export report: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // Capture system back button to implement standard WebView navigation history
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
