package dev.olamerea.session;

import android.app.Application;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import de.robv.android.xposed.IXposedHookLoadPackage;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

/** Vector calls this entry only inside the scoped Ola process. */
public final class Entry implements IXposedHookLoadPackage {
    @Override public void handleLoadPackage(XC_LoadPackage.LoadPackageParam p) {
        if (!"com.olaachat".equals(p.packageName) || !p.packageName.equals(p.processName)) return;
        Handler handler = new Handler(Looper.getMainLooper());
        handler.post(new Runnable() {
            int tries;
            @Override public void run() {
                try {
                    Application app = (Application) Class.forName("android.app.ActivityThread")
                            .getMethod("currentApplication").invoke(null);
                    if (app == null) {
                        if (++tries < 120) handler.postDelayed(this, 500);
                    } else SessionBridge.register(app, app.getClassLoader());
                } catch (Throwable e) { Log.w("OlaSession", "Bridge unavailable: " + e.getClass().getSimpleName()); }
            }
        });
    }
}
