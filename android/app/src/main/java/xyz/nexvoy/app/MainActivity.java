package xyz.nexvoy.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupSafeAreaInsets();
    }

    /**
     * WindowInsets를 읽어 --safe-area-inset-* CSS 변수를 WebView에 직접 주입한다.
     *
     * Capacitor 내장 SystemBars 플러그인의 자동 CSS 주입은 onDOMReady() 타이밍 문제와
     * viewport-fit 감지 실패로 인해 불안정하므로, capacitor.config.ts에서
     * insetsHandling: 'disable'로 비활성화하고 여기서 직접 처리한다.
     */
    private void setupSafeAreaInsets() {
        WebView webView = getBridge().getWebView();
        View container = (View) webView.getParent();

        ViewCompat.setOnApplyWindowInsetsListener(container, (view, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets displayCutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());

            int top = Math.max(systemBars.top, displayCutout.top);
            int right = Math.max(systemBars.right, displayCutout.right);
            int bottom = Math.max(systemBars.bottom, displayCutout.bottom);
            int left = Math.max(systemBars.left, displayCutout.left);

            float density = getResources().getDisplayMetrics().density;
            String js = String.format(Locale.US,
                    "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');"
                            + "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');"
                            + "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');"
                            + "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');",
                    Math.round(top / density),
                    Math.round(right / density),
                    Math.round(bottom / density),
                    Math.round(left / density)
            );

            webView.post(() -> webView.evaluateJavascript(js, null));
            return windowInsets;
        });
    }
}
