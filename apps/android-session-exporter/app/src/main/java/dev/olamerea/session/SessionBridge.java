package dev.olamerea.session;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.ResultReceiver;
import android.provider.Settings;
import android.util.Base64;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** No credentials are logged or saved in Ola; only the signed companion can request them. */
final class SessionBridge {
    static final String ACTION = "dev.olamerea.session.EXPORT";
    static final String PERMISSION = "dev.olamerea.session.permission.EXPORT";
    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    static void register(Context context, ClassLoader loader) {
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent intent) {
                if (!ACTION.equals(intent.getAction())) return;
                ResultReceiver reply = intent.getParcelableExtra("reply");
                if (reply == null) return;
                Bundle out = new Bundle();
                try { out.putString("data", read(c, loader).toString()); reply.send(0, out); }
                catch (Throwable e) { android.util.Log.w("OlaSession", "Read failed: " + e.getClass().getSimpleName()); out.putString("error", "Không đọc được phiên Google. Mở Ola, đăng nhập Google rồi thử lại. Phiên bản hỗ trợ: 27.8.0."); reply.send(1, out); }
            }
        };
        IntentFilter filter = new IntentFilter(ACTION);
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, PERMISSION, null, Context.RECEIVER_EXPORTED);
        else context.registerReceiver(receiver, filter, PERMISSION, null);
    }
    private static Object field(Object target, String name) throws Exception {
        Field f = target.getClass().getField(name); return f.get(target);
    }
    static JSONObject read(Context c, ClassLoader loader) throws Exception {
        String version = c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        if (!"27.8.0".equals(version)) throw new IllegalStateException();
        Class<?> authClass = Class.forName("com.google.firebase.auth.FirebaseAuth", false, loader);
        Object auth = authClass.getMethod("getInstance").invoke(null);
        Object user = field(auth, "f");
        if (user == null) throw new IllegalStateException();
        Object tokenState = field(user, "a");
        JSONObject state = new JSONObject((String) tokenState.getClass().getMethod("zzf").invoke(tokenState));
        String idToken = state.getString("access_token");
        String[] jwt = idToken.split("\\.");
        if (jwt.length != 3) throw new IllegalStateException();
        JSONObject claims = new JSONObject(new String(Base64.decode(jwt[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING), StandardCharsets.UTF_8));
        if (!"olaachat".equals(claims.optString("aud")) || !"google.com".equals(claims.getJSONObject("firebase").optString("sign_in_provider"))) throw new IllegalStateException();
        String uid = claims.getString("sub"), email = claims.optString("email", "");
        if (email.isEmpty()) {
            Object provider = field(user, "b");
            if (provider != null) {
                for (Field candidate : provider.getClass().getFields()) {
                    if (candidate.getType() != String.class) continue;
                    Object value = candidate.get(provider);
                    if (value instanceof String && ((String) value).matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                        email = (String) value; break;
                    }
                }
            }
        }
        String device = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        String refresh = state.getString("refresh_token");
        if (uid.isEmpty() || device == null || device.isEmpty() || refresh.isEmpty()) throw new IllegalStateException();
        // Check the user and refresh token were not replaced during the read.
        if (field(auth, "f") != user || !state.getString("refresh_token").equals(new JSONObject((String) field(user, "a").getClass().getMethod("zzf").invoke(field(user, "a"))).getString("refresh_token"))) throw new IllegalStateException();
        return new JSONObject().put("format", "ola-google-session").put("version", 1)
                .put("projectId", "olaachat").put("provider", "google.com").put("uid", uid)
                .put("email", email).put("displayName", claims.optString("name", ""))
                .put("refreshToken", refresh).put("deviceId", device)
                .put("appVersion", version).put("androidVersion", Build.VERSION.RELEASE);
    }
}
