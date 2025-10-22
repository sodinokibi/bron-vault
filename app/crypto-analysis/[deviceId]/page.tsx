"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Wallet,
  TrendingUp,
  Globe,
  Shield,
  Package,
  Activity,
  ArrowLeft,
  Download,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Coins,
  BarChart3
} from "lucide-react"
import { toast } from "sonner"

interface CryptoAnalysis {
  device_id: string
  device_name: string
  upload_date: string
  stats: {
    total_wallets: number
    unique_wallet_types: number
    wallets_with_keys: number
    unique_blockchains: number
    total_crypto_history: number
    total_crypto_sessions: number
    total_crypto_software: number
    crypto_activity_score: number
  }
  wallets: {
    all: any[]
    by_type: Record<string, any[]>
    by_blockchain: Record<string, any[]>
    by_name: Record<string, any[]>
    by_seed: Record<string, any[]>
    summary: any[]
  }
  hd_wallets: {
    seed_groups: Array<{
      seed_id: string
      count: number
      wallet_software: string
      blockchains: string[]
      addresses: Array<{
        address: string
        blockchain: string
        derivation_path: string
        address_index: number
      }>
      has_keys: boolean
    }>
    stats: {
      total_seed_groups: number
      total_hd_addresses: number
      seeds_with_multiple_addresses: number
      max_addresses_per_seed: number
      wallet_software_detected: number
    }
  }
  crypto_history: {
    all: any[]
    by_category: Record<string, any[]>
    top_sites: Array<{ domain: string; visits: number; category: string }>
  }
  crypto_sessions: any[]
  crypto_software: any[]
}

