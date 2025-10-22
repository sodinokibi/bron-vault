"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Key, Trash2, Copy, Check, AlertTriangle, Shield, Clock } from "lucide-react"
import { toast } from "sonner"
import { AuthGuard } from "@/components/auth-guard"

interface APIKey {
  id: number
  name: string
  description: string | null
  api_key_preview: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  permissions: string[] | null
}

export default function APIKeysPage() {
  return (
    <AuthGuard>
      <APIKeysContent />
    </AuthGuard>
  )
}

function APIKeysContent() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formExpires, setFormExpires] = useState<string>("never")
  const [formPermissions, setFormPermissions] = useState<string[]>([])

  useEffect(() => {
    loadAPIKeys()
  }, [])

  const loadAPIKeys = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/v1/api-keys")
      if (!response.ok) throw new Error("Failed to load API keys")

      const data = await response.json()
      if (data.success) {
        setApiKeys(data.api_keys)
      }
    } catch (error) {
      console.error("Error loading API keys:", error)
      toast.error("Failed to load API keys")
    } finally {
      setIsLoading(false)
    }
  }

  const createAPIKey = async () => {
    if (!formName.trim()) {
      toast.error("Name is required")
      return
    }

    try {
      const expiresInDays = formExpires === "never" ? null : parseInt(formExpires)

      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          expiresInDays,
          permissions: formPermissions.length > 0 ? formPermissions : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to create API key")

      const data = await response.json()
      if (data.success) {
        setNewKey(data.api_key)
        setFormName("")
        setFormDescription("")
        setFormExpires("never")
        setFormPermissions([])
        await loadAPIKeys()
        toast.success("API key created successfully!")
      }
    } catch (error) {
      console.error("Error creating API key:", error)
      toast.error("Failed to create API key")
    }
  }

  const revokeAPIKey = async (apiKey: string, permanent: boolean = false) => {
    if (!confirm(`Are you sure you want to ${permanent ? "permanently delete" : "revoke"} this API key?`)) {
      return
    }

    try {
      const response = await fetch(`/api/v1/api-keys?api_key=${apiKey}&permanent=${permanent}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to revoke API key")

      const data = await response.json()
      if (data.success) {
        await loadAPIKeys()
        toast.success(data.message)
      }
    } catch (error) {
      console.error("Error revoking API key:", error)
      toast.error("Failed to revoke API key")
    }
  }

  const copyToClipboard = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success("Copied to clipboard!")
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const togglePermission = (permission: string) => {
    setFormPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    )
  }

  const getExpiryStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { text: "Never", color: "text-green-600" }

    const expiry = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) return { text: "Expired", color: "text-red-600" }
    if (daysUntilExpiry <= 7) return { text: `${daysUntilExpiry}d`, color: "text-orange-600" }
    if (daysUntilExpiry <= 30) return { text: `${daysUntilExpiry}d`, color: "text-yellow-600" }
    return { text: `${daysUntilExpiry}d`, color: "text-green-600" }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage API keys for programmatic access
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for programmatic access to Broń Vault
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Save Your API Key</AlertTitle>
                  <AlertDescription>
                    This is the only time you'll see this key. Copy it now and store it securely.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Your New API Key</Label>
                  <div className="flex gap-2">
                    <Input value={newKey} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(newKey, -1)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setNewKey(null)
                      setIsCreateDialogOpen(false)
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="My API Key"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires">Expires</Label>
                  <Select value={formExpires} onValueChange={setFormExpires}>
                    <SelectTrigger id="expires">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    {["upload", "search", "download", "stats", "admin"].map((permission) => (
                      <div key={permission} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission}
                          checked={formPermissions.includes(permission)}
                          onCheckedChange={() => togglePermission(permission)}
                        />
                        <Label htmlFor={permission} className="cursor-pointer capitalize">
                          {permission}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createAPIKey}>Create API Key</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{apiKeys.length}</div>
                <div className="text-sm text-muted-foreground">Total Keys</div>
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
                  {apiKeys.filter((k) => k.is_active).length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {apiKeys.filter((k) => k.last_used_at).length}
                </div>
                <div className="text-sm text-muted-foreground">Recently Used</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage your API keys and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading API keys...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys created yet</p>
              <p className="text-sm mt-2">Click "Create API Key" to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  const expiryStatus = getExpiryStatus(key.expires_at)
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{key.name}</div>
                          {key.description && (
                            <div className="text-xs text-muted-foreground">
                              {key.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {key.api_key_preview}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.api_key_preview, key.id)}
                          >
                            {copiedId === key.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.permissions ? (
                          <div className="flex flex-wrap gap-1">
                            {key.permissions.map((perm) => (
                              <Badge key={perm} variant="secondary" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.is_active ? (
                          <Badge variant="default" className="bg-green-500">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(key.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${expiryStatus.color}`}>
                          {expiryStatus.text}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeAPIKey(key.api_key_preview, true)}
                          disabled={!key.is_active}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
          <CardDescription>How to use your API keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Authentication</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Include your API key in the Authorization header:
            </p>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
              curl -H "Authorization: Bearer YOUR_API_KEY" \{"\n"}
              {"  "}https://your-domain.com/api/v1/devices
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Example: Export Credentials</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
              curl -H "Authorization: Bearer YOUR_API_KEY" \{"\n"}
              {"  "}"https://your-domain.com/api/v1/credentials/export?format=url_pass" \{"\n"}
              {"  "}-o credentials.txt
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
