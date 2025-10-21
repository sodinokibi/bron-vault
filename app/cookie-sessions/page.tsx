"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Mail,
  Users,
  ShoppingCart,
  DollarSign,
  Bitcoin,
  Gamepad2,
  Code,
  Film,
  Cloud,
  Cookie,
  Check,
  X,
  AlertTriangle,
  TrendingUp
} from "lucide-react"

interface GlobalStats {
  total_sessions: number
  total_devices_with_sessions: number
  valid_sessions: number
  by_category: Record<string, number>
  by_service: Record<string, number>
  high_value_count: number
}

interface HighValueSession {
  id: number
  device_id: string
  service: string
  service_category: string
  account_identifier: string | null
  session_valid: boolean
  expires_at: string | null
  browser: string | null
  device_name?: string
}

export default function CookieSessionsPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [highValueSessions, setHighValueSessions] = useState<HighValueSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        fetch("/api/v1/cookie-sessions/stats/global"),
        fetch("/api/v1/cookie-sessions/high-value")
      ])

      const statsData = await statsRes.json()
      const sessionsData = await sessionsRes.json()

      if (statsData.success) {
        setStats(statsData.stats)
      }

      if (sessionsData.success) {
        setHighValueSessions(sessionsData.sessions)
      }
    } catch (error) {
      console.error("Error fetching cookie session data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, any> = {
      email: Mail,
      social: Users,
      ecommerce: ShoppingCart,
      financial: DollarSign,
      crypto: Bitcoin,
      gaming: Gamepad2,
      development: Code,
      streaming: Film,
      cloud: Cloud,
    }
    const IconComponent = iconMap[category] || Cookie
    return <IconComponent className="h-4 w-4" />
  }

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      social: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      ecommerce: "bg-green-500/10 text-green-500 border-green-500/20",
      financial: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      crypto: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      gaming: "bg-pink-500/10 text-pink-500 border-pink-500/20",
      development: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
      streaming: "bg-red-500/10 text-red-500 border-red-500/20",
      cloud: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    }
    return colorMap[category] || "bg-gray-500/10 text-gray-500 border-gray-500/20"
  }

  const formatExpiresAt = (expiresAt: string | null) => {
    if (!expiresAt) return "N/A"
    const date = new Date(expiresAt)
    const now = new Date()

    if (date < now) {
      return "Expired"
    }

    const diffMs = date.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffDays < 1) {
      const diffHours = diffMs / (1000 * 60 * 60)
      return `${diffHours.toFixed(0)}h`
    } else if (diffDays < 30) {
      return `${diffDays.toFixed(0)}d`
    } else {
      const diffMonths = diffDays / 30
      return `${diffMonths.toFixed(0)}mo`
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-bron-text-muted">Loading cookie sessions...</div>
        </div>
      </div>
    )
  }

  const totalServices = stats ? Object.keys(stats.by_service).length : 0
  const validPercentage = stats && stats.total_sessions > 0
    ? ((stats.valid_sessions / stats.total_sessions) * 100).toFixed(1)
    : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-bron-text-primary flex items-center gap-2">
            <Cookie className="h-8 w-8 text-bron-accent-yellow" />
            Cookie Sessions
          </h1>
          <p className="text-bron-text-muted mt-1">
            Authenticated sessions detected from browser cookies
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Total Sessions
            </CardTitle>
            <Cookie className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {stats?.total_sessions || 0}
            </div>
            <p className="text-xs text-bron-text-muted">
              {stats?.valid_sessions || 0} valid sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Devices
            </CardTitle>
            <Users className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {stats?.total_devices_with_sessions || 0}
            </div>
            <p className="text-xs text-bron-text-muted">
              with cookie sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              High-Value
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-bron-accent-red" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {stats?.high_value_count || 0}
            </div>
            <p className="text-xs text-bron-text-muted">
              email, finance, crypto, cloud
            </p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Services
            </CardTitle>
            <Code className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {totalServices}
            </div>
            <p className="text-xs text-bron-text-muted">
              platforms detected
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader>
            <CardTitle className="text-bron-text-primary">Sessions by Category</CardTitle>
            <CardDescription className="text-bron-text-muted">
              Distribution across service types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {stats && Object.entries(stats.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm text-bron-text-primary capitalize">
                        {category}
                      </span>
                    </div>
                    <Badge variant="outline" className={getCategoryColor(category)}>
                      {count}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader>
            <CardTitle className="text-bron-text-primary">Top Services</CardTitle>
            <CardDescription className="text-bron-text-muted">
              Most detected platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {stats && Object.entries(stats.by_service)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([service, count]) => (
                    <div key={service} className="flex items-center justify-between py-2 border-b border-bron-border last:border-0">
                      <span className="text-sm text-bron-text-primary font-medium">
                        {service}
                      </span>
                      <Badge variant="secondary" className="bg-bron-bg-tertiary text-bron-text-primary">
                        {count}
                      </Badge>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-bron-bg-secondary border-bron-border">
        <CardHeader>
          <CardTitle className="text-bron-text-primary">Session Quality</CardTitle>
          <CardDescription className="text-bron-text-muted">
            Validation and expiration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {stats?.valid_sessions || 0}
                </div>
                <div className="text-xs text-bron-text-muted">Valid ({validPercentage}%)</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <X className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {stats ? stats.total_sessions - stats.valid_sessions : 0}
                </div>
                <div className="text-xs text-bron-text-muted">Expired</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {stats?.high_value_count || 0}
                </div>
                <div className="text-xs text-bron-text-muted">High-Value</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-bron-bg-secondary border-bron-border">
        <CardHeader>
          <CardTitle className="text-bron-text-primary">High-Value Sessions</CardTitle>
          <CardDescription className="text-bron-text-muted">
            Critical authenticated sessions (Email, Finance, Crypto, Cloud, Development)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                  <TableHead className="text-bron-text-muted">Service</TableHead>
                  <TableHead className="text-bron-text-muted">Category</TableHead>
                  <TableHead className="text-bron-text-muted">Account</TableHead>
                  <TableHead className="text-bron-text-muted">Browser</TableHead>
                  <TableHead className="text-bron-text-muted">Status</TableHead>
                  <TableHead className="text-bron-text-muted">Expires</TableHead>
                  <TableHead className="text-bron-text-muted">Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highValueSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-bron-text-muted py-8">
                      No high-value sessions detected
                    </TableCell>
                  </TableRow>
                ) : (
                  highValueSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      className="border-bron-border hover:bg-bron-bg-tertiary"
                    >
                      <TableCell className="font-medium text-bron-text-primary">
                        {session.service}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getCategoryColor(session.service_category)}
                        >
                          <span className="flex items-center gap-1">
                            {getCategoryIcon(session.service_category)}
                            <span className="capitalize">{session.service_category}</span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-bron-text-primary max-w-[200px] truncate">
                        {session.account_identifier || "—"}
                      </TableCell>
                      <TableCell className="text-bron-text-muted">
                        {session.browser || "—"}
                      </TableCell>
                      <TableCell>
                        {session.session_valid ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            <Check className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                            <X className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-bron-text-muted">
                        {formatExpiresAt(session.expires_at)}
                      </TableCell>
                      <TableCell className="text-bron-text-muted text-xs max-w-[150px] truncate">
                        {session.device_name || session.device_id}
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
