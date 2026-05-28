"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { RouteProtection } from "@/components/auth/route-protection"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  Plus, Edit, Trash2, Eye, CreditCard, TrendingUp,
  CheckCircle, XCircle, AlertCircle, Ticket, Grid3x3, AlertTriangle, Loader2
} from "lucide-react"
import { placeManagementAPI } from "@/lib/place-management-api"
import toast from "react-hot-toast"

interface PassType {
  id: string
  name: string
  description?: string
  color: string
  prefix?: string
  min_number: number
  max_number: number
  total_passes: number
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
}

interface PassTypeStats {
  pass_type_id: string
  pass_type_name: string
  prefix: string
  total_passes: number
  available_count: number
  assigned_count: number
  lost_count: number
  damaged_count: number
  utilization_percentage: number
}




function PassTypesContent() {
  const [passTypes, setPassTypes] = useState<PassType[]>([])
  const [stats, setStats] = useState<PassTypeStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPassType, setEditingPassType] = useState<PassType | null>(null)
  const [viewingPassType, setViewingPassType] = useState<PassType | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [passTypeToDelete, setPassTypeToDelete] = useState<PassType | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    prefix: "",
    min_number: 1,
    max_number: 10
  })

  useEffect(() => {
    loadPassTypes()
  }, [])

  const loadPassTypes = async () => {
    try {
      setIsLoading(true)
      const response = await placeManagementAPI.getTableData('pass_types', { limit: 500 })
      const types = Array.isArray(response) ?
        response.filter((pt: any) => !pt.is_deleted) : []
      setPassTypes(types)

      // Load statistics
      await loadStatistics()
    } catch (error) {
      toast.error('Failed to load pass types')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      // This would ideally call the view, but we'll calculate from passes table
      const passesResponse = await placeManagementAPI.getTableData('passes', { limit: 5000 })
      const passes = Array.isArray(passesResponse) ?
        passesResponse.filter((p: any) => !p.is_deleted) : []

      // Group by pass_type_id
      const statsMap: { [key: string]: PassTypeStats } = {}

      passes.forEach((pass: any) => {
        if (!statsMap[pass.pass_type_id]) {
          statsMap[pass.pass_type_id] = {
            pass_type_id: pass.pass_type_id,
            pass_type_name: '',
            prefix: '',
            total_passes: 0,
            available_count: 0,
            assigned_count: 0,
            lost_count: 0,
            damaged_count: 0,
            utilization_percentage: 0
          }
        }

        statsMap[pass.pass_type_id].total_passes++
        if (pass.status === 'available') statsMap[pass.pass_type_id].available_count++
        if (pass.status === 'assigned') statsMap[pass.pass_type_id].assigned_count++
        if (pass.status === 'lost') statsMap[pass.pass_type_id].lost_count++
        if (pass.status === 'damaged') statsMap[pass.pass_type_id].damaged_count++
      })

      // Calculate utilization
      Object.keys(statsMap).forEach(key => {
        const stat = statsMap[key]
        stat.utilization_percentage = stat.total_passes > 0
          ? Math.round((stat.assigned_count / stat.total_passes) * 100)
          : 0
      })

      setStats(Object.values(statsMap))
    } catch (error) {
      console.error('Failed to load statistics:', error)
    }
  }

  const handleOpenDialog = (passType?: PassType) => {
    if (passType) {
      setEditingPassType(passType)
      setFormData({
        name: passType.name,
        description: passType.description || "",
        color: passType.color,
        prefix: passType.prefix || "",
        min_number: passType.min_number,
        max_number: passType.max_number
      })
    } else {
      setEditingPassType(null)
      setFormData({
        name: "",
        description: "",
        color: "#3B82F6",
        prefix: "",
        min_number: 1,
        max_number: 10
      })
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (formData.min_number < 1) {
      toast.error('Minimum number must be at least 1')
      return
    }

    if (formData.max_number < formData.min_number) {
      toast.error('Maximum number must be greater than or equal to minimum number')
      return
    }

    try {
      if (editingPassType) {
        // Update existing pass type
        await placeManagementAPI.updateRecord('pass_types',
          { id: editingPassType.id },
          {
            name: formData.name,
            description: formData.description,
            color: formData.color,
            prefix: formData.prefix,
            min_number: formData.min_number,
            max_number: formData.max_number
          }
        )

        // If prefix changed, update all pass display names
        if (formData.prefix !== editingPassType.prefix) {
          console.log('🔄 Prefix changed, updating all pass display names...')
          await updateAllPassDisplayNames(editingPassType.id, formData.prefix || '')
        }

        // If range changed, we need to add/remove passes
        if (formData.min_number !== editingPassType.min_number ||
          formData.max_number !== editingPassType.max_number) {
          await updatePassRange(editingPassType.id, formData.min_number, formData.max_number, formData.prefix || '')
        }

        toast.success('Pass type updated successfully')
      } else {
        // Create new pass type
        const passTypeResult = await placeManagementAPI.insertRecord('pass_types', {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          prefix: formData.prefix,
          min_number: formData.min_number,
          max_number: formData.max_number,
          is_active: true,
          is_deleted: false
        })

        console.log('✅ Pass type created:', passTypeResult)

        // Get the ID from the response
        const newPassTypeId = passTypeResult.id || passTypeResult.insertId || passTypeResult.data?.id

        console.log('🆔 New pass type ID:', newPassTypeId)

        if (!newPassTypeId) {
          console.error('❌ Failed to get pass type ID from result:', passTypeResult)
          toast.error('Pass type created but failed to generate passes. Please check the database.')
          setIsDialogOpen(false)
          loadPassTypes()
          return
        }

        // Generate passes
        console.log(`📝 Generating ${formData.max_number - formData.min_number + 1} passes...`)
        await generatePasses(newPassTypeId, formData.min_number, formData.max_number, formData.prefix || '')

        toast.success(`Pass type created with ${formData.max_number - formData.min_number + 1} passes`)
      }

      setIsDialogOpen(false)
      loadPassTypes()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save pass type')
    }
  }

  const updateAllPassDisplayNames = async (passTypeId: string, newPrefix: string) => {
    try {
      console.log('📝 Updating pass display names for pass_type_id:', passTypeId, 'with prefix:', newPrefix)

      // Get all passes for this pass type
      const response = await placeManagementAPI.getTableData('passes', { limit: 5000 })
      const allPasses = Array.isArray(response) ? response : []

      const passesToUpdate = allPasses.filter((p: any) =>
        p.pass_type_id === passTypeId &&
        (p.is_deleted === false || p.is_deleted === 0)
      )

      console.log(`📋 Found ${passesToUpdate.length} passes to update`)

      let updateCount = 0
      for (const pass of passesToUpdate) {
        const newDisplayName = newPrefix
          ? `${newPrefix}-${String(pass.pass_number).padStart(3, '0')}`
          : String(pass.pass_number).padStart(3, '0')

        // Only update if display name actually changed
        if (pass.pass_display_name !== newDisplayName) {
          await placeManagementAPI.updateRecord('passes',
            { id: pass.id },
            { pass_display_name: newDisplayName }
          )
          updateCount++
        }
      }

      console.log(`✅ Updated ${updateCount} pass display names`)
      toast.success(`Updated ${updateCount} pass display names`)
    } catch (error) {
      console.error('❌ Failed to update pass display names:', error)
      toast.error('Failed to update pass display names')
    }
  }

  const generatePasses = async (passTypeId: string, minNum: number, maxNum: number, prefix: string) => {
    console.log('🎫 generatePasses called with:', { passTypeId, minNum, maxNum, prefix })

    if (!passTypeId) {
      console.error('❌ passTypeId is missing or undefined!')
      throw new Error('Pass type ID is required to generate passes')
    }

    const passes = []
    for (let i = minNum; i <= maxNum; i++) {
      const displayName = prefix ? `${prefix}-${String(i).padStart(3, '0')}` : String(i).padStart(3, '0')
      const passData = {
        pass_type_id: passTypeId,
        pass_number: i,
        pass_display_name: displayName,
        status: 'available',
        is_active: true,
        is_deleted: false
      }
      passes.push(passData)
    }

    console.log(`📋 Created ${passes.length} pass objects`)
    console.log('📊 Sample pass:', passes[0])

    // Batch insert
    let successCount = 0
    for (const pass of passes) {
      try {
        const result = await placeManagementAPI.insertRecord('passes', pass)
        successCount++

        if (successCount === 1) {
          console.log('✅ First pass inserted successfully:', result)
        }
      } catch (error) {
        console.error('❌ Failed to insert pass:', pass, error)
        throw error
      }
    }

    console.log(`✅ Successfully inserted ${successCount} passes`)
  }

  const updatePassRange = async (passTypeId: string, newMin: number, newMax: number, prefix: string) => {
    // Get ALL passes for this type, including deleted ones
    const response = await placeManagementAPI.getTableData('passes', { limit: 5000 })
    const allTypePasses = Array.isArray(response) ?
      response.filter((p: any) => p.pass_type_id === passTypeId) : []

    // Map for quick lookup of existing pass numbers
    const existingPassMap = new Map();
    allTypePasses.forEach((p: any) => existingPassMap.set(p.pass_number, p));

    console.log(`🔄 Updating pass range: ${newMin}-${newMax} (Existing: ${allTypePasses.length})`)

    // 1. Handle passes within new range (Create or Update)
    for (let i = newMin; i <= newMax; i++) {
      const displayName = prefix ? `${prefix}-${String(i).padStart(3, '0')}` : String(i).padStart(3, '0')
      const existingPass = existingPassMap.get(i);

      if (existingPass) {
        // Pass exists: Update display name if changed, or reactivate if deleted
        const updates: any = {};

        // Check display name
        if (existingPass.pass_display_name !== displayName) {
          updates.pass_display_name = displayName;
        }

        // Check reactivation (if it was deleted)
        // Check for both boolean true and numeric 1
        const isDeleted = existingPass.is_deleted === true || existingPass.is_deleted === 1;
        if (isDeleted) {
          updates.is_deleted = false;
          updates.is_active = true;
          // Reset status to available if it was deleted
          updates.status = 'available';
        }

        if (Object.keys(updates).length > 0) {
          await placeManagementAPI.updateRecord('passes',
            { id: existingPass.id },
            updates
          )
        }
      } else {
        // Pass does not exist: Create it
        const passData = {
          pass_type_id: passTypeId,
          pass_number: i,
          pass_display_name: displayName,
          status: 'available',
          is_active: true,
          is_deleted: false
        }
        await placeManagementAPI.insertRecord('passes', passData)
      }
    }

    // 2. Handle passes OUTSIDE new range (Soft Delete)
    for (const pass of allTypePasses) {
      if ((pass.pass_number < newMin || pass.pass_number > newMax)) {
        // Only soft delete if it's currently 'available' (don't delete assigned/lost passes)
        // Also check if not already deleted to avoid redundant calls
        const isDeleted = pass.is_deleted === true || pass.is_deleted === 1;

        if (!isDeleted && pass.status === 'available') {
          await placeManagementAPI.softDeleteRecord('passes', pass.id)
        }
      }
    }
  }

  const openDeleteDialog = (passType: PassType) => {
    setPassTypeToDelete(passType)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!passTypeToDelete) return

    try {
      setIsDeleting(true)
      await placeManagementAPI.softDeleteRecord('pass_types', passTypeToDelete.id)
      toast.success('Pass type deleted successfully')
      setIsDeleteDialogOpen(false)
      setPassTypeToDelete(null)
      loadPassTypes()
    } catch (error: any) {
      console.error('Error deleting pass type:', error)
      toast.error(error?.message || 'Failed to delete pass type')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleView = (passType: PassType) => {
    setViewingPassType(passType)
    setIsViewDialogOpen(true)
  }

  const getStatsForType = (passTypeId: string): PassTypeStats | null => {
    return stats.find(s => s.pass_type_id === passTypeId) || null
  }

  const totalPassTypes = passTypes.length
  const activePassTypes = passTypes.filter(pt => pt.is_active).length
  const totalPasses = passTypes.reduce((sum, pt) => sum + pt.total_passes, 0)
  const totalAssigned = stats.reduce((sum, s) => sum + s.assigned_count, 0)
  const totalAvailable = stats.reduce((sum, s) => sum + s.available_count, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 dark:bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 dark:border-blue-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pass Categories</h2>
          <p className="text-muted-foreground">
            Manage your visitor pass types and their ID ranges
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
            <Grid3x3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPassTypes}</div>
            <p className="text-xs text-muted-foreground">
              {activePassTypes} active categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passes</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPasses}</div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalAvailable}</div>
            <p className="text-xs text-muted-foreground">
              Ready to be assigned
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Assigned</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalAssigned}</div>
            <p className="text-xs text-muted-foreground">
              Active pass usage
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {passTypes.map((pt) => {
          const ptStats = getStatsForType(pt.id)
          return (
            <Card key={pt.id} className="overflow-hidden">
              <div 
                className="h-2 w-full" 
                style={{ backgroundColor: pt.color }}
              />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{pt.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 font-mono">
                      {pt.prefix || 'No Prefix'}
                    </Badge>
                  </div>
                  <Badge variant={pt.is_active ? "success" : "secondary"}>
                    {pt.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {pt.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pt.description}
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Range</p>
                    <p className="font-medium">{pt.min_number} - {pt.max_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Total Tokens</p>
                    <p className="font-medium">{pt.total_passes}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Available: <span className="font-bold text-emerald-600">{ptStats?.available_count || 0}</span></span>
                    <span>Assigned: <span className="font-bold text-blue-600">{ptStats?.assigned_count || 0}</span></span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all" 
                      style={{ width: `${ptStats?.utilization_percentage || 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-right text-muted-foreground uppercase font-bold">
                    Utilization: {ptStats?.utilization_percentage || 0}%
                  </p>
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleView(pt)}
                  >
                    <Eye className="h-4 w-4 mr-2" /> View Details
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleOpenDialog(pt)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(pt)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPassType ? 'Edit Pass Type' : 'Add New Pass Type'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. VIP Pass"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">ID Prefix (Optional)</Label>
                <Input
                  id="prefix"
                  value={formData.prefix}
                  onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. VIP"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this pass type"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Theme Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 p-1 h-9"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_number">Min Number *</Label>
                <Input
                  id="min_number"
                  type="number"
                  min="1"
                  value={formData.min_number}
                  onChange={(e) => setFormData({ ...formData, min_number: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_number">Max Number *</Label>
                <Input
                  id="max_number"
                  type="number"
                  min={formData.min_number}
                  value={formData.max_number}
                  onChange={(e) => setFormData({ ...formData, max_number: parseInt(e.target.value) || 10 })}
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p className="font-semibold text-muted-foreground text-xs uppercase">Preview</p>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Badge style={{ backgroundColor: formData.color, color: '#fff' }}>
                    {formData.prefix || '#'}{String(formData.min_number).padStart(3, '0')}
                  </Badge>
                  <span className="text-muted-foreground">-</span>
                  <Badge style={{ backgroundColor: formData.color, color: '#fff' }}>
                    {formData.prefix || '#'}{String(formData.max_number).padStart(3, '0')}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className="font-bold">{formData.max_number - formData.min_number + 1}</span>
                  <span className="text-muted-foreground ml-1">passes</span>
                </div>
              </div>
            </div>

            {editingPassType && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-800 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>Changing the range will automatically create or delete passes to match the new range.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPassType ? 'Update Pass Type' : 'Create Pass Type'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          {viewingPassType && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: viewingPassType.color }}
                >
                  <Ticket className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">{viewingPassType.name}</DialogTitle>
                  <p className="text-muted-foreground">Detailed category information</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">ID Prefix</p>
                  <p className="text-lg font-medium">{viewingPassType.prefix || 'None'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">Theme Color</p>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: viewingPassType.color }} />
                    <span className="font-mono">{viewingPassType.color}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">ID Range</p>
                  <p className="text-lg font-medium">{viewingPassType.min_number} - {viewingPassType.max_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">Total Passes</p>
                  <p className="text-lg font-medium">{viewingPassType.total_passes}</p>
                </div>
              </div>

              {viewingPassType.description && (
                <div className="space-y-1 pt-2">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">Description</p>
                  <p className="p-3 bg-muted rounded-lg text-sm">{viewingPassType.description}</p>
                </div>
              )}

              {getStatsForType(viewingPassType.id) && (
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-center">
                    <p className="text-xs text-emerald-700 uppercase font-bold mb-1">Available</p>
                    <p className="text-xl font-bold text-emerald-800">{getStatsForType(viewingPassType.id)!.available_count}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
                    <p className="text-xs text-blue-700 uppercase font-bold mb-1">Assigned</p>
                    <p className="text-xl font-bold text-blue-800">{getStatsForType(viewingPassType.id)!.assigned_count}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Utilization</p>
                    <p className="text-xl font-bold">{getStatsForType(viewingPassType.id)!.utilization_percentage}%</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false)
                  handleOpenDialog(viewingPassType)
                }}>
                  Edit Category
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Pass Type
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-bold text-foreground">"{passTypeToDelete?.name}"</span>? 
              This action cannot be undone and will soft-delete all associated pass data.
            </p>
            {passTypeToDelete && (
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Prefix:</span>
                  <span className="font-bold">{passTypeToDelete.prefix || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Passes:</span>
                  <span className="font-bold">{passTypeToDelete.total_passes}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setPassTypeToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Category'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PassTypesPage() {
  return (
    <RouteProtection requiredRole="admin">
      <DashboardLayout title="Pass Types" subtitle="Manage pass types and pass ranges">
        <PassTypesContent />
      </DashboardLayout>
    </RouteProtection>
  )
}
