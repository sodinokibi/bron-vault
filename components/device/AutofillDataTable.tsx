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
import { Search, Download, Info, FileText, Mail, Phone, MapPin, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AutofillItem {
  id: number
  device_id: string
  field_name: string
  field_value: string
  times_used: number
  browser: string
  profile?: string
  file_path: string
  created_at: string
  category: string
}

interface AutofillDataTableProps {
  deviceId: string
}

export function AutofillDataTable({ deviceId }: AutofillDataTableProps) {
  const [autofillData, setAutofillData] = useState<AutofillItem[]>([])
  const [filteredData, setFilteredData] = useState<AutofillItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [browserFilter, setBrowserFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    loadAutofillData()
  }, [deviceId])

  useEffect(() => {
    filterData()
  }, [searchQuery, categoryFilter, browserFilter, autofillData])

  const loadAutofillData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/devices/${deviceId}/autofill?limit=1000`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setAutofillData(data.autofill || [])
        setFilteredData(data.autofill || [])
        setSummary(data.summary || null)
      } else {
        setError(data.error || "Failed to load autofill data")
      }
    } catch (err) {
      console.error("Error loading autofill data:", err)
      setError("Failed to load autofill data")
    } finally {
      setIsLoading(false)
    }
  }

  const filterData = () => {
    let filtered = autofillData

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((item) =>
        item.field_name.toLowerCase().includes(query) ||
        item.field_value.toLowerCase().includes(query) ||
        item.browser.toLowerCase().includes(query)
      )
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((item) => item.category === categoryFilter)
    }

    // Browser filter
    if (browserFilter !== "all") {
      filtered = filtered.filter((item) => item.browser === browserFilter)
    }

    setFilteredData(filtered)
  }

  const exportToCSV = () => {
    const headers = ["Field Name", "Field Value", "Times Used", "Category", "Browser", "Profile", "File Path"]
    const rows = filteredData.map((item) => [
      item.field_name,
      item.field_value,
      item.times_used.toString(),
      item.category,
      item.browser,
      item.profile || "",
      item.file_path
    ])

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `autofill-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToTXT = () => {
    const lines = filteredData.map((item) =>
      `${item.field_name}: ${item.field_value} (${item.category}, ${item.browser})`
    )

    const txt = lines.join("\n")

    const blob = new Blob([txt], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `autofill-${deviceId}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Email":
        return <Mail className="h-4 w-4" />
      case "Phone":
        return <Phone className="h-4 w-4" />
      case "Address":
        return <MapPin className="h-4 w-4" />
      case "Payment":
        return <CreditCard className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Email":
        return "bg-blue-500"
      case "Phone":
        return "bg-green-500"
      case "Address":
        return "bg-purple-500"
      case "Payment":
        return "bg-orange-500"
      case "Name":
        return "bg-pink-500"
      default:
        return "bg-gray-500"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading autofill data...</p>
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

  const uniqueCategories = Array.from(new Set(autofillData.map((item) => item.category)))
  const uniqueBrowsers = Array.from(new Set(autofillData.map((item) => item.browser)))

  return (
    <div className="space-y-4">
      {/* Header with Filters and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Autofill Data
              </CardTitle>
              <CardDescription>
                {filteredData.length} of {autofillData.length} fields
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
                placeholder="Search fields or values..."
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
      {summary && summary.categories && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.categories.slice(0, 4).map((cat: any) => (
            <Card key={cat.category}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${getCategoryColor(cat.category)} flex items-center justify-center text-white`}>
                    {getCategoryIcon(cat.category)}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{cat.count}</div>
                    <div className="text-sm text-muted-foreground">{cat.category}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Autofill Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Times Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No autofill data found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(item.category)}
                          <span className="max-w-[200px] truncate" title={item.field_name}>
                            {item.field_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={item.field_value}>
                        {item.field_value}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getCategoryColor(item.category)}`} />
                          <span className="text-sm">{item.category}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.browser}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.times_used > 0 ? item.times_used : "—"}
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
