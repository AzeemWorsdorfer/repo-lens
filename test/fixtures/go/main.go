package main

import (
	"fmt"

	"example.com/acme/internal/model"
	"example.com/acme/internal/store"
)

func main() {
	items := store.New()
	items.Add(model.High)

	fmt.Println(items.Total())
}