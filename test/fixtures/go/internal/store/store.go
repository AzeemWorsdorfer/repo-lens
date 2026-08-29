package store

import (
	"errors"

	"github.com/google/uuid"

	"example.com/acme/internal/model"
)

var ErrEmpty = errors.New("store is empty")

// Store keeps a list of severity codes and knows how to total them.
type Store struct {
	items []model.Severity
}

// New creates an empty store.
func New() *Store {
	return &Store{}
}

// Add appends a severity code to the store.
func (s *Store) Add(item model.Severity) {
	s.items = append(s.items, item)
}

// Total sums the severity codes currently in the store.
func (s *Store) Total() int {
	return sumItems(s.items)
}

// NextID issues a unique identifier for an order.
func NextID() string {
	return uuid.NewString()
}