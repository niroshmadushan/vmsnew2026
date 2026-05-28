"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, Clock, MapPin, Users, User as UserIcon, Trash2, Utensils, AlertTriangle } from "lucide-react"
import { placeManagementAPI } from "@/lib/place-management-api"
import toast from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"

interface Booking {
  id: string
  bookingRefId?: string
  title: string
  description?: string
  date: string
  place: string
  placeId?: string
  startTime: string
  endTime: string
  responsiblePersonName?: string
  responsiblePersonEmail?: string
  createdBy?: string
  created_by?: string
  selectedEmployees: any[]
  externalParticipants: any[]
  refreshments?: { required: boolean; type: string; servingTime?: string }
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  totalParticipantsCount?: number
}

export function TimelineView() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState("")
  const [confirmMessage, setConfirmMessage] = useState("")
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setIsLoading(true)

      // Calculate today's date in local timezone to ensure correct filtering
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`

      let allBookingsData: any[] = []
      let currentPage = 1
      let keepFetching = true

      while (keepFetching) {
        const bookingsResponse = await placeManagementAPI.getTableData('bookings', {
          filters: [
            { column: 'is_deleted', operator: 'equals', value: 0 },
            { column: 'booking_date', operator: 'equals', value: today }
          ],
          limit: 100,
          page: currentPage
        })

        const pageData = Array.isArray(bookingsResponse) ? bookingsResponse : []
        if (pageData.length > 0) {
          allBookingsData = [...allBookingsData, ...pageData]
        }

        if (pageData.length < 100) {
          keepFetching = false
        } else {
          currentPage++
          if (currentPage > 20) keepFetching = false // Safety cap at 2000 records
        }
      }

      const formattedBookings: Booking[] = allBookingsData
        .map(b => {
          let bookingDate = b.booking_date

          // Normalize date format
          if (typeof bookingDate === 'string') {
            if (bookingDate.includes('T')) {
              const d = new Date(bookingDate)
              const year = d.getFullYear()
              const month = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              bookingDate = `${year}-${month}-${day}`
            } else if (bookingDate.includes(' ')) {
              bookingDate = bookingDate.split(' ')[0]
            }
          } else if (bookingDate instanceof Date) {
            const d = new Date(bookingDate)
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            bookingDate = `${year}-${month}-${day}`
          }

          return {
            id: b.id,
            bookingRefId: b.booking_ref_id,
            title: b.title,
            description: b.description,
            date: bookingDate || '',
            place: b.place_name || 'Unknown',
            placeId: b.place_id,
            startTime: b.start_time?.substring(0, 5) || '',
            endTime: b.end_time?.substring(0, 5) || '',
            status: b.status === 'in_progress' ? 'ongoing' : b.status,
            createdBy: b.created_by,
            created_by: b.created_by,
            responsiblePersonName: b.responsible_person_name,
            responsiblePersonEmail: b.responsible_person_email,
            selectedEmployees: [],
            externalParticipants: [],
            totalParticipantsCount: b.total_participants || 0,
            refreshments: b.refreshments_required ? {
              required: true,
              type: 'REFRESHMENTS',
              servingTime: ''
            } : undefined
          }
        })
        .filter(b => b.date === today) // Robust client-side filter as backup for server
        .sort((a, b) => a.startTime.localeCompare(b.startTime))

      setBookings(formattedBookings)
      setIsLoading(false)
    } catch (error) {
      toast.error('Failed to load bookings. Please try again.', {
        position: 'top-center',
        duration: 4000
      })
      setIsLoading(false)
    }
  }

  const isBookingOngoing = (booking: Booking) => {
    if (booking.status === "cancelled") {
      return false
    }

    // Since we now only fetch today's bookings, we just check the time
    const now = currentTime
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    return booking.startTime <= currentTimeStr && booking.endTime > currentTimeStr
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case "upcoming":
        return { className: "bg-orange-500 text-white hover:bg-orange-600" }
      case "ongoing":
      case "in_progress":
        return { className: "bg-green-500 text-white hover:bg-green-600" }
      case "completed":
        return { className: "bg-blue-500 text-white hover:bg-blue-600" }
      case "cancelled":
        return { className: "bg-red-500 text-white hover:bg-red-600" }
      default:
        return { className: "bg-gray-500 text-white hover:bg-gray-600" }
    }
  }

  // Check if current user can cancel this booking
  const canCancelBooking = (booking: Booking): boolean => {
    if (!user) return false

    // Check if user created the booking
    const userCreatedBooking = String(booking.createdBy) === String(user.id) ||
      String(booking.created_by) === String(user.id)

    // Check if user is the responsible person (by email)
    const userEmail = user.email?.toLowerCase().trim() || ''
    const responsibleEmail = String(booking.responsiblePersonEmail || '').toLowerCase().trim()

    const isResponsiblePerson = userEmail && responsibleEmail && userEmail === responsibleEmail

    return !!userCreatedBooking || !!isResponsiblePerson
  }

  const handleCancel = (booking: Booking) => {
    if (booking.status === "completed" || booking.status === "cancelled") {
      toast.error(`Cannot cancel ${booking.status} bookings`, { position: 'top-center', duration: 3000, icon: '🚫' })
      return
    }

    if (!canCancelBooking(booking)) {
      toast.error('You can only cancel bookings that you created or where you are the responsible person', {
        position: 'top-center',
        duration: 3000,
        icon: '🚫'
      })
      return
    }

    if (!booking.id || booking.id.trim() === '') {
      toast.error('Invalid booking. Cannot cancel booking.', { position: 'top-center', duration: 3000 })
      return
    }

    setConfirmTitle("Cancel Booking")
    setConfirmMessage(`Are you sure you want to cancel "${booking.title}"? This action cannot be undone.`)
    setConfirmAction(() => async () => {
      try {
        const whereCondition = { id: String(booking.id).trim() }
        const updateData = { status: 'cancelled' }

        await placeManagementAPI.updateRecord('bookings', whereCondition, updateData)
        toast.success('Booking cancelled successfully', { position: 'top-center', duration: 3000 })
        fetchBookings()
        setIsConfirmDialogOpen(false)
      } catch (error: any) {
        toast.error('Failed to cancel booking. Please try again.', { position: 'top-center', duration: 4000 })
      }
    })
    setIsConfirmDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card className="dark:bg-card dark:border-border">
        <CardContent className="py-12 dark:bg-card">
          <div className="text-center">
            <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground dark:text-muted-foreground" />
            <p className="dark:text-foreground">Loading today's bookings...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3 px-2 sm:px-4 max-w-[98vw] mx-auto dark:bg-background">
        {/* Compact Header with Current Time */}
        <div className="flex items-center justify-between pb-2 border-b border-border/50 dark:border-border">
          <div>
            <CardTitle className="flex items-center gap-2 text-[13px] font-semibold dark:text-foreground">
              <Clock className="h-4 w-4" />
              Today's Timeline View
            </CardTitle>
            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-lg shadow-md">
            <div className="text-center">
              <p className="text-[10px] text-white/80 mb-0.5">Current Time</p>
              <p className="text-lg font-bold text-white font-mono tabular-nums">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </p>
              <p className="text-[10px] text-white/70 mt-0.5">
                {currentTime.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        <Card className="dark:bg-card dark:border-border shadow-md">
          <CardContent className="p-3 dark:bg-card">
            {bookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground dark:text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">No bookings found</p>
              </div>
            ) : (
              <div className="relative">
                <div className="max-h-[calc(10*80px)] overflow-y-auto table-scroll-container-vertical space-y-3 pr-2">
                  {bookings.map((booking, index) => {
                    const isCancelled = booking.status === 'cancelled'
                    const isOngoing = isBookingOngoing(booking)
                    const isCompleted = booking.status === 'completed'

                    // Colors based on status
                    const getStatusColors = () => {
                      if (isCancelled) {
                        return {
                          connector: 'bg-red-300/30 dark:bg-red-900/30',
                          timeText: 'text-red-600 dark:text-red-400',
                          dot: 'bg-red-500 shadow-lg',
                          cardBorder: 'border-red-500 dark:border-red-900',
                          cardBg: 'bg-red-50/50 dark:bg-red-950/10',
                          title: 'text-red-900 dark:text-red-200',
                          icon: 'text-red-500 dark:text-red-400'
                        }
                      } else if (isOngoing) {
                        return {
                          connector: 'bg-green-300/30 dark:bg-green-900/30',
                          timeText: 'text-green-600 dark:text-green-400 font-bold',
                          dot: 'bg-green-500 shadow-xl shadow-green-500/50',
                          cardBorder: 'border-green-500 dark:border-green-800',
                          cardBg: 'bg-green-50/50 dark:bg-green-950/10',
                          title: 'text-green-900 dark:text-green-200',
                          icon: 'text-green-500 dark:text-green-400'
                        }
                      } else if (isCompleted) {
                        return {
                          connector: 'bg-blue-300/30 dark:bg-blue-900/30',
                          timeText: 'text-blue-600 dark:text-blue-400',
                          dot: 'bg-blue-500 shadow-lg',
                          cardBorder: 'border-blue-500 dark:border-blue-900',
                          cardBg: 'bg-blue-50/50 dark:bg-blue-950/10',
                          title: 'text-blue-900 dark:text-blue-200',
                          icon: 'text-blue-500 dark:text-blue-400'
                        }
                      } else {
                        return {
                          connector: 'bg-orange-300/30 dark:bg-orange-900/30',
                          timeText: 'text-orange-600 dark:text-orange-400',
                          dot: 'bg-orange-500 shadow-lg',
                          cardBorder: 'border-orange-500 dark:border-orange-900',
                          cardBg: 'bg-orange-50/50 dark:bg-orange-950/10',
                          title: 'text-orange-900 dark:text-orange-200',
                          icon: 'text-orange-500 dark:text-orange-400'
                        }
                      }
                    }

                    const colors = getStatusColors()

                    return (
                      <div key={booking.id} className="relative">
                        {index < bookings.length - 1 && (
                          <div className={`absolute left-4 top-16 bottom-0 w-0.5 h-4 ${colors.connector}`} />
                        )}

                        <div className="relative flex gap-3 group">
                          {/* Date & Time */}
                          <div className="flex-shrink-0 w-24 pt-1">
                            <div className="text-right text-[11px] font-bold text-muted-foreground mb-1">
                              {booking.date}
                            </div>
                            <div className={`text-right text-[13px] font-semibold ${colors.timeText}`}>
                              {booking.startTime}
                            </div>
                            <div className="text-right text-[11px] text-muted-foreground">
                              {booking.endTime}
                            </div>
                          </div>

                          {/* Dot */}
                          <div className="relative flex-shrink-0">
                            {isOngoing && !isCancelled && (
                              <div className="absolute inset-0 w-8 h-8 rounded-full bg-green-400 opacity-75 animate-ping"></div>
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${colors.dot}`}>
                              {isCancelled ? <AlertTriangle className="h-4 w-4 text-white" /> :
                                isOngoing ? <Clock className="h-4 w-4 text-white animate-pulse" /> :
                                  isCompleted ? <div className="text-white text-xs font-bold">✓</div> :
                                    <Calendar className="h-4 w-4 text-white" />}
                            </div>
                          </div>

                          {/* Info Card */}
                          <div className={`flex-1 rounded-lg border p-3 transition-all ${colors.cardBorder} ${colors.cardBg} hover:shadow-md`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {booking.bookingRefId && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                      {booking.bookingRefId}
                                    </Badge>
                                  )}
                                  <h3 className={`text-[13px] font-bold truncate ${colors.title}`}>
                                    {booking.title}
                                  </h3>
                                </div>
                                {booking.description && (
                                  <p className="text-[11px] text-muted-foreground truncate">{booking.description}</p>
                                )}
                              </div>
                              <Badge {...getStatusBadgeProps(booking.status)} className="text-[10px] px-2 py-0.5 flex-shrink-0">
                                {isOngoing ? "LIVE" : booking.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                              <div className="flex items-center gap-1.5">
                                <MapPin className={`h-3 w-3 ${colors.icon}`} />
                                <span className="text-[11px] font-medium truncate">{booking.place}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className={`h-3 w-3 ${colors.icon}`} />
                                <span className="text-[11px] font-medium">{booking.totalParticipantsCount || 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <UserIcon className={`h-3 w-3 ${colors.icon}`} />
                                <span className="text-[11px] font-medium truncate">
                                  {booking.responsiblePersonName || 'No Name'}
                                </span>
                              </div>
                              {booking.refreshments?.required && (
                                <div className="flex items-center gap-1.5">
                                  <Utensils className={`h-3 w-3 ${colors.icon}`} />
                                  <span className="text-[11px] font-medium">Refreshments</span>
                                </div>
                              )}
                              {canCancelBooking(booking) && !isCancelled && !isCompleted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleCancel(booking)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {confirmTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{confirmMessage}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmDialogOpen(false)}>No</Button>
            <Button variant="destructive" size="sm" onClick={() => { if (confirmAction) confirmAction() }}>Yes, Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
