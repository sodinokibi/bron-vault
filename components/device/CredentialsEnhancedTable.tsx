"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, Download, AlertTriangle, Globe, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface CredentialsEnhancedTableProps {
  deviceId: string
}

interface Credential {
  id: number
  url: string
  domain: string
  username: string
  password: string
  browser: string
  file_path: string
  primary_category?: string
  categories?: string
  risk_level?: string
  risk_score?: number
}

interface CredentialsResponse {
  success: boolean
  device_id: string
  total: number
  limit: number
  offset: number
  credentials: Credential[]
}

export function CredentialsEnhancedTable({ deviceId }: CredentialsEnhancedTableProps) {
  const [data, setData] = useState<CredentialsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [riskFilter, setRiskFilter] = useState<string>("all")
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchCredentials()
  }, [deviceId, categoryFilter, riskFilter])

  const fetchCredentials = async () => {
    try {
      setLoading(true)
      let url = `/api/v1/devices/${deviceId}/credentials?limit=1000`

      if (categoryFilter !== "all") {
        url += `&category=${categoryFilter}`
      }
      if (riskFilter !== "all") {
        url += `&risk=${riskFilter}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result)
      } else {
        toast.error(result.error || "Failed to fetch credentials")
      }
    } catch (error) {
      console.error("Error fetching credentials:", error)
      toast.error("Failed to fetch credentials")
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = (credId: number) => {
    const newSet = new Set(showPasswords)
    if (newSet.has(credId)) {
      newSet.delete(credId)
    } else {
      newSet.add(credId)
    }
    setShowPasswords(newSet)
  }

  const exportCredentials = () => {
    if (!data || data.credentials.length === 0) {
      toast.error("No credentials to export")
      return
    }

    const csv = [
      ["URL", "Domain", "Username", "Password", "Browser", "Category", "Risk Level", "Risk Score"].join(","),
      ...data.credentials.map(cred =>
        [
          `"${cred.url.replace(/"/g, '""')}"`,
          cred.domain,
          cred.username,
          `"${cred.password.replace(/"/g, '""')}"`,
          cred.browser,
          cred.primary_category || 'unknown',
          cred.risk_level || 'unknown',
          cred.risk_score || 0
        ].join(",")
      )
    ].join("\n")

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credentials-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.credentials.length} credentials`)
  }

  const getRiskBadge = (level?: string, score?: number) => {
    if (!level) return null

    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="bg-red-600">CRITICAL ({score || 0})</Badge>
      case 'high':
        return <Badge variant="destructive">HIGH ({score || 0})</Badge>
      case 'medium':
        return <Badge className="bg-yellow-600">MEDIUM ({score || 0})</Badge>
      case 'low':
        return <Badge variant="secondary">LOW ({score || 0})</Badge>
      default:
        return <Badge variant="outline">UNKNOWN</Badge>
    }
  }

  const getCategoryBadge = (category?: string) => {
    if (!category || category === 'unknown') return null

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

  // Calculate stats
  const stats = data ? {
    total: data.credentials.length,
    crypto: data.credentials.filter(c => c.primary_category === 'crypto').length,
    banking: data.credentials.filter(c => c.primary_category === 'banking').length,
    corporate: data.credentials.filter(c => c.primary_category === 'corporate').length,
    highRisk: data.credentials.filter(c => c.risk_level === 'critical' || c.risk_level === 'high').length
  } : null

  if (loading) {
    return <div className="text-center py-8">Loading credentials...</div>
  }

  if (!data) {
    return <div className="text-center py-8">No credentials available</div>
  }

  return (
    <div className="space-y-4">
      {/* High-Risk Alert */}
      {stats && stats.highRisk > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              High-Risk Credentials Detected
            </CardTitle>
            <CardDescription>
              {stats.highRisk} high-risk credentials found (critical/high risk level)
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">credentials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Crypto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.crypto}</div>
              <p className="text-xs text-muted-foreground">crypto logins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Banking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.banking}</div>
              <p className="text-xs text-muted-foreground">banking logins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Corporate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.corporate}</div>
              <p className="text-xs text-muted-foreground">corporate logins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.highRisk}</div>
              <p className="text-xs text-muted-foreground">critical/high risk</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Saved Credentials
              </CardTitle>
              <CardDescription>
                Browser credentials with risk scoring and categorization
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCredentials}>
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
                  <TableHead>URL/Domain</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.credentials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No credentials found matching the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  data.credentials.map((cred) => (
                    <TableRow key={cred.id}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="truncate">
                            <div className="truncate">{cred.url}</div>
                            <div className="text-xs text-muted-foreground truncate">{cred.domain}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{cred.username}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {showPasswords.has(cred.id) ? (
                            <span>{cred.password}</span>
                          ) : (
                            <span>{cred.password.substring(0, 3)}***</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePasswordVisibility(cred.id)}
                          >
                            {showPasswords.has(cred.id) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryBadge(cred.primary_category)}</TableCell>
                      <TableCell>{getRiskBadge(cred.risk_level, cred.risk_score)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cred.browser}</Badge>
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
