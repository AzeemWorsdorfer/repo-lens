package com.example.store;

import com.example.model.Severity;

public final class Store {
    private Severity severity;

    public void add(Severity severity) {
        this.severity = severity;
    }

    public int total() {
        return severity == null ? 0 : severity.ordinal();
    }
}
