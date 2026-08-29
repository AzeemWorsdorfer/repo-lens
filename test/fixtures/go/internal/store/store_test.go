package store_test

import (
	"testing"

	"example.com/acme/internal/store"
)

// TestTotal checks that an empty store totals to zero.
func TestTotal(t *testing.T) {
	got := store.New().Total()
	if got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
}