export default function CryptoAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.deviceId as string

  const [analysis, setAnalysis] = useState<CryptoAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSensitiveData, setShowSensitiveData] = useState(false)

  useEffect(() => {
    if (deviceId) {
      fetchAnalysis()
    }
  }, [deviceId])

  const fetchAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/crypto/analysis/${deviceId}`)
      const data = await response.json()

      if (data.success) {
        setAnalysis(data)
      } else {
        toast.error(data.error || "Failed to load crypto analysis")
      }
    } catch (error) {
      console.error("Error fetching crypto analysis:", error)
      toast.error("Error loading crypto analysis")
    } finally {
      setLoading(false)
    }
  }

  const getActivityLevelColor = (score: number) => {
    if (score >= 70) return "text-red-500"
    if (score >= 40) return "text-orange-500"
    if (score >= 20) return "text-yellow-500"
    return "text-green-500"
  }

  const getActivityLevelBadge = (score: number) => {
    if (score >= 70) return { label: "Very High", variant: "destructive" as const }
    if (score >= 40) return { label: "High", variant: "default" as const }
    if (score >= 20) return { label: "Medium", variant: "secondary" as const }
    return { label: "Low", variant: "outline" as const }
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = Object.keys(data[0])
    const csv = [
      headers.join(","),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header]
          if (value === null || value === undefined) return ""
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`
          }
          return value
        }).join(",")
      )
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Exchange: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      DeFi: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      NFT: "bg-pink-500/10 text-pink-500 border-pink-500/20",
      Explorer: "bg-green-500/10 text-green-500 border-green-500/20",
      Wallet: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Other: "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
    return colors[category] || colors.Other
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading crypto analysis...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load crypto analysis</AlertDescription>
        </Alert>
      </div>
    )
  }

  const activityBadge = getActivityLevelBadge(analysis.stats.crypto_activity_score)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push(`/devices/${deviceId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Device
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Coins className="h-8 w-8 text-orange-500" />
              Crypto Analysis
            </h1>
            <p className="text-muted-foreground mt-1">
              {analysis.device_name} - {new Date(analysis.upload_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge variant={activityBadge.variant} className="text-lg py-2 px-4">
          Activity: {activityBadge.label} ({analysis.stats.crypto_activity_score}/100)
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.total_wallets}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.stats.wallets_with_keys} with keys/seeds
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crypto History</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.total_crypto_history}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.crypto_history.top_sites.length} unique sites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.total_crypto_sessions}</div>
            <p className="text-xs text-muted-foreground">Crypto platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crypto Software</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.total_crypto_software}</div>
            <p className="text-xs text-muted-foreground">Installed programs</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Crypto Activity Score
          </CardTitle>
          <CardDescription>
            Composite score based on wallets, history, sessions, and software
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Activity Level</span>
              <span className={`text-2xl font-bold ${getActivityLevelColor(analysis.stats.crypto_activity_score)}`}>
                {analysis.stats.crypto_activity_score}/100
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  analysis.stats.crypto_activity_score >= 70 ? "bg-red-500" :
                  analysis.stats.crypto_activity_score >= 40 ? "bg-orange-500" :
                  analysis.stats.crypto_activity_score >= 20 ? "bg-yellow-500" :
                  "bg-green-500"
                }`}
                style={{ width: `${analysis.stats.crypto_activity_score}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{analysis.stats.unique_wallet_types}</div>
                <div className="text-xs text-muted-foreground">Wallet Types</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{analysis.stats.unique_blockchains}</div>
                <div className="text-xs text-muted-foreground">Blockchains</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Object.keys(analysis.crypto_history.by_category).length}
                </div>
                <div className="text-xs text-muted-foreground">Activity Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {((analysis.stats.wallets_with_keys / Math.max(analysis.stats.total_wallets, 1)) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Wallets with Keys</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="wallets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wallets">
            Wallets ({analysis.stats.total_wallets})
          </TabsTrigger>
          <TabsTrigger value="hd-wallets">
            HD Wallets ({analysis.hd_wallets?.stats.total_seed_groups || 0})
          </TabsTrigger>
          <TabsTrigger value="history">
            Browser History ({analysis.stats.total_crypto_history})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            Sessions ({analysis.stats.total_crypto_sessions})
          </TabsTrigger>
          <TabsTrigger value="software">
            Software ({analysis.stats.total_crypto_software})
          </TabsTrigger>
          <TabsTrigger value="breakdown">
            Breakdown
          </TabsTrigger>
        </TabsList>

        {/* Wallets Tab */}
        <TabsContent value="wallets">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Crypto Wallets</CardTitle>
                  <CardDescription>
                    Detected wallet extensions, desktop wallets, and addresses
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSensitiveData(!showSensitiveData)}
                  >
                    {showSensitiveData ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showSensitiveData ? "Hide" : "Show"} Sensitive Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(analysis.wallets.all, "crypto-wallets")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {analysis.stats.wallets_with_keys > 0 && (
                <Alert className="mb-4 border-red-500/20 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-500">
                    <strong>Critical:</strong> {analysis.stats.wallets_with_keys} wallet(s) contain private keys or seed phrases
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Blockchain</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead>File Path</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.wallets.all.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No wallets detected
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysis.wallets.all.map((wallet, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-orange-500" />
                              {wallet.wallet_name || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{wallet.wallet_type.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>
                            {wallet.blockchain ? (
                              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                {wallet.blockchain}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">
                            {showSensitiveData ? wallet.address || "—" : wallet.address ? "••••••••" : "—"}
                          </TableCell>
                          <TableCell>
                            {wallet.has_private_key || wallet.has_seed_phrase ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <Key className="h-3 w-3" />
                                Has Keys
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                <CheckCircle className="h-3 w-3" />
                                Address Only
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                            {wallet.file_path}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HD Wallets Tab */}
        <TabsContent value="hd-wallets">
          <div className="space-y-4">
            {/* HD Wallet Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>HD Wallet Analysis</CardTitle>
                <CardDescription>
                  Hierarchical Deterministic wallet detection - Identifies "side wallets" derived from same seed phrase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysis.hd_wallets?.stats.total_seed_groups || 0}</div>
                    <div className="text-xs text-muted-foreground">Unique Seeds</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysis.hd_wallets?.stats.seeds_with_multiple_addresses || 0}</div>
                    <div className="text-xs text-muted-foreground">Seeds with Side Wallets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysis.hd_wallets?.stats.total_hd_addresses || 0}</div>
                    <div className="text-xs text-muted-foreground">Total HD Addresses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysis.hd_wallets?.stats.max_addresses_per_seed || 0}</div>
                    <div className="text-xs text-muted-foreground">Max per Seed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysis.hd_wallets?.stats.wallet_software_detected || 0}</div>
                    <div className="text-xs text-muted-foreground">Wallets Identified</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seed Groups */}
            {analysis.hd_wallets?.seed_groups && analysis.hd_wallets.seed_groups.length > 0 ? (
              analysis.hd_wallets.seed_groups.map((group, idx) => (
                <Card key={group.seed_id} className={group.has_keys ? "border-red-500/50" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5" />
                          Seed Group #{idx + 1}
                          {group.has_keys && (
                            <Badge variant="destructive" className="ml-2">
                              <Key className="h-3 w-3 mr-1" />
                              Has Keys
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs">{group.seed_id.substring(0, 16)}...</span>
                          <Badge variant="outline">{group.wallet_software}</Badge>
                          <Badge variant="secondary">{group.count} {group.count === 1 ? 'address' : 'addresses'}</Badge>
                          {group.blockchains.map(chain => (
                            <Badge key={chain} className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              {chain}
                            </Badge>
                          ))}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Index</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Blockchain</TableHead>
                            <TableHead>Derivation Path</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.addresses.map((addr, addrIdx) => (
                            <TableRow key={addrIdx}>
                              <TableCell className="font-mono">{addr.address_index ?? '—'}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {showSensitiveData ? addr.address : (addr.address ? `${addr.address.substring(0, 8)}...${addr.address.substring(addr.address.length - 6)}` : '—')}
                              </TableCell>
                              <TableCell>
                                {addr.blockchain ? (
                                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                    {addr.blockchain}
                                  </Badge>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {addr.derivation_path || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    {group.count > 1 && (
                      <Alert className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Side Wallets Detected:</strong> This seed phrase controls {group.count} different addresses.
                          All of these addresses can be accessed with the same seed phrase.
                          {group.has_keys && " The seed phrase or private keys were found in the device data."}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No HD wallet groups detected</p>
                    <p className="text-sm mt-2">
                      HD wallet detection requires seed phrases or derivation paths to be present
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Browser History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Crypto-Related Browser History</CardTitle>
                  <CardDescription>
                    Visits to exchanges, DeFi platforms, NFT markets, and explorers
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(analysis.crypto_history.all, "crypto-history")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {Object.entries(analysis.crypto_history.by_category).map(([category, items]) => (
                  <Card key={category}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Badge className={getCategoryColor(category)}>
                          {category}
                        </Badge>
                        <div className="text-2xl font-bold mt-2">{items.length}</div>
                        <div className="text-xs text-muted-foreground">visits</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Visits</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.crypto_history.all.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No crypto-related history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysis.crypto_history.all.slice(0, 100).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="max-w-[300px] truncate font-mono text-xs">
                            {item.url}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.title || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getCategoryColor(item.category)}>
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.visit_count}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{item.browser}</span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(item.url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Crypto Sessions</CardTitle>
              <CardDescription>Authenticated sessions on crypto platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.crypto_sessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No active crypto sessions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysis.crypto_sessions.map((session, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{session.service}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {session.account_identifier || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.browser}</Badge>
                          </TableCell>
                          <TableCell>
                            {session.session_valid ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                Valid
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                                Expired
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {session.expires_at ? new Date(session.expires_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Software Tab */}
        <TabsContent value="software">
          <Card>
            <CardHeader>
              <CardTitle>Crypto-Related Software</CardTitle>
              <CardDescription>Installed programs related to cryptocurrency</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Install Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.crypto_software.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No crypto software detected
                        </TableCell>
                      </TableRow>
                    ) : (
                      analysis.crypto_software.map((software, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-500" />
                              {software.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{software.version || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">
                            {software.install_location || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Wallets by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analysis.wallets.by_type).map(([type, wallets]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{type.replace("_", " ")}</span>
                      <Badge variant="secondary">{wallets.length}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Wallets by Blockchain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analysis.wallets.by_blockchain).map(([blockchain, wallets]) => (
                    <div key={blockchain} className="flex items-center justify-between">
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        {blockchain}
                      </Badge>
                      <Badge variant="secondary">{wallets.length}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Visited Crypto Sites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {analysis.crypto_history.top_sites.map((site, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm font-medium">{index + 1}.</span>
                          <span className="text-sm truncate">{site.domain}</span>
                          <Badge variant="outline" className={`${getCategoryColor(site.category)} ml-2`}>
                            {site.category}
                          </Badge>
                        </div>
                        <Badge variant="secondary">{site.visits} visits</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Detected Wallet Software
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {Object.entries(analysis.wallets.by_name).map(([name, wallets]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <Badge variant="secondary">{wallets.length}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
