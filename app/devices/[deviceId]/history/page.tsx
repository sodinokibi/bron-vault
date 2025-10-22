"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Globe, Search, Download, ExternalLink, Clock, TrendingUp } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"

interface BrowserHistoryItem {
  url: string
  title: string | null
  visit_count: number
  last_visit_time: number
  browser: string
  profile: string | null
}

export default function BrowserHistoryPage() {
  return (
    <AuthGuard>
      <BrowserHistoryContent />
    </AuthGuard>
  )
}

function BrowserHistoryContent() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.deviceId as string

  const [history, setHistory] = useState<BrowserHistoryItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<BrowserHistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [browserFilter, setBrowserFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("visit_count")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string>("")

  useEffect(() => {
    loadHistory()
  }, [deviceId])

  useEffect(() => {
    filterAndSortHistory()
  }, [searchQuery, browserFilter, sortBy, history])

  const loadHistory = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load device info
      const deviceResponse = await fetch(`/api/v1/devices/${deviceId}`)
      if (deviceResponse.ok) {
        const deviceData = await deviceResponse.json()
        setDeviceName(deviceData.device?.device_name || deviceId)
      }

      // Load browser history
      const historyResponse = await fetch(`/api/v1/devices/${deviceId}/history`)

      if (!historyResponse.ok) {
        throw new Error(`HTTP ${historyResponse.status}`)
      }

      const data = await historyResponse.json()

      if (data.success) {
        setHistory(data.browser_history || [])
        setFilteredHistory(data.browser_history || [])
      } else {
        setError(data.error || "Failed to load browser history")
      }
    } catch (err) {
      console.error("Error loading browser history:", err)
      setError("Failed to load browser history")
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortHistory = () => {
    let filtered = history

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((item) =>
        item.url.toLowerCase().includes(query) ||
        (item.title && item.title.toLowerCase().includes(query))
      )
    }

    // Browser filter
    if (browserFilter !== "all") {
      filtered = filtered.filter((item) => item.browser === browserFilter)
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "visit_count":
          return b.visit_count - a.visit_count
        case "recent":
          return b.last_visit_time - a.last_visit_time
        case "url":
          return a.url.localeCompare(b.url)
        default:
          return 0
      }
    })

    setFilteredHistory(filtered)
  }

  const exportToCSV = () => {
    const headers = ["URL", "Title", "Visit Count", "Last Visit", "Browser", "Profile"]
    const rows = filteredHistory.map((item) => [
      item.url,
      item.title || "",
      item.visit_count.toString(),
      new Date((item.last_visit_time - 11644473600000000) / 1000).toISOString(),
      item.browser,
      item.profile || ""
    ])

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `browser-history-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToTXT = () => {
    const lines = filteredHistory.map((item) =>
      `[${item.visit_count} visits] ${item.url}${item.title ? ` - ${item.title}` : ""}`
    )

    const txt = [
      `Browser History Export - Device: ${deviceName}`,
      `Generated: ${new Date().toISOString()}`,
      `Total URLs: ${filteredHistory.length}`,
      "",
      ...lines
    ].join("\n")

    const blob = new Blob([txt], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `browser-history-${deviceId}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  const formatDate = (chromeTimestamp: number): string => {
    // Convert Chrome timestamp (microseconds since 1601) to JS Date
    const unixTimestamp = (chromeTimestamp - 11644473600000000) / 1000
    return new Date(unixTimestamp).toLocaleString()
  }

  const uniqueBrowsers = Array.from(new Set(history.map((item) => item.browser)))
  const topDomains = Object.entries(
    filteredHistory.reduce((acc, item) => {
      const domain = extractDomain(item.url)
      acc[domain] = (acc[domain] || 0) + item.visit_count
      return acc
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading browser history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/devices/${deviceId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Browser History</h1>
          <p className="text-muted-foreground mt-1">
            {deviceName} - {filteredHistory.length} of {history.length} URLs
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{history.length}</div>
                <div className="text-sm text-muted-foreground">Total URLs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {history.reduce((sum, item) => sum + item.visit_count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Visits</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {new Set(history.map((item) => extractDomain(item.url))).size}
                </div>
                <div className="text-sm text-muted-foreground">Unique Domains</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{uniqueBrowsers.length}</div>
                <div className="text-sm text-muted-foreground">Browsers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Domains */}
      {topDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Most Visited Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDomains.map(([domain, count]) => (
                <div key={domain} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{domain}</span>
                  </div>
                  <Badge variant="secondary">{count} visits</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>History</CardTitle>
            <div className="flex gap-2">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={exportToTXT} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export TXT
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search URL or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={browserFilter} onValueChange={setBrowserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by browser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Browsers</SelectItem>
                {uniqueBrowsers.map((browser) => (
                  <SelectItem key={browser} value={browser}>
                    {browser}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visit_count">Most Visited</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="url">URL (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No browser history found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-[300px]">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate font-mono text-sm" title={item.url}>
                            {item.url}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate" title={item.title || undefined}>
                        {item.title || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.visit_count}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.last_visit_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.browser}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
    </div>
  )
}
