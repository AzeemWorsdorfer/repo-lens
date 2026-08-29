package store

import "example.com/acme/internal/model"

// sumItems adds every severity code in items.
func sumItems(items []model.Severity) int {
	total := 0
	for _, item := range items {
		total += int(item)
	}
	return total
}