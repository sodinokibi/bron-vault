"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Calendar,
  HardDrive,
  Shield,
  AlertTriangle,
  CheckCircle,
  FileText,
  Key,
  Cookie,
  Globe,
  Download,
  MessageCircle,
  Wallet,
  Package,
  Clock,
  Laptop,
  Target
} from "lucide-react"
import { toast } from "sonner"
import { StealerAnalysisPanel } from "@/components/device/StealerAnalysisPanel"
import { SoftwareInventoryTable } from "@/components/device/SoftwareInventoryTable"
import { AutofillDataTable } from "@/components/device/AutofillDataTable"
import { CreditCardsTable } from "@/components/device/CreditCardsTable"
import { RiskBadge, RiskScoreBar } from "@/components/ui/risk-badge"
import { RiskScore } from "@/lib/risk-scoring"

interface DeviceDetails {
  device_id: string
  device_name: string
  upload_date: string
  upload_batch: string
  total_credentials: number
  total_domains: number
  total_urls: number
  total_files: number
  stealer_info: {
    stealer_family: string
    confidence: number
    detection_method: string
  } | null
  counts: {
    files: number
    directories: number
    credentials: number
    cookies: number
    browser_history: number
    bookmarks: number
    downloads: number
    discord_tokens: number
    telegram_sessions: number
    two_fa_codes: number
    crypto_wallets: number
    cookie_sessions: number
    high_value_sessions: number
    software: number
  }
}

interface Credential {
  id: number
  url: string
  domain: string
  username: string
  password: string
  browser: string
  file_path: string
}

interface TimelineEvent {
  timestamp: string
  event_type: string
  category: string
  description: string
  metadata?: any
  icon?: string
  color?: string
}

