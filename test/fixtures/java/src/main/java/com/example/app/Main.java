package com.example.app;

import com.example.model.Severity;
import com.example.store.Store;
import java.util.List;

public final class Main {
    public static void main(String[] args) {
        Store store = new Store();
        store.add(Severity.HIGH);
        System.out.println(List.of(store.total()));
    }
}
