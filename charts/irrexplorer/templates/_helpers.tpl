{{- define "irrexplorer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "irrexplorer.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "irrexplorer.name" . -}}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.labels" -}}
app.kubernetes.io/name: {{ include "irrexplorer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "irrexplorer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "irrexplorer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "irrexplorer.backendServiceName" -}}
irrexplorer-backend
{{- end -}}

{{- define "irrexplorer.frontendServiceName" -}}
{{ include "irrexplorer.fullname" . }}-frontend
{{- end -}}

{{- define "irrexplorer.goBackendServiceName" -}}
{{ include "irrexplorer.fullname" . }}-go-backend
{{- end -}}

{{- define "irrexplorer.postgresHost" -}}
{{- if .Values.postgres.enabled -}}
{{ include "irrexplorer.fullname" . }}-postgres
{{- else -}}
{{ required "externalDatabase.host is required when postgres.enabled=false" .Values.externalDatabase.host }}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.redisUrl" -}}
{{- if .Values.redis.enabled -}}
{{ printf "redis://%s-redis:6379/0" (include "irrexplorer.fullname" .) }}
{{- else -}}
{{ required "externalRedis.url is required when redis.enabled=false" .Values.externalRedis.url }}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.databaseName" -}}
{{- if .Values.postgres.enabled -}}
{{ .Values.postgres.database }}
{{- else -}}
{{ required "externalDatabase.database is required when postgres.enabled=false" .Values.externalDatabase.database }}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.databaseUser" -}}
{{- if .Values.postgres.enabled -}}
{{ .Values.postgres.username }}
{{- else -}}
{{ required "externalDatabase.username is required when postgres.enabled=false" .Values.externalDatabase.username }}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.databasePassword" -}}
{{- if .Values.postgres.enabled -}}
{{ .Values.postgres.password }}
{{- else -}}
{{ required "externalDatabase.password is required when postgres.enabled=false" .Values.externalDatabase.password }}
{{- end -}}
{{- end -}}

{{- define "irrexplorer.databaseUrl" -}}
{{ printf "postgresql://%s:%s@%s:%v/%s" (include "irrexplorer.databaseUser" .) (include "irrexplorer.databasePassword" .) (include "irrexplorer.postgresHost" .) (ternary 5432 .Values.externalDatabase.port .Values.postgres.enabled) (include "irrexplorer.databaseName" .) }}
{{- end -}}
