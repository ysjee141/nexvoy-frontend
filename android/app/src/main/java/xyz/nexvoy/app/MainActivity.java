package xyz.nexvoy.app;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "SafeArea";
    private int lastTop = -1, lastRight = -1, lastBottom = -1, lastLeft = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 앱이 인셋을 직접 처리하도록 프레임워크 자동 패딩 비활성화.
        // Android 15+에서 edge-to-edge가 강제되지만 Capacitor가 이 설정을 하지 않아
        // 인셋이 자식 뷰로 전달되지 않는 문제를 해결한다.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        setupSafeAreaInsets();
    }

    /**
     * WindowInsets를 읽어 --safe-area-inset-* CSS 변수를 WebView에 직접 주입한다.
     * setDecorFitsSystemWindows(false)로 인셋이 자식 뷰까지 전달되도록 한 뒤,
     * setOnApplyWindowInsetsListener로 값을 읽고 evaluateJavascript로 CSS 변수를 설정한다.
     */
    private void setupSafeAreaInsets() {
        WebView webView = getBridge().getWebView();
        View container = (View) webView.getParent();

        ViewCompat.setOnApplyWindowInsetsListener(container, (view, windowInsets) -> {
            applyInsets(webView, windowInsets);
            return windowInsets;
        });

        // 리스너 등록 후 인셋 디스패치를 강제로 요청
        container.requestApplyInsets();

        // 백업: 뷰 레이아웃 완료 후 직접 인셋을 읽어 주입
        container.post(() -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(container);
            if (insets != null) {
                applyInsets(webView, insets);
            } else {
                Log.w(TAG, "Insets not available yet, retrying in 300ms");
                container.postDelayed(() -> {
                    WindowInsetsCompat retry = ViewCompat.getRootWindowInsets(container);
                    if (retry != null) {
                        applyInsets(webView, retry);
                    } else {
                        Log.e(TAG, "Insets still not available after retry");
                    }
                }, 300);
            }
        });
    }

    private void applyInsets(WebView webView, WindowInsetsCompat windowInsets) {
        Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
        Insets displayCutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());

        int top = Math.max(systemBars.top, displayCutout.top);
        int right = Math.max(systemBars.right, displayCutout.right);
        int bottom = Math.max(systemBars.bottom, displayCutout.bottom);
        int left = Math.max(systemBars.left, displayCutout.left);

        // 값이 변경되지 않았으면 스킵
        if (top == lastTop && right == lastRight && bottom == lastBottom && left == lastLeft) {
            return;
        }
        lastTop = top;
        lastRight = right;
        lastBottom = bottom;
        lastLeft = left;

        float density = getResources().getDisplayMetrics().density;
        int topDp = Math.round(top / density);
        int rightDp = Math.round(right / density);
        int bottomDp = Math.round(bottom / density);
        int leftDp = Math.round(left / density);

        Log.d(TAG, String.format("Injecting: top=%d, right=%d, bottom=%d, left=%d (dp)", topDp, rightDp, bottomDp, leftDp));

        String js = String.format(Locale.US,
                "if(document.documentElement){"
                        + "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');"
                        + "}",
                topDp, rightDp, bottomDp, leftDp
        );

        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
