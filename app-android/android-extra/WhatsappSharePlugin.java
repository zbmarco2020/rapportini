package it.codenotti.rapportini;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** Passa il PDF del rapportino direttamente a WhatsApp (o WhatsApp Business). */
@CapacitorPlugin(name = "WhatsappShare")
public class WhatsappSharePlugin extends Plugin {

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("percorso del file mancante");
            return;
        }
        if (path.startsWith("file://")) {
            path = Uri.parse(path).getPath();
        }
        File file = new File(path);
        if (!file.exists()) {
            call.reject("file non trovato: " + path);
            return;
        }
        Uri uri;
        try {
            uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        } catch (Exception e) {
            call.reject("file non condivisibile: " + e.getMessage());
            return;
        }
        String[] app = { "com.whatsapp", "com.whatsapp.w4b" };
        for (String pkg : app) {
            if (!installata(pkg)) continue;
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setPackage(pkg);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try {
                getActivity().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("app", pkg);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("WhatsApp non avviato: " + e.getMessage());
            }
            return;
        }
        call.reject("WhatsApp non installato", "NO_WHATSAPP");
    }

    private boolean installata(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
