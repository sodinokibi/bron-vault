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
import { Package, Search, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SoftwareItem {
  software_name: string
  version: string | null
  publisher: string | null
  install_date: string | null
  install_location: string | null
  count: number
}

interface SoftwareInventoryTableProps {
  deviceId: string
}

export function SoftwareInventoryTable({ deviceId }: SoftwareInventoryTableProps) {
  const [software, setSoftware] = useState<SoftwareItem[]>([])
  const [filteredSoftware, setFilteredSoftware] = useState<SoftwareItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSoftware()
  }, [deviceId])

  useEffect(() => {
    filterSoftware()
  }, [searchQuery, software])

  const loadSoftware = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Use existing software analysis API
      const response = await fetch(`/api/software-analysis?device_id=${deviceId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.softwareAnalysis) {
        setSoftware(data.softwareAnalysis)
        setFilteredSoftware(data.softwareAnalysis)
      } else {
        setError(data.error || "Failed to load software inventory")
      }
    } catch (err) {
      console.error("Error loading software:", err)
      setError("Failed to load software inventory")
    } finally {
      setIsLoading(false)
    }
  }

  const filterSoftware = () => {
    if (!searchQuery.trim()) {
      setFilteredSoftware(software)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = software.filter((item) =>
      item.software_name.toLowerCase().includes(query) ||
      (item.version && item.version.toLowerCase().includes(query)) ||
      (item.publisher && item.publisher.toLowerCase().includes(query))
    )

    setFilteredSoftware(filtered)
  }

  const exportToCSV = () => {
    const headers = ["Software Name", "Version", "Publisher", "Install Date", "Install Location"]
    const rows = filteredSoftware.map((item) => [
      item.software_name,
      item.version || "",
      item.publisher || "",
      item.install_date || "",
      item.install_location || ""
    ])

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `software-inventory-${deviceId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSoftwareCategory = (name: string): { category: string; color: string } => {
    const nameLower = name.toLowerCase()

    if (nameLower.includes("chrome") || nameLower.includes("firefox") || nameLower.includes("edge") || nameLower.includes("browser")) {
      return { category: "Browser", color: "bg-blue-500" }
    }
    if (nameLower.includes("python") || nameLower.includes("node") || nameLower.includes("java") || nameLower.includes("visual studio") || nameLower.includes("git")) {
      return { category: "Development", color: "bg-purple-500" }
    }
    if (nameLower.includes("steam") || nameLower.includes("epic") || nameLower.includes("discord") || nameLower.includes("game")) {
      return { category: "Gaming", color: "bg-green-500" }
    }
    if (nameLower.includes("office") || nameLower.includes("word") || nameLower.includes("excel") || nameLower.includes("powerpoint")) {
      return { category: "Productivity", color: "bg-orange-500" }
    }
    if (nameLower.includes("security") || nameLower.includes("antivirus") || nameLower.includes("defender")) {
      return { category: "Security", color: "bg-red-500" }
    }
    if (nameLower.includes("driver") || nameLower.includes("runtime") || nameLower.includes("redistributable")) {
      return { category: "System", color: "bg-gray-500" }
    }

    return { category: "Other", color: "bg-slate-500" }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading software inventory...</p>
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
      {/* Header with Search and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Installed Software
              </CardTitle>
              <CardDescription>
                {filteredSoftware.length} of {software.length} applications
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search software, version, or publisher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Software Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Software Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Install Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSoftware.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No software found matching your search
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSoftware.map((item, index) => {
                    const { category, color } = getSoftwareCategory(item.software_name)
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-[300px]" title={item.software_name}>
                              {item.software_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.version ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {item.version}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.publisher || undefined}>
                          {item.publisher || <span className="text-muted-foreground text-sm">Unknown</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${color}`} />
                            <span className="text-sm">{category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.install_date
                            ? new Date(item.install_date).toLocaleDateString()
                            : "Unknown"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Category Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Software Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              filteredSoftware.reduce((acc, item) => {
                const { category } = getSoftwareCategory(item.software_name)
                acc[category] = (acc[category] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            )
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <Badge key={category} variant="secondary">
                  {category}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
