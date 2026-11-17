package dev.olamerea.session;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ResultReceiver;
import android.os.PersistableBundle;
import android.widget.ScrollView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private TextView status;
    private Button copy;
    private TextView preview;
    private String json;
    private int request;
    private boolean waiting;
    private boolean rootAvailable;
    private final Handler main = new Handler(Looper.getMainLooper());
    private static final long RETRY_MS = 750;
    private static final long TIMEOUT_MS = 15000;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(36, 42, 36, 36);
        TextView title = new TextView(this); title.setText("Ola Session Exporter"); title.setTextSize(24); title.setTypeface(null, Typeface.BOLD); root.addView(title);
        TextView instructions = new TextView(this);
        instructions.setText("1. Bật module trong Vector và chọn Ola.\n2. Bấm Lấy phiên: app tự mở Ola và lấy phiên Google đang đăng nhập.\n3. Bấm Copy JSON. Nếu Ola yêu cầu đăng nhập, hãy đăng nhập rồi trở lại đây và thử lại.\n\nJSON hiển thị bên dưới và có quyền đăng nhập tài khoản. Chỉ dán vào máy của bạn và giữ kín.");
        instructions.setTextSize(16); instructions.setPadding(0, 20, 0, 20); root.addView(instructions);
        Button open = new Button(this); open.setText("Mở Ola"); open.setOnClickListener(v -> {
            Intent i = getPackageManager().getLaunchIntentForPackage("com.olaachat");
            if (i == null) setStatus("Chưa cài Ola trong người dùng Android này."); else startActivity(i);
        }); root.addView(open);
        Button fetch = new Button(this); fetch.setText("Lấy phiên Google"); fetch.setOnClickListener(v -> requestSession()); root.addView(fetch);
        copy = new Button(this); copy.setText("Copy JSON"); copy.setEnabled(false); copy.setOnClickListener(v -> copySession()); root.addView(copy);
        status = new TextView(this); status.setTextSize(15); status.setPadding(0, 24, 0, 0); root.addView(status);
        preview = new TextView(this); preview.setTextIsSelectable(true); preview.setTextSize(13); preview.setPadding(0, 20, 0, 20); root.addView(preview);
        ScrollView scroll = new ScrollView(this); scroll.addView(root); setContentView(scroll);
    }
    private void setStatus(String s) { status.setText(s); }
    private void requestSession() {
        final int current = ++request;
        json = null; preview.setText(""); copy.setEnabled(false); waiting = true;
        Intent launch = getPackageManager().getLaunchIntentForPackage("com.olaachat");
        if (launch == null) {
            waiting = false; setStatus("Chưa cài Ola trong người dùng Android này."); return;
        }
        setStatus("Đang xin quyền root để tự quay lại…");
        // Ask while this activity is foreground so the root manager can show its dialog.
        new Thread(() -> {
            boolean granted = false;
            Process process = null;
            try {
                process = new ProcessBuilder("su", "-c", "test $(id -u) = 0")
                    .redirectErrorStream(true).redirectOutput(new java.io.File("/dev/null")).start();
                granted = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS) && process.exitValue() == 0;
            } catch (Exception ignored) { /* no root: export still works, return manually */ }
            finally { if (process != null) process.destroy(); }
            final boolean root = granted;
            main.post(() -> {
                if (current != request || !waiting || isFinishing() || isDestroyed()) return;
                rootAvailable = root;
                setStatus("Đang mở Ola và chờ phiên Google…");
                try { startActivity(launch); }
                catch (RuntimeException e) { waiting = false; setStatus("Không mở được Ola. Hãy mở Ola và thử lại."); return; }
                pollSession(current, android.os.SystemClock.elapsedRealtime() + TIMEOUT_MS);
            });
        }).start();
    }
    private void pollSession(int current, long deadline) {
        if (current != request || !waiting || isFinishing() || isDestroyed()) return;
        if (android.os.SystemClock.elapsedRealtime() >= deadline) {
            waiting = false;
            setStatus("Không lấy được phiên. Kiểm tra Ola đã đăng nhập Google và module đã bật trong Vector, rồi thử lại.");
            return;
        }
        final boolean[] answered = {false};
        ResultReceiver reply = new ResultReceiver(main) {
            @Override protected void onReceiveResult(int code, Bundle data) {
                if (current != request || !waiting || isFinishing() || isDestroyed() || answered[0]) return;
                answered[0] = true;
                if (code != 0 || data == null || data.getString("data") == null) return;
                try {
                    JSONObject value = new JSONObject(data.getString("data"));
                    if (!"ola-google-session".equals(value.optString("format"))) return;
                    json = value.toString(2); waiting = false;
                    preview.setText(json); copy.setEnabled(true);
                    String email = value.optString("email", "");
                    setStatus("Đã lấy phiên Google" + (email.isEmpty() ? "" : " của " + email) + ". Bấm Copy JSON.");
                    returnToExporter();
                } catch (Exception e) { /* Ola can be initialising; retry until timeout. */ }
            }
        };
        sendBroadcast(new Intent(SessionBridge.ACTION).setPackage("com.olaachat").putExtra("reply", reply));
        main.postDelayed(() -> pollSession(current, deadline), RETRY_MS);
    }
    /** Android blocks background activity launches on some devices. The phone is rooted;
     *  ask its root manager and return through Activity Manager without changing Ola data. */
    private void returnToExporter() {
        new Thread(() -> {
            boolean ok = false;
            try {
                if (!rootAvailable) throw new IllegalStateException();
                int userId = android.os.Process.myUid() / 100000;
                Process process = new ProcessBuilder("su", "-c", "am start --user " + userId
                    + " -n dev.olamerea.session/.MainActivity --activity-reorder-to-front")
                    .redirectErrorStream(true).redirectOutput(new java.io.File("/dev/null")).start();
                try { ok = process.waitFor(10, java.util.concurrent.TimeUnit.SECONDS) && process.exitValue() == 0; }
                finally { process.destroy(); }
            } catch (Exception ignored) { /* tell the user to return manually below */ }
            if (!ok) main.post(() -> {
                if (!isFinishing() && !isDestroyed()) setStatus("Đã lấy phiên. Hãy quay lại Ola Session Exporter để xem và copy JSON; cấp quyền root để tự quay lại.");
            });
        }).start();
    }
    private void copySession() {
        if (json == null) return;
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Ola Google session", json);
        if (Build.VERSION.SDK_INT >= 33) {
            PersistableBundle extras = new PersistableBundle();
            extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
            clip.getDescription().setExtras(extras);
        }
        clipboard.setPrimaryClip(clip);
        setStatus("Đã copy JSON. Dán vào máy của bạn; nội dung chứa quyền đăng nhập.");
    }
    @Override protected void onDestroy() {
        ++request; waiting = false; json = null;
        super.onDestroy();
    }
}
