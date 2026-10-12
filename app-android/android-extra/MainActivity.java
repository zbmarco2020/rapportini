package it.codenotti.rapportini;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhatsappSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