export default function DeviceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.deviceId as string

  const [device, setDevice] = useState<DeviceDetails | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [downloads, setDownloads] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (deviceId) {
      fetchDeviceDetails()
    }
  }, [deviceId])

  const fetchDeviceDetails = async () => {
    setLoading(true)
    try {
      const [
        deviceRes,
        credentialsRes,
        timelineRes,
        sessionsRes,
        bookmarksRes,
        downloadsRes,
        filesRes,
        riskRes
      ] = await Promise.all([
        fetch(`/api/v1/devices/${deviceId}`),
        fetch(`/api/v1/devices/${deviceId}/credentials?limit=100`),
        fetch(`/api/v1/devices/${deviceId}/timeline`),
        fetch(`/api/v1/cookie-sessions/${deviceId}`),
        fetch(`/api/v1/devices/${deviceId}/bookmarks?limit=100`),
        fetch(`/api/v1/devices/${deviceId}/downloads?limit=100`),
        fetch(`/api/v1/devices/${deviceId}/files`),
        fetch(`/api/v1/devices/${deviceId}/risk-score`)
      ])

      const deviceData = await deviceRes.json()
      const credentialsData = await credentialsRes.json()
      const timelineData = await timelineRes.json()
      const sessionsData = await sessionsRes.json()
      const bookmarksData = await bookmarksRes.json()
      const downloadsData = await downloadsRes.json()
      const filesData = await filesRes.json()
      const riskData = await riskRes.json()

      if (deviceData.success) {
        setDevice(deviceData.device)
      } else {
        toast.error("Failed to load device details")
      }

      if (credentialsData.success) {
        setCredentials(credentialsData.credentials)
      }

      if (timelineData.success) {
        setTimeline(timelineData.timeline)
      }

      if (sessionsData.success) {
        setSessions(sessionsData.sessions || [])
      }

      if (bookmarksData.success) {
        setBookmarks(bookmarksData.bookmarks || [])
      }

      if (downloadsData.success) {
        setDownloads(downloadsData.downloads || [])
      }

      if (filesData.success) {
        setFiles(filesData.files || [])
      }

      if (riskData.success && riskData.risk_score) {
        setRiskScore(riskData.risk_score)
      }
    } catch (error) {
      console.error("Error fetching device details:", error)
      toast.error("Error loading device details")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-bron-text-muted">Loading device details...</div>
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-bron-accent-red mx-auto mb-4" />
            <h2 className="text-xl font-bold text-bron-text-primary mb-2">Device Not Found</h2>
            <p className="text-bron-text-muted mb-4">The requested device could not be found.</p>
            <Button onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const totalItems =
    device.counts.credentials +
    device.counts.cookies +
    device.counts.discord_tokens +
    device.counts.telegram_sessions +
    device.counts.two_fa_codes +
    device.counts.crypto_wallets

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-bron-text-primary flex items-center gap-2">
              <Laptop className="h-8 w-8 text-bron-accent-blue" />
              {device.device_name}
            </h1>
            <p className="text-bron-text-muted mt-1">
              Device ID: {device.device_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {riskScore && (
            <RiskBadge
              score={riskScore.score}
              level={riskScore.level}
              showIcon={true}
              showScore={true}
              factors={riskScore.factors}
              size="lg"
            />
          )}
          {device.stealer_info && (
            <Badge
              variant="outline"
              className="bg-bron-accent-red/10 text-bron-accent-red border-bron-accent-red/20"
            >
              <Shield className="h-3 w-3 mr-1" />
              {device.stealer_info.stealer_family} ({device.stealer_info.confidence}% confidence)
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Total Items
            </CardTitle>
            <Package className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">{totalItems}</div>
            <p className="text-xs text-bron-text-muted">Extracted data points</p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Credentials
            </CardTitle>
            <Key className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {device.counts.credentials}
            </div>
            <p className="text-xs text-bron-text-muted">{device.total_domains} unique domains</p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              High-Value Sessions
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-bron-accent-yellow" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {device.counts.high_value_sessions}
            </div>
            <p className="text-xs text-bron-text-muted">
              {device.counts.cookie_sessions} total sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-secondary border-bron-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-bron-text-muted">
              Files
            </CardTitle>
            <FileText className="h-4 w-4 text-bron-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bron-text-primary">
              {device.counts.files}
            </div>
            <p className="text-xs text-bron-text-muted">
              {device.counts.directories} directories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-bron-bg-secondary border-bron-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stealer">Stealer Analysis</TabsTrigger>
          <TabsTrigger value="credentials">
            Credentials ({device.counts.credentials})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            Sessions ({device.counts.cookie_sessions})
          </TabsTrigger>
          <TabsTrigger value="autofill">
            Autofill
          </TabsTrigger>
          <TabsTrigger value="credit_cards">
            Credit Cards
          </TabsTrigger>
          <TabsTrigger value="bookmarks">
            Bookmarks ({device.counts.bookmarks})
          </TabsTrigger>
          <TabsTrigger value="downloads">
            Downloads ({device.counts.downloads})
          </TabsTrigger>
          <TabsTrigger value="software">
            Software ({device.counts.software})
          </TabsTrigger>
          <TabsTrigger value="files">
            Files ({device.counts.files})
          </TabsTrigger>
          <TabsTrigger value="messaging">
            Messaging ({device.counts.discord_tokens + device.counts.telegram_sessions})
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Device Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Upload Date:</span>
                  <span className="text-bron-text-primary">{formatDate(device.upload_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Upload Batch:</span>
                  <span className="text-bron-text-primary">{device.upload_batch}</span>
                </div>
                {device.stealer_info && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-bron-text-muted">Stealer Family:</span>
                      <span className="text-bron-text-primary">
                        {device.stealer_info.stealer_family}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-bron-text-muted">Detection Method:</span>
                      <span className="text-bron-text-primary">
                        {device.stealer_info.detection_method}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Data Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Browser History:</span>
                  <Badge variant="secondary">{device.counts.browser_history}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Bookmarks:</span>
                  <Badge variant="secondary">{device.counts.bookmarks}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Downloads:</span>
                  <Badge variant="secondary">{device.counts.downloads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Cookies:</span>
                  <Badge variant="secondary">{device.counts.cookies}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Crypto Wallets:</span>
                  <Badge variant="secondary">{device.counts.crypto_wallets}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-bron-text-muted">Software:</span>
                  <Badge variant="secondary">{device.counts.software}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Assessment Card */}
          {riskScore && (
            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Security Risk Assessment
                </CardTitle>
                <CardDescription className="text-bron-text-muted">
                  Comprehensive risk analysis for this device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <RiskScoreBar
                      score={riskScore.score}
                      level={riskScore.level}
                      showLabel={true}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <RiskBadge
                      score={riskScore.score}
                      level={riskScore.level}
                      showIcon={true}
                      showScore={true}
                      size="lg"
                    />
                  </div>
                </div>

                {riskScore.factors && riskScore.factors.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-bron-text-primary mb-2">
                      Risk Factors:
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {riskScore.factors.map((factor, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 text-sm p-2 bg-bron-bg-tertiary rounded"
                        >
                          <AlertTriangle className="h-4 w-4 text-bron-accent-yellow flex-shrink-0 mt-0.5" />
                          <span className="text-bron-text-primary">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {riskScore.recommendations && riskScore.recommendations.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-bron-text-primary mb-2">
                      Recommended Actions:
                    </div>
                    <ol className="space-y-2">
                      {riskScore.recommendations.map((rec, index) => (
                        <li key={index} className="flex gap-3 text-sm">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-bron-accent-blue text-white flex items-center justify-center text-xs font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 pt-0.5 text-bron-text-primary">{rec}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Stealer Analysis Tab */}
        <TabsContent value="stealer">
          <StealerAnalysisPanel deviceId={deviceId} />
        </TabsContent>

        {/* Credentials Tab */}
        <TabsContent value="credentials">
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary">Saved Credentials</CardTitle>
              <CardDescription className="text-bron-text-muted">
                {device.counts.credentials} credentials from this device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">URL</TableHead>
                      <TableHead className="text-bron-text-muted">Username</TableHead>
                      <TableHead className="text-bron-text-muted">Password</TableHead>
                      <TableHead className="text-bron-text-muted">Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-bron-text-muted py-8">
                          No credentials found
                        </TableCell>
                      </TableRow>
                    ) : (
                      credentials.map((cred) => (
                        <TableRow
                          key={cred.id}
                          className="border-bron-border hover:bg-bron-bg-tertiary"
                        >
                          <TableCell className="text-bron-text-primary max-w-[300px] truncate">
                            {cred.url}
                          </TableCell>
                          <TableCell className="text-bron-text-primary">
                            {cred.username}
                          </TableCell>
                          <TableCell className="text-bron-text-primary font-mono text-xs">
                            {cred.password.substring(0, 3)}***
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-bron-bg-tertiary">
                              {cred.browser}
                            </Badge>
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
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary">Cookie Sessions</CardTitle>
              <CardDescription className="text-bron-text-muted">
                {device.counts.cookie_sessions} detected sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">Service</TableHead>
                      <TableHead className="text-bron-text-muted">Category</TableHead>
                      <TableHead className="text-bron-text-muted">Account</TableHead>
                      <TableHead className="text-bron-text-muted">Browser</TableHead>
                      <TableHead className="text-bron-text-muted">Status</TableHead>
                      <TableHead className="text-bron-text-muted">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-bron-text-muted py-8">
                          No cookie sessions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      sessions.map((session: any, index: number) => (
                        <TableRow
                          key={index}
                          className="border-bron-border hover:bg-bron-bg-tertiary"
                        >
                          <TableCell className="font-medium text-bron-text-primary">
                            {session.service}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {session.service_category}
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
                                Valid
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                                Expired
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-bron-text-muted">
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

        {/* Autofill Tab */}
        <TabsContent value="autofill">
          <AutofillDataTable deviceId={deviceId} />
        </TabsContent>

        {/* Credit Cards Tab */}
        <TabsContent value="credit_cards">
          <CreditCardsTable deviceId={deviceId} />
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks">
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary">Browser Bookmarks</CardTitle>
              <CardDescription className="text-bron-text-muted">
                {device.counts.bookmarks} bookmarks found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">Title</TableHead>
                      <TableHead className="text-bron-text-muted">URL</TableHead>
                      <TableHead className="text-bron-text-muted">Folder</TableHead>
                      <TableHead className="text-bron-text-muted">Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookmarks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-bron-text-muted py-8">
                          No bookmarks found
                        </TableCell>
                      </TableRow>
                    ) : (
                      bookmarks.map((bookmark: any, index: number) => (
                        <TableRow
                          key={index}
                          className="border-bron-border hover:bg-bron-bg-tertiary"
                        >
                          <TableCell className="font-medium text-bron-text-primary">
                            {bookmark.title || "Untitled"}
                          </TableCell>
                          <TableCell className="text-bron-text-primary max-w-[300px] truncate">
                            {bookmark.url}
                          </TableCell>
                          <TableCell className="text-bron-text-muted">
                            {bookmark.folder || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-bron-bg-tertiary">
                              {bookmark.browser}
                            </Badge>
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

        {/* Downloads Tab */}
        <TabsContent value="downloads">
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary">Browser Downloads</CardTitle>
              <CardDescription className="text-bron-text-muted">
                {device.counts.downloads} downloads found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">File Path</TableHead>
                      <TableHead className="text-bron-text-muted">Source URL</TableHead>
                      <TableHead className="text-bron-text-muted">Browser</TableHead>
                      <TableHead className="text-bron-text-muted">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-bron-text-muted py-8">
                          No downloads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      downloads.map((download: any, index: number) => (
                        <TableRow
                          key={index}
                          className="border-bron-border hover:bg-bron-bg-tertiary"
                        >
                          <TableCell className="font-medium text-bron-text-primary">
                            {download.file_path}
                          </TableCell>
                          <TableCell className="text-bron-text-primary max-w-[300px] truncate">
                            {download.download_url || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-bron-bg-tertiary">
                              {download.browser}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-bron-text-muted">
                            {download.start_time ? new Date(download.start_time).toLocaleString() : "—"}
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

        {/* Software Inventory Tab */}
        <TabsContent value="software">
          <SoftwareInventoryTable deviceId={deviceId} />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary">File Tree</CardTitle>
              <CardDescription className="text-bron-text-muted">
                {device.counts.files} files and {device.counts.directories} directories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">Path</TableHead>
                      <TableHead className="text-bron-text-muted">Type</TableHead>
                      <TableHead className="text-bron-text-muted">Size</TableHead>
                      <TableHead className="text-bron-text-muted">Has Content</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-bron-text-muted py-8">
                          No files found
                        </TableCell>
                      </TableRow>
                    ) : (
                      files.map((file: any, index: number) => (
                        <TableRow
                          key={index}
                          className="border-bron-border hover:bg-bron-bg-tertiary"
                        >
                          <TableCell className="font-mono text-sm text-bron-text-primary max-w-[400px] truncate">
                            {file.file_path}
                          </TableCell>
                          <TableCell>
                            {file.is_directory ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                Directory
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                File
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-bron-text-muted">
                            {file.file_size ? `${(file.file_size / 1024).toFixed(2)} KB` : "—"}
                          </TableCell>
                          <TableCell>
                            {file.has_content ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-bron-text-muted">—</span>
                            )}
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

        {/* Messaging Tab */}
        <TabsContent value="messaging">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary text-sm">Discord</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {device.counts.discord_tokens}
                </div>
                <p className="text-xs text-bron-text-muted">tokens found</p>
              </CardContent>
            </Card>

            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary text-sm">Telegram</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {device.counts.telegram_sessions}
                </div>
                <p className="text-xs text-bron-text-muted">sessions found</p>
              </CardContent>
            </Card>

            <Card className="bg-bron-bg-secondary border-bron-border">
              <CardHeader>
                <CardTitle className="text-bron-text-primary text-sm">2FA Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bron-text-primary">
                  {device.counts.two_fa_codes}
                </div>
                <p className="text-xs text-bron-text-muted">codes found</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="bg-bron-bg-secondary border-bron-border">
            <CardHeader>
              <CardTitle className="text-bron-text-primary flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Device Timeline
              </CardTitle>
              <CardDescription className="text-bron-text-muted">
                {timeline.length} events recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {timeline.map((event, index) => (
                    <div key={index} className="flex gap-4 pb-4 border-b border-bron-border last:border-0">
                      <div className="text-xs text-bron-text-muted min-w-[140px]">
                        {formatDate(event.timestamp)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`
                              ${event.color === "blue" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : ""}
                              ${event.color === "purple" ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : ""}
                              ${event.color === "green" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}
                              ${event.color === "red" ? "bg-red-500/10 text-red-500 border-red-500/20" : ""}
                              ${event.color === "yellow" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}
                              ${event.color === "gray" ? "bg-gray-500/10 text-gray-500 border-gray-500/20" : ""}
                            `}
                          >
                            {event.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-bron-text-primary">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
