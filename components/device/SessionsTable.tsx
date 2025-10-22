"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Search, Cookie, Check, X, Shield, AlertTriangle, Info, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculateSessionRisk, SessionSecurityFlags } from "@/lib/risk-scoring"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Session {
  service: string
  service_category: string
  account_identifier: string | null
  session_valid: boolean
  expires_at?: Date
  cookie_count: number
  has_auth_token: boolean
  security_flags: SessionSecurityFlags
  browser: string
  profile: string
  file_path: string
  detected_at: Date
}

interface SessionsTableProps {
  deviceId: string
}

export function SessionsTable({ deviceId }: SessionsTableProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [securityFilter, setSecurityFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [deviceId])

  useEffect(() => {
    filterSessions()
  }, [searchQuery, categoryFilter, securityFilter, sessions])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/cookie-sessions/${deviceId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setSessions(data.sessions || [])
        setFilteredSessions(data.sessions || [])
      } else {
        setError(data.error || "Failed to load sessions")
      }
    } catch (err) {
      console.error("Error loading sessions:", err)
      setError("Failed to load sessions")
    } finally {
      setIsLoading(false)
    }
  }

  const filterSessions = () => {
    let filtered = sessions

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((session) =>
        session.service.toLowerCase().includes(query) ||
        session.service_category.toLowerCase().includes(query) ||
        (session.account_identifier && session.account_identifier.toLowerCase().includes(query))
      )
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((session) => session.service_category === categoryFilter)
    }

    // Security filter
    if (securityFilter !== "all") {
      filtered = filtered.filter((session) => {
        const risk = calculateSessionRisk(session.security_flags)
        switch (securityFilter) {
          case "secure":
            return risk.level === "Secure"
          case "low-risk":
            return risk.level === "Low Risk"
          case "medium-risk":
            return risk.level === "Medium Risk"
          case "high-risk":
            return risk.level === "High Risk"
          default:
            return true
        }
      })
    }

    setFilteredSessions(filtered)
  }

  const exportToCSV = () => {
    const headers = ["Service", "Category", "Account", "Valid", "Expires", "Browser", "Security Score", "Security Issues"]
    const rows = filteredSessions.map((session) => {
      const risk = calculateSessionRisk(session.security_flags)
      return [
        session.service,
        session.service_category,
        session.account_identifier || "",
        session.session_valid ? "Yes" : "No",
        session.expires_at ? new Date(session.expires_at).toISOString() : "",
        session.browser,
        risk.score.toString(),
        risk.issues.join("; ")
      ]
    })

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cookie-sessions-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getCategoryBadgeClass = (category: string) => {
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

  const getSecurityBadge = (flags: SessionSecurityFlags) => {
    const risk = calculateSessionRisk(flags)

    let variant: "default" | "secondary" | "destructive" | "outline" = "default"
    let className = ""

    switch (risk.level) {
      case "Secure":
        variant = "secondary"
        className = "bg-green-500/10 text-green-500 border-green-500/20"
        break
      case "Low Risk":
        className = "bg-blue-500/10 text-blue-500 border-blue-500/20"
        break
      case "Medium Risk":
        className = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
        break
      case "High Risk":
        variant = "destructive"
        className = "bg-red-500/10 text-red-500 border-red-500/20"
        break
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className={className}>
              {risk.level}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-sm">Security Score: {risk.score}/100</div>
              {risk.issues.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground mt-2">Issues:</div>
                  {risk.issues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-current mt-1 flex-shrink-0" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const uniqueCategories = Array.from(new Set(sessions.map((s) => s.service_category)))

  // Calculate security statistics
  const securityStats = sessions.reduce((acc, session) => {
    const risk = calculateSessionRisk(session.security_flags)
    acc[risk.level] = (acc[risk.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <Cookie className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {securityStats["Secure"] || 0}
                </div>
                <div className="text-sm text-muted-foreground">Secure</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(securityStats["Medium Risk"] || 0) + (securityStats["High Risk"] || 0)}
                </div>
                <div className="text-sm text-muted-foreground">At Risk</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {sessions.filter(s => s.session_valid).length}
                </div>
                <div className="text-sm text-muted-foreground">Valid</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cookie Sessions</CardTitle>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <CardDescription>
            {filteredSessions.length} of {sessions.length} sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search service or account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={securityFilter} onValueChange={setSecurityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by security" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Security Levels</SelectItem>
                <SelectItem value="secure">Secure</SelectItem>
                <SelectItem value="low-risk">Low Risk</SelectItem>
                <SelectItem value="medium-risk">Medium Risk</SelectItem>
                <SelectItem value="high-risk">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No sessions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Cookie className="h-4 w-4 text-muted-foreground" />
                          {session.service}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCategoryBadgeClass(session.service_category)}>
                          {session.service_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={session.account_identifier || undefined}>
                        {session.account_identifier || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.browser}</Badge>
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
                      <TableCell>
                        {getSecurityBadge(session.security_flags)}
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

      {/* Security Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Analysis
          </CardTitle>
          <CardDescription>Session security distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div>
                <div className="text-sm font-semibold">{securityStats["Secure"] || 0}</div>
                <div className="text-xs text-muted-foreground">Secure</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div>
                <div className="text-sm font-semibold">{securityStats["Low Risk"] || 0}</div>
                <div className="text-xs text-muted-foreground">Low Risk</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div>
                <div className="text-sm font-semibold">{securityStats["Medium Risk"] || 0}</div>
                <div className="text-xs text-muted-foreground">Medium Risk</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div>
                <div className="text-sm font-semibold">{securityStats["High Risk"] || 0}</div>
                <div className="text-xs text-muted-foreground">High Risk</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
