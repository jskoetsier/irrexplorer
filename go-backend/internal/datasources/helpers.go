package datasources

func ToAnySlice(value any) []any {
	return toAnySlice(value)
}

func toAnySlice(value any) []any {
	if items, ok := value.([]any); ok {
		return items
	}
	return []any{}
}
