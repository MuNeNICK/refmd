{{/*
Expand the name of the chart.
*/}}
{{- define "refmd.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "refmd.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "refmd.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "refmd.labels" -}}
helm.sh/chart: {{ include "refmd.chart" . }}
{{ include "refmd.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "refmd.selectorLabels" -}}
app.kubernetes.io/name: {{ include "refmd.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "refmd.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "refmd.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get the frontend URL
*/}}
{{- define "refmd.frontendUrl" -}}
{{- if .Values.global.externalUrl }}
{{- .Values.global.externalUrl }}
{{- else if .Values.ingress.enabled }}
{{- $host := (index .Values.ingress.hosts 0).host }}
{{- if .Values.ingress.tls }}https://{{ $host }}{{- else }}http://{{ $host }}{{- end }}
{{- else }}
{{- printf "http://localhost:%v" .Values.service.app.port }}
{{- end }}
{{- end }}

{{/*
Get the API URL
*/}}
{{- define "refmd.apiUrl" -}}
{{- if and .Values.global.separateUrls.enabled .Values.global.separateUrls.apiUrl }}
{{- .Values.global.separateUrls.apiUrl }}
{{- else if .Values.global.externalUrl }}
{{- printf "%s/api" .Values.global.externalUrl }}
{{- else if .Values.ingress.enabled }}
{{- $host := (index .Values.ingress.hosts 0).host }}
{{- if .Values.ingress.tls }}https://{{ $host }}/api{{- else }}http://{{ $host }}/api{{- end }}
{{- else }}
{{- printf "http://localhost:%v/api" .Values.service.api.port }}
{{- end }}
{{- end }}

{{/*
Get the WebSocket URL
*/}}
{{- define "refmd.socketUrl" -}}
{{- if and .Values.global.separateUrls.enabled .Values.global.separateUrls.socketUrl }}
{{- .Values.global.separateUrls.socketUrl }}
{{- else if .Values.global.externalUrl }}
{{- .Values.global.externalUrl }}
{{- else if .Values.ingress.enabled }}
{{- $host := (index .Values.ingress.hosts 0).host }}
{{- if .Values.ingress.tls }}https://{{ $host }}{{- else }}http://{{ $host }}{{- end }}
{{- else }}
{{- printf "http://localhost:%v" .Values.service.api.port }}
{{- end }}
{{- end }}

{{/*
Get the site URL
*/}}
{{- define "refmd.siteUrl" -}}
{{- include "refmd.frontendUrl" . }}
{{- end }}

{{/*
App labels
*/}}
{{- define "refmd.app.labels" -}}
{{ include "refmd.labels" . }}
app.kubernetes.io/component: app
{{- end }}