package com.example.app;

import com.example.uppercase.UpperCase;
import static com.example.model.Severity.HIGH;

public final class SeverityPrinter {
    public Severity print() {
        return HIGH;
    }

    public UpperCase uppercase() {
        return new UpperCase();
    }
}
