package com.example.app;

import com.example.model.*;
import /* store type */ com.example.store.Store;
import java.util.List;
import static com.example.model.Severity.*;

public final class Main {
    @SuppressWarnings("static")
    public static void main(final String... args) {
        Store store = new Store();
        store.add(HIGH);
        System.out.println(List.of(store.total()));
    }
}
