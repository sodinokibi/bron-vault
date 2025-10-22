"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Shield, AlertTriangle, Info, ExternalLink, Target, Network, Clock } from "lucide-react"
import Link from "next/link"

interface StealerMetadata {
  id: number
  device_id: string
  device_name: string
  stealer_family: string
  stealer_version?: string
  build_id?: string
  detection_confidence: number
  confidence_percentage: number
  indicators: string[]
  upload_date: string
  created_at: string
}

interface SimilarDevice {
  device_id: string
  device_name: string
  upload_date: string
  total_credentials: number
  stealer_version?: string
  detection_confidence: number
}

interface ThreatIntelligence {
  threat_level: string
  active_since: string
  primary_targets: string[]
  known_c2_infrastructure: string
  typical_distribution: string[]
  mitigation: string[]
  iocs: string[]
}

interface StealerAnalysisPanelProps {
  deviceId: string
}

export function StealerAnalysisPanel({ deviceId }: StealerAnalysisPanelProps) {
  const [metadata, setMetadata] = useState<StealerMetadata | null>(null)
  const [similarDevices, setSimilarDevices] = useState<SimilarDevice[]>([])
  const [threatIntel, setThreatIntel] = useState<ThreatIntelligence | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStealerMetadata()
  }, [deviceId])

  const loadStealerMetadata = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/devices/${deviceId}/stealer-metadata`)

      if (!response.ok) {
        if (response.status === 404) {
          setError("No stealer metadata available for this device")
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
        return
      }

      const data = await response.json()

      if (data.success) {
        setMetadata(data.metadata)
        setSimilarDevices(data.similar_devices || [])
        setThreatIntel(data.threat_intelligence)
      } else {
        setError(data.error || "Failed to load stealer metadata")
      }
    } catch (err) {
      console.error("Error loading stealer metadata:", err)
      setError("Failed to load stealer metadata")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading stealer analysis...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Metadata Available</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!metadata) {
    return null
  }

  const getThreatLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return "destructive"
      case "medium-high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getConfidenceColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-orange-600"
  }

  return (
    <div className="space-y-6">
      {/* Threat Level Alert */}
      {threatIntel && (
        <Alert variant={threatIntel.threat_level === "High" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {threatIntel.threat_level} Threat Level
            <Badge variant={getThreatLevelColor(threatIntel.threat_level)}>
              {metadata.stealer_family}
            </Badge>
          </AlertTitle>
          <AlertDescription>
            This device was compromised by {metadata.stealer_family} stealer malware.
            Immediate action is recommended.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Detection Information
            </CardTitle>
            <CardDescription>Malware identification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Stealer Family</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{metadata.stealer_family}</span>
                {metadata.stealer_version && (
                  <Badge variant="outline">v{metadata.stealer_version}</Badge>
                )}
              </div>
            </div>

            {metadata.build_id && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Build ID</div>
                <code className="text-sm bg-muted px-2 py-1 rounded">{metadata.build_id}</code>
              </div>
            )}

            <div>
              <div className="text-sm text-muted-foreground mb-1">Detection Confidence</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${metadata.confidence_percentage}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${getConfidenceColor(metadata.confidence_percentage)}`}>
                  {metadata.confidence_percentage}%
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Detection Indicators</div>
              <div className="space-y-1">
                {metadata.indicators.map((indicator, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {indicator}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Threat Intelligence */}
        {threatIntel && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Threat Intelligence
              </CardTitle>
              <CardDescription>Known information about this malware</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Active Since</div>
                <div className="text-sm">{threatIntel.active_since}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">Primary Targets</div>
                <div className="flex flex-wrap gap-1">
                  {threatIntel.primary_targets.map((target, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {target}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">C2 Infrastructure</div>
                <div className="text-sm">{threatIntel.known_c2_infrastructure}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">Distribution Methods</div>
                <div className="space-y-1">
                  {threatIntel.typical_distribution.map((method, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      {method}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Indicators of Compromise */}
      {threatIntel && threatIntel.iocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Indicators of Compromise (IOCs)
            </CardTitle>
            <CardDescription>Artifacts used to detect this malware</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {threatIntel.iocs.map((ioc, index) => (
                <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  {ioc}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mitigation Steps */}
      {threatIntel && threatIntel.mitigation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Recommended Mitigation Steps
            </CardTitle>
            <CardDescription>Actions to take for this compromise</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {threatIntel.mitigation.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-0.5">{step}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Similar Devices */}
      {similarDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Similar Devices ({similarDevices.length})
            </CardTitle>
            <CardDescription>
              Other devices compromised by {metadata.stealer_family}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {similarDevices.map((device) => (
                  <Link
                    key={device.device_id}
                    href={`/devices/${device.device_id}`}
                    className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{device.device_name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {device.total_credentials} credentials
                          {device.stealer_version && ` • v${device.stealer_version}`}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(device.upload_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {Math.round(device.detection_confidence * 100)}% confidence
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
