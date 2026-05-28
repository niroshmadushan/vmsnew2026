"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  History, Search, Calendar, Clock, User, CreditCard, 
  CheckCircle, XCircle, AlertTriangle, Download, Eye, RotateCcw
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { placeManagementAPI } from "@/lib/place-management-api"
import toast from "react-hot-toast"

interface PassAssignment {
  id: string
  pass_id: string
  pass_type_id: string
  pass_number: number
  pass_display_name?: string
  pass_type_name?: string
  action_type: string
  holder_name: string
  holder_contact?: string
  holder_type: string
  holder_reference_id?: string
  booking_id?: string
  booking_title?: string
  booking_date?: string
  assigned_by?: string
  assigned_by_name?: string
  assigned_date: string
  expected_return_date?: string
  actual_return_date?: string
  duration_hours?: number
  notes?: string
  visit_purpose?: string
  is_deleted: boolean
  created_at: string
  is_overdue?: boolean
}



export function PassHistoryManagement() {
  const [assignments, setAssignments] = useState<PassAssignment[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<PassAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isManualReturnDialogOpen, setIsManualReturnDialogOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<PassAssignment | null>(null)
  const [manualReturnTime, setManualReturnTime] = useState("")

  useEffect(() => {
    loadAssignments()
  }, [])

  useEffect(() => {
    filterAssignments()
  }, [assignments, searchTerm, actionFilter, dateFilter, startDate, endDate])

  const loadAssignments = async () => {
    try {
      setIsLoading(true)
      
      const [assignmentsRes, passesRes, passTypesRes, bookingsRes, usersRes, externalMembersRes, externalParticipantsRes] = await Promise.all([
        placeManagementAPI.getTableData('pass_assignments', { limit: 5000 }),
        placeManagementAPI.getTableData('passes', { limit: 5000 }),
        placeManagementAPI.getTableData('pass_types', { limit: 100 }),
        placeManagementAPI.getTableData('bookings', { limit: 1000 }),
        placeManagementAPI.getTableData('users', { limit: 500 }),
        placeManagementAPI.getTableData('external_members', { limit: 5000 }),
        placeManagementAPI.getTableData('external_participants', { limit: 5000 })
      ])
      
      const assignmentsList = Array.isArray(assignmentsRes) ? assignmentsRes : []
      const passes = Array.isArray(passesRes) ? passesRes : []
      const passTypes = Array.isArray(passTypesRes) ? passTypesRes : []
      const bookings = Array.isArray(bookingsRes) ? bookingsRes : []
      const users = Array.isArray(usersRes) ? usersRes : []
      const externalMembers = Array.isArray(externalMembersRes) ? externalMembersRes : []
      const externalParticipants = Array.isArray(externalParticipantsRes) ? externalParticipantsRes : []
      
      console.log('📊 Pass Assignments loaded:', assignmentsList.length)
      console.log('📋 Sample assignment:', assignmentsList[0])
      
      // Get today's date for comparison in Sri Lankan timezone (GMT+5:30)
      const now = new Date()
      const sriLankanNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      const today = sriLankanNow.toISOString().split('T')[0]
      
      // Show ALL records from pass_assignments table without consolidation
      const enrichedAssignments = assignmentsList
        .filter((a: any) => (a.is_deleted === false || a.is_deleted === 0))
        .map((assignment: any) => {
          const pass = passes.find((p: any) => p.id === assignment.pass_id)
          const passType = passTypes.find((pt: any) => pt.id === assignment.pass_type_id)
          
          // Priority 1: Use booking_id directly from pass_assignments table
          let booking = null
          if (assignment.booking_id) {
            booking = bookings.find((b: any) => b.id === assignment.booking_id)
          }
          
          // Priority 2: If no booking_id in pass_assignments and holder is external, try to find booking through external_participants or external_members
          if (!booking && assignment.holder_reference_id && (assignment.holder_type === 'external' || assignment.holder_type === 'visitor')) {
            // First, try to find in external_participants table (holder_reference_id might be external_participant.id)
            const externalParticipant = externalParticipants.find((ep: any) => ep.id === assignment.holder_reference_id)
            
            if (externalParticipant && externalParticipant.booking_id) {
              booking = bookings.find((b: any) => b.id === externalParticipant.booking_id)
            }
            
            // If not found, try external_members table (holder_reference_id might be external_member.id)
            if (!booking) {
              const externalMember = externalMembers.find((em: any) => em.id === assignment.holder_reference_id)
              
              // Get booking_id from external_member directly
              if (externalMember && externalMember.booking_id) {
                booking = bookings.find((b: any) => b.id === externalMember.booking_id)
              }
              
              // Also check if external_member has a corresponding external_participant through member_id
              if (!booking && externalMember) {
                const participantByMemberId = externalParticipants.find((ep: any) => ep.member_id === externalMember.id)
                if (participantByMemberId && participantByMemberId.booking_id) {
                  booking = bookings.find((b: any) => b.id === participantByMemberId.booking_id)
                }
              }
            }
          }
          
          const assignedByUser = users.find((u: any) => u.id === assignment.assigned_by)
          
          // Parse booking date
          let bookingDate = booking?.booking_date
          if (bookingDate && typeof bookingDate === 'string') {
            if (bookingDate.includes('T')) {
              const d = new Date(bookingDate)
              bookingDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            } else if (bookingDate.includes(' ')) {
              bookingDate = bookingDate.split(' ')[0]
            }
          }
          
          // Check if this is an overdue assignment (past date, assigned, not returned)
          const assignmentDate = assignment.assigned_date ? assignment.assigned_date.split('T')[0] : null
          const is_overdue = assignment.action_type === 'assigned' && 
                            !assignment.actual_return_date && 
                            ((bookingDate && bookingDate < today) || (assignmentDate && assignmentDate < today))
          
          return {
            ...assignment,
            pass_display_name: pass?.pass_display_name || `Pass #${assignment.pass_number}`,
            pass_type_name: passType?.name || 'Unknown Type',
            // For Ad-hoc visits, show the purpose if no booking title exists
            booking_title: booking?.title || (assignment.visit_purpose ? `Ad-hoc: ${assignment.visit_purpose}` : (assignment.booking_id === null || assignment.booking_id === "" ? 'Ad-hoc Visit' : null)),
            booking_date: bookingDate,
            assigned_by_name: assignedByUser?.full_name || 'System',
            is_overdue
          }
        })
        .sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime())
      
      setAssignments(enrichedAssignments)
    } catch (error) {
      console.error('Failed to load pass assignments:', error)
      toast.error('Failed to load pass history')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter)
    if (filter !== 'custom') {
      setStartDate("")
      setEndDate("")
    }
  }

  const openManualReturnDialog = (assignment: PassAssignment) => {
    setSelectedAssignment(assignment)
    setIsManualReturnDialogOpen(true)
    // Set default return time to now, but user can change it
    setManualReturnTime(new Date().toISOString().slice(0, 16))
  }

  const handleManualReturn = async () => {
    if (!selectedAssignment || !manualReturnTime) {
      toast.error('Please select a return date and time')
      return
    }

    // Validate that the return time is not in the future
    const returnDateTime = new Date(manualReturnTime)
    const now = new Date()
    if (returnDateTime > now) {
      toast.error('Return time cannot be in the future')
      return
    }

    try {
      const userStr = localStorage.getItem('user')
      const currentUser = userStr ? JSON.parse(userStr) : null
      const returnedBy = currentUser?.id || currentUser?.user_id || null

      console.log('🔄 Processing manual return for:', selectedAssignment.pass_display_name)

      // Update the existing assignment record to mark as returned (no new record created)
      await placeManagementAPI.updateRecord('pass_assignments',
        { id: selectedAssignment.id },
        {
          action_type: 'returned',
          actual_return_date: returnDateTime.toISOString()
        }
      )

      // Update pass status to available
      await placeManagementAPI.updateRecord('passes',
        { id: selectedAssignment.pass_id },
        {
          status: 'available',
          current_holder_name: null,
          current_holder_contact: null,
          current_holder_type: null,
          returned_at: returnDateTime.toISOString(),
          updated_by: returnedBy
        }
      )

      toast.success(`Pass ${selectedAssignment.pass_display_name} marked as returned`)
      setIsManualReturnDialogOpen(false)
      setSelectedAssignment(null)
      setManualReturnTime("")
      loadAssignments()
    } catch (error: any) {
      console.error('Failed to process manual return:', error)
      toast.error('Failed to process manual return')
    }
  }

  const filterAssignments = () => {
    let filtered = [...assignments]
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(a => 
        a.holder_name?.toLowerCase().includes(search) ||
        a.pass_display_name?.toLowerCase().includes(search) ||
        a.pass_type_name?.toLowerCase().includes(search) ||
        a.holder_contact?.includes(search) ||
        a.booking_title?.toLowerCase().includes(search) ||
        a.visit_purpose?.toLowerCase().includes(search)
      )
    }
    
    if (actionFilter === 'overdue') {
      filtered = filtered.filter(a => a.is_overdue === true)
    } else if (actionFilter !== 'all') {
      filtered = filtered.filter(a => a.action_type === actionFilter)
    }
    
    // Date filtering
    if (dateFilter !== 'all') {
      const now = new Date()
      
      // Get current date in Sri Lankan timezone (GMT+5:30)
      const sriLankanNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      const today = sriLankanNow.toISOString().split('T')[0]
      const yesterday = new Date(sriLankanNow.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const lastWeek = new Date(sriLankanNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const lastMonth = new Date(sriLankanNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      console.log('🗓️ Date filtering debug (GMT+5:30):', {
        dateFilter,
        today,
        yesterday,
        lastWeek,
        lastMonth,
        actualCurrentTime: now.toISOString(),
        sriLankanTime: sriLankanNow.toISOString(),
        actualCurrentDate: now.toDateString()
      })
      
      filtered = filtered.filter(a => {
        if (!a.assigned_date) return false

        // Convert the assignment date to Sri Lankan timezone for comparison
        // This ensures records created late in the day (UTC) are correctly classified in Sri Lankan "Today"
        const date = new Date(a.assigned_date)
        const slDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
        const assignmentDateStr = slDate.toISOString().split('T')[0]
        
        console.log('🔍 Date filter comparison:', {
          dateFilter,
          assignmentDateStr,
          today,
          yesterday,
          lastWeek,
          lastMonth,
          isToday: assignmentDateStr === today,
          isYesterday: assignmentDateStr === yesterday,
          isLastWeek: assignmentDateStr >= lastWeek && assignmentDateStr <= today,
          isLastMonth: assignmentDateStr >= lastMonth && assignmentDateStr <= today
        })
        
        switch (dateFilter) {
          case 'today':
            return assignmentDateStr === today
          case 'yesterday':
            return assignmentDateStr === yesterday
          case 'last_week':
            return assignmentDateStr >= lastWeek && assignmentDateStr <= today
          case 'last_month':
            return assignmentDateStr >= lastMonth && assignmentDateStr <= today
          case 'custom':
            if (startDate && endDate) {
              return assignmentDateStr >= startDate && assignmentDateStr <= endDate
            } else if (startDate) {
              return assignmentDateStr >= startDate
            } else if (endDate) {
              return assignmentDateStr <= endDate
            }
            return true
          default:
            return true
        }
      })
    }
    
    setFilteredAssignments(filtered)
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'assigned':
        return <Badge className="bg-green-500 dark:bg-green-600 text-white text-[11px]">ASSIGNED</Badge>
      case 'returned':
        return <Badge className="bg-blue-500 dark:bg-blue-600 text-white text-[11px]">RETURNED</Badge>
      case 'lost':
        return <Badge className="bg-red-500 dark:bg-red-600 text-white text-[11px]">LOST</Badge>
      case 'damaged':
        return <Badge className="bg-orange-500 dark:bg-orange-600 text-white text-[11px]">DAMAGED</Badge>
      default:
        return <Badge className="bg-gray-500 dark:bg-gray-600 text-white text-[11px]">{action.toUpperCase()}</Badge>
    }
  }

  const calculateDuration = (assignedDate: string, returnDate?: string) => {
    if (!returnDate) return 'Ongoing'
    
    const start = new Date(assignedDate)
    const end = new Date(returnDate)
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins} mins`
    
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  const totalAssigned = assignments.filter(a => a.action_type === 'assigned').length
  const totalReturned = assignments.filter(a => a.action_type === 'returned').length
  const totalLost = assignments.filter(a => a.action_type === 'lost').length
  const currentlyAssigned = assignments.filter(a => a.action_type === 'assigned' && !a.actual_return_date).length
  const overdueCount = assignments.filter(a => a.is_overdue === true).length

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
          <h2 className="text-2xl font-bold tracking-tight">Pass Assignments</h2>
          <p className="text-muted-foreground">
            Complete record of all visitor pass assignments and returns
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssigned}</div>
            <p className="text-xs text-muted-foreground">{currentlyAssigned} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returned</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReturned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lost</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalLost}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-muted/20"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center border rounded-md p-1 bg-muted/20">
                <Button
                  size="sm"
                  variant={actionFilter === 'all' ? 'secondary' : 'ghost'}
                  onClick={() => setActionFilter('all')}
                  className="h-7 text-xs"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={actionFilter === 'assigned' ? 'secondary' : 'ghost'}
                  onClick={() => setActionFilter('assigned')}
                  className="h-7 text-xs"
                >
                  Assigned
                </Button>
                <Button
                  size="sm"
                  variant={actionFilter === 'returned' ? 'secondary' : 'ghost'}
                  onClick={() => setActionFilter('returned')}
                  className="h-7 text-xs"
                >
                  Returned
                </Button>
                <Button
                  size="sm"
                  variant={actionFilter === 'overdue' ? 'secondary' : 'ghost'}
                  onClick={() => setActionFilter('overdue')}
                  className="h-7 text-xs text-orange-600"
                >
                  Overdue
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap border-t pt-3">
            <span className="text-xs font-semibold text-muted-foreground mr-2">DATE RANGE:</span>
            {['all', 'today', 'last_week', 'custom'].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={dateFilter === d ? 'secondary' : 'ghost'}
                onClick={() => handleDateFilterChange(d)}
                className="h-7 text-xs capitalize"
              >
                {d.replace('_', ' ')}
              </Button>
            ))}
            {dateFilter === 'custom' && (
              <div className="flex gap-2 items-center ml-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-7 w-32 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-7 w-32 text-xs" />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-md border mx-4 mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-left font-medium">Pass</th>
                  <th className="p-3 text-left font-medium">Action</th>
                  <th className="p-3 text-left font-medium">Visitor</th>
                  <th className="p-3 text-left font-medium">Description</th>
                  <th className="p-3 text-center font-medium">Issued</th>
                  <th className="p-3 text-center font-medium">Returned</th>
                  <th className="p-3 text-center font-medium">Duration</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">
                      <Badge variant="outline" className="font-mono">
                        {assignment.pass_display_name}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {getActionBadge(assignment.action_type)}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{assignment.holder_name}</span>
                        <span className="text-xs text-muted-foreground">{assignment.holder_contact}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-muted-foreground">{assignment.booking_title}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col">
                        <span>{new Date(assignment.assigned_date).toLocaleDateString()}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(assignment.assigned_date).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {assignment.actual_return_date ? (
                        <div className="flex flex-col">
                          <span>{new Date(assignment.actual_return_date).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(assignment.actual_return_date).toLocaleTimeString()}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Active</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs font-mono">
                        {calculateDuration(assignment.assigned_date, assignment.actual_return_date)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {assignment.is_overdue && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openManualReturnDialog(assignment)}
                          className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Return Pass"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Return Time Dialog */}
      <Dialog open={isManualReturnDialogOpen} onOpenChange={setIsManualReturnDialogOpen}>
        <DialogContent className="max-w-md dark:bg-card dark:border-border">
          <DialogHeader className="dark:border-border/50">
            <DialogTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-400 text-[13px] font-semibold">
              <div className="p-2 bg-orange-100 dark:bg-orange-950/20 rounded-full">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              Set Return Time
            </DialogTitle>
          </DialogHeader>
          
          {selectedAssignment && (
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-[13px] font-medium text-orange-900 dark:text-orange-300 mb-2.5">
                  ⚠ This pass was assigned for a past date but never returned systematically.
                </p>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground dark:text-muted-foreground">Pass:</span>
                    <Badge className="bg-blue-600 dark:bg-blue-600 text-white font-bold text-[12px]">
                      {selectedAssignment.pass_display_name}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground dark:text-muted-foreground">Holder:</span>
                    <span className="font-bold dark:text-foreground">{selectedAssignment.holder_name}</span>
                  </div>
                  {selectedAssignment.booking_title && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground dark:text-muted-foreground">Booking:</span>
                      <span className="font-medium dark:text-foreground">{selectedAssignment.booking_title}</span>
                    </div>
                  )}
                  {selectedAssignment.booking_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground dark:text-muted-foreground">Booking Date:</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {(() => {
                          const date = new Date(selectedAssignment.booking_date)
                          const sriLankanDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
                          return sriLankanDate.toLocaleDateString('en-LK', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="returnTime" className="text-[13px] dark:text-foreground">When was the pass actually returned? *</Label>
                <Input
                  id="returnTime"
                  type="datetime-local"
                  value={manualReturnTime}
                  onChange={(e) => setManualReturnTime(e.target.value)}
                  max={new Date().toISOString().slice(0, 16)}
                  className="mt-1.5 h-9 text-[13px] dark:bg-card dark:border-border dark:text-foreground"
                />
                <p className="text-[12px] text-muted-foreground dark:text-muted-foreground mt-1">
                  ⚠ Cannot be in the future. Select when the visitor actually returned the pass.
                </p>
              </div>

              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-[12px] text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Pass will be marked as available for future assignments
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsManualReturnDialogOpen(false)
                    setSelectedAssignment(null)
                    setManualReturnTime("")
                  }}
                  className="h-9 px-3 text-[13px] dark:border-border dark:text-foreground dark:hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleManualReturn}
                  className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 h-9 px-3 text-[13px]"
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Return
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
