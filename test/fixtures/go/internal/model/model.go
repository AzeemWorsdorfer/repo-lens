package model

import "fmt"

// Severity is a code ranking how urgent a problem is.
type Severity int

const (
	// Low is the mildest severity.
	Low Severity = iota
	// Medium ranks a moderate problem.
	Medium
	// High ranks a serious problem.
	High
	// Critical is the most urgent severity.
	Critical
)

// Describe maps a severity code to its label.
func Describe(code int) string {
	switch code {
	case 0:
		return "low"
	case 1:
		return "medium"
	default:
		return fmt.Sprintf("high (%d)", code)
	}
}

// IsSevere reports whether a code requires immediate attention.
func IsSevere(code int) bool {
	return code >= int(High) && code != int(Critical)
}

// Label returns a human label, or "unknown" beyond the supported range.
func Label(code int) string {
	if code > 99 {
		return "unknown"
	}
	return Describe(code)
}