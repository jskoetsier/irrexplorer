package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port               int
	Debug              bool
	DatabaseURL        string
	RedisURL           string
	IRRDEndpoint       string
	LookingGlassURL    string
	MinimumPrefixIPv4  int
	MinimumPrefixIPv6  int
	ImporterLastUpdate string
	AllowedOrigins     string
}

func Load() Config {
	return Config{
		Port:               intFromEnv("PORT", 8080),
		Debug:              boolFromEnv("DEBUG", false),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedisURL:           os.Getenv("REDIS_URL"),
		IRRDEndpoint:       os.Getenv("IRRD_ENDPOINT"),
		LookingGlassURL:    stringFromEnv("LOOKING_GLASS_URL", "https://lg.ring.nlnog.net"),
		MinimumPrefixIPv4:  intFromEnv("MINIMUM_PREFIX_SIZE_IPV4", 9),
		MinimumPrefixIPv6:  intFromEnv("MINIMUM_PREFIX_SIZE_IPV6", 29),
		ImporterLastUpdate: os.Getenv("IMPORTER_LAST_UPDATE"),
		AllowedOrigins:     stringFromEnv("ALLOWED_ORIGINS", "*"),
	}
}

func stringFromEnv(key, fallback string) string {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	return raw
}

func intFromEnv(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func boolFromEnv(key string, fallback bool) bool {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}
