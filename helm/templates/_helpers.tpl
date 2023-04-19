{{/*
Expand the name of the chart.
*/}}
{{- define "arstotzka.name" -}}
{{- default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
