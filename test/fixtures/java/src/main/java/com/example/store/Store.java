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

    // These main-shaped methods are not launchable Java entrypoints.
    public void main(String[] args) {}

    @Flags("public static")
    void main(String[] args) {}

    public static void main(String args[][]) {}

    public public static void main(String[] args) {}

    public static int main(int[] args) {
        return args.length;
    }
}
