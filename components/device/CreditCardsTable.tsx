"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Search, Download, Info, CreditCard, AlertTriangle, CheckCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CreditCardItem {
  id: number
  device_id: string
  card_number_last4: string
  cardholder_name: string
  expiration_month: number
  expiration_year: number
  expiration_display: string
  is_expired: boolean | null
  expires_within_months: number | null
  card_type: string
  browser: string
  profile?: string
  file_path: string
  created_at: string
}

interface CreditCardsTableProps {
  deviceId: string
}

export function CreditCardsTable({ deviceId }: CreditCardsTableProps) {
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>([])
  const [filteredCards, setFilteredCards] = useState<CreditCardItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [browserFilter, setBrowserFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    loadCreditCards()
  }, [deviceId])

  useEffect(() => {
    filterCards()
  }, [searchQuery, statusFilter, browserFilter, creditCards])

  const loadCreditCards = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/devices/${deviceId}/credit-cards?limit=500`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setCreditCards(data.credit_cards || [])
        setFilteredCards(data.credit_cards || [])
        setSummary(data.summary || null)
      } else {
        setError(data.error || "Failed to load credit cards")
      }
    } catch (err) {
      console.error("Error loading credit cards:", err)
      setError("Failed to load credit cards")
    } finally {
      setIsLoading(false)
    }
  }

  const filterCards = () => {
    let filtered = creditCards

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((card) =>
        card.cardholder_name.toLowerCase().includes(query) ||
        card.card_number_last4.includes(query) ||
        card.browser.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((card) => {
        if (statusFilter === "expired") return card.is_expired === true
        if (statusFilter === "valid") return card.is_expired === false
        if (statusFilter === "expiring_soon") {
          return card.expires_within_months !== null && card.expires_within_months >= 0 && card.expires_within_months <= 3
        }
        return true
      })
    }

    // Browser filter
    if (browserFilter !== "all") {
      filtered = filtered.filter((card) => card.browser === browserFilter)
    }

    setFilteredCards(filtered)
  }

  const exportToCSV = () => {
    const headers = ["Last 4", "Cardholder Name", "Expiration", "Card Type", "Status", "Browser", "Profile"]
    const rows = filteredCards.map((card) => [
      card.card_number_last4,
      card.cardholder_name,
      card.expiration_display,
      card.card_type,
      card.is_expired ? "Expired" : "Valid",
      card.browser,
      card.profile || ""
    ])

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `credit-cards-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToTXT = () => {
    const lines = filteredCards.map((card) =>
      `**** **** **** ${card.card_number_last4} | ${card.cardholder_name} | Exp: ${card.expiration_display} | ${card.card_type} | ${card.browser}`
    )

    const txt = [
      `Credit Cards Export - Device: ${deviceId}`,
      `Generated: ${new Date().toISOString()}`,
      `Total Cards: ${filteredCards.length}`,
      "",
      ...lines
    ].join("\n")

    const blob = new Blob([txt], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `credit-cards-${deviceId}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getCardTypeColor = (cardType: string) => {
    switch (cardType) {
      case "Visa":
        return "bg-blue-500"
      case "Mastercard":
        return "bg-orange-500"
      case "American Express":
        return "bg-green-500"
      case "Discover":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading credit cards...</p>
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

  const uniqueBrowsers = Array.from(new Set(creditCards.map((card) => card.browser)))
  const validCards = creditCards.filter((card) => card.is_expired === false).length
  const expiredCards = creditCards.filter((card) => card.is_expired === true).length
  const expiringSoonCards = creditCards.filter(
    (card) => card.expires_within_months !== null && card.expires_within_months >= 0 && card.expires_within_months <= 3
  ).length

  return (
    <div className="space-y-4">
      {/* Warning Alert */}
      {creditCards.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sensitive Financial Data</AlertTitle>
          <AlertDescription>
            {creditCards.length} credit card(s) found. Handle this data with extreme care.
            These may represent compromised payment methods.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Filters and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Cards
              </CardTitle>
              <CardDescription>
                {filteredCards.length} of {creditCards.length} cards
              </CardDescription>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cardholder or last 4..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="valid">Valid Cards ({validCards})</SelectItem>
                <SelectItem value="expired">Expired Cards ({expiredCards})</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon ({expiringSoonCards})</SelectItem>
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{creditCards.length}</div>
                <div className="text-sm text-muted-foreground">Total Cards</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{validCards}</div>
                <div className="text-sm text-muted-foreground">Valid</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{expiredCards}</div>
                <div className="text-sm text-muted-foreground">Expired</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{expiringSoonCards}</div>
                <div className="text-sm text-muted-foreground">Expiring Soon</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Cards Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Card Number</TableHead>
                  <TableHead>Cardholder</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No credit cards found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          **** **** **** {card.card_number_last4}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {card.cardholder_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sm">{card.expiration_display}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getCardTypeColor(card.card_type)}`} />
                          <span className="text-sm">{card.card_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {card.is_expired === true ? (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        ) : card.is_expired === false ? (
                          card.expires_within_months !== null && card.expires_within_months <= 3 ? (
                            <Badge variant="default" className="bg-orange-500 text-xs">
                              Expires in {card.expires_within_months}mo
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              Valid
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Unknown
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{card.browser}</Badge>
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
