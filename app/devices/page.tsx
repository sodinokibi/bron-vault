"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Laptop,
  Search,
  Calendar,
  Shield,
  Key,
  Globe,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"

interface Device {
  device_id: string
  device_name: string
  upload_date: string
  upload_batch: string
  total_files: number
  total_credentials: number
  total_domains: number
  total_urls: number
  stealer_family: string | null
  confidence: number | null
}

export default function DevicesPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchDevices()
  }, [currentPage])

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const offset = (currentPage - 1) * itemsPerPage
      const response = await fetch(
        `/api/v1/devices?limit=${itemsPerPage}&offset=${offset}&q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()

      if (data.success) {
        setDevices(data.devices)
        setTotal(data.total)
      } else {
        toast.error("Failed to load devices")
      }
    } catch (error) {
      console.error("Error fetching devices:", error)
      toast.error("Error loading devices")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchDevices()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-bron-text-primary flex items-center gap-2">
            <Laptop className="h-8 w-8 text-bron-accent-blue" />
            All Devices
          </h1>
          <p className="text-bron-text-muted mt-1">
            {total} devices total
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-bron-bg-secondary border-bron-border">
        <CardHeader>
          <CardTitle className="text-bron-text-primary text-sm">Search Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-bron-text-muted" />
              <Input
                type="text"
                placeholder="Search by device name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-bron-bg-tertiary border-bron-border text-bron-text-primary"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card className="bg-bron-bg-secondary border-bron-border">
        <CardHeader>
          <CardTitle className="text-bron-text-primary">Devices</CardTitle>
          <CardDescription className="text-bron-text-muted">
            Click on a device to view full details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-bron-text-muted">Loading devices...</div>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-bron-border hover:bg-bron-bg-tertiary">
                      <TableHead className="text-bron-text-muted">Device Name</TableHead>
                      <TableHead className="text-bron-text-muted">Upload Date</TableHead>
                      <TableHead className="text-bron-text-muted">Stealer</TableHead>
                      <TableHead className="text-bron-text-muted">Credentials</TableHead>
                      <TableHead className="text-bron-text-muted">Domains</TableHead>
                      <TableHead className="text-bron-text-muted">Files</TableHead>
                      <TableHead className="text-bron-text-muted">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-bron-text-muted py-8">
                          No devices found
                        </TableCell>
                      </TableRow>
                    ) : (
                      devices.map((device) => (
                        <TableRow
                          key={device.device_id}
                          className="border-bron-border hover:bg-bron-bg-tertiary cursor-pointer"
                          onClick={() => router.push(`/devices/${device.device_id}`)}
                        >
                          <TableCell className="font-medium text-bron-text-primary">
                            <div className="flex items-center gap-2">
                              <Laptop className="h-4 w-4 text-bron-accent-blue" />
                              {device.device_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-bron-text-muted">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {formatDate(device.upload_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {device.stealer_family ? (
                              <Badge
                                variant="outline"
                                className="bg-bron-accent-red/10 text-bron-accent-red border-bron-accent-red/20"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {device.stealer_family}
                              </Badge>
                            ) : (
                              <span className="text-bron-text-muted text-sm">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-bron-text-primary">
                              <Key className="h-3 w-3 text-bron-accent-green" />
                              {device.total_credentials}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-bron-text-primary">
                              <Globe className="h-3 w-3 text-bron-accent-blue" />
                              {device.total_domains}
                            </div>
                          </TableCell>
                          <TableCell className="text-bron-text-primary">
                            {device.total_files}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/devices/${device.device_id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="outline" size="sm">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-bron-text-muted">
                    Page {currentPage} of {totalPages} ({total} total devices)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
