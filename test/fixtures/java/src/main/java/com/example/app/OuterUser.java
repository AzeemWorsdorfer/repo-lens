package com.example.app;

import com.example.nested.Outer.Inner;

public final class OuterUser {
    public Inner create() {
        return new Inner();
    }
}
