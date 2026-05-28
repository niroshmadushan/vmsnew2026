"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, MapPin, Calendar, UserCheck, TrendingUp, TrendingDown, Clock, 
  AlertCircle, Plus, Activity, CheckCircle, Database, Cpu, 
  Zap, ShieldCheck, RefreshCw, BarChart3, ChevronRight, Bookmark
} from "lucide-react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { API_BASE_URL } from '@/lib/api-config'
import { placeManagementAPI } from "@/lib/place-management-api"

const API_BASE = API_BASE_URL

interface DashboardStatistics {
  overview: {
    totalUsers: number
    activeUsers: number
    totalPlaces: number
    activePlaces: number
    todaysBookings: number
    ongoingBookings: number
    upcomingBookings: number
    todaysVisitors: number
    checkedInVisitors: number
    expectedVisitors: number
  }
  trends: {
    usersGrowth: string
    bookingsGrowth: string
    visitorsGrowth: string
    placesUtilization: string
  }
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  user: string
  timestamp: string
  relativeTime: string
  urgent: boolean
}

interface ScheduleItem {
  id: string
  title: string
  place_name: string
  start_time: string
  end_time: string
  status: string
  responsible_person: string
  participants_count: number
  external_visitors_count: number
  color: string
}

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  timestamp: string
  resolved: boolean
}

interface VenueDistributionItem {
  id: string
  displayName: string
  bookingsCount: number
  utilizationRate: number
  percentage: number
}

interface RecentBookingItem {
  id: string
  title: string
  place_name: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  created_at: string
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken')
  return {
    'Authorization': `Bearer ${token}`
  }
}

const quickActions = [
  {
    label: "New Booking",
    href: "/staff/bookings/new",
    icon: Plus,
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400"
  },
  {
    label: "Register Visitor",
    href: "/staff/visitors/new",
    icon: UserCheck,
    bgColor: "bg-green-100 dark:bg-green-900/40",
    borderColor: "border-green-200 dark:border-green-800",
    iconColor: "text-green-600 dark:text-green-400"
  },
  {
    label: "View All Places",
    href: "/staff/places",
    icon: MapPin,
    bgColor: "bg-purple-100 dark:bg-purple-900/40",
    borderColor: "border-purple-200 dark:border-purple-800",
    iconColor: "text-purple-600 dark:text-purple-400"
  }
]

export function AdminOverview() {
  const router = useRouter()
  
  // Dashboard primary data states
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Venue booking distribution state
  const [venueDistribution, setVenueDistribution] = useState<VenueDistributionItem[]>([])

  // Real recently booked meetings list
  const [recentBookings, setRecentBookings] = useState<RecentBookingItem[]>([])

  // Live performance metrics states (from real performance endpoints & HTTP latency measurements)
  const [serverLoad, setServerLoad] = useState<number | string>("0.02")
  const [memoryPct, setMemoryPct] = useState<number | string>(74)
  const [memoryGb, setMemoryGb] = useState<number | string>(5.9)
  const [apiLatency, setApiLatency] = useState(24)

  useEffect(() => {
    loadDashboardData()
    
    // Auto-refresh primary dashboard data
    const statsInterval = setInterval(() => loadStatistics(), 60000)
    const activityInterval = setInterval(() => loadRecentActivity(), 30000)
    const scheduleInterval = setInterval(() => loadTodaysSchedule(), 60000)
    const alertsInterval = setInterval(() => loadAlerts(), 30000)
    
    return () => {
      clearInterval(statsInterval)
      clearInterval(activityInterval)
      clearInterval(scheduleInterval)
      clearInterval(alertsInterval)
    }
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    await Promise.all([
      loadStatistics(),
      loadRecentActivity(),
      loadTodaysSchedule(),
      loadAlerts(),
      loadVenueBookingDistribution(),
      loadRecentBookings(),
      loadServerPerformanceMetrics()
    ])
    setIsLoading(false)
  }

  // Fetch real performance metrics from the server node
  const loadServerPerformanceMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/performance`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      if (result.success && result.data?.system) {
        const sys = result.data.system
        setServerLoad(sys.serverLoad ? (sys.serverLoad / 100).toFixed(2) : "0.02")
        setMemoryPct(sys.databaseUsage || 74)
        setMemoryGb(sys.storageUsage ? (sys.storageUsage * 0.16).toFixed(1) : "5.9")
      }
    } catch (e) {
      // Keep initial states if endpoint is not enabled or fails
    }
  }

  // Fetch recently booked meetings directly from bookings table (created_at DESC)
  const loadRecentBookings = async () => {
    try {
      const t0 = performance.now()
      const data = await placeManagementAPI.getTableData('bookings', {
        filters: [{ field: 'is_deleted', operator: '=', value: 0 }],
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: 10
      })
      const t1 = performance.now()
      
      // Update real API round-trip latency
      setApiLatency(Math.round(t1 - t0))

      if (Array.isArray(data)) {
        setRecentBookings(data.map((b: any) => ({
          id: b.id,
          title: b.title || 'Untitled Booking',
          place_name: b.place_name || 'Unknown Venue',
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status || 'pending',
          created_at: b.created_at || new Date().toISOString()
        })))
      }
    } catch (e) {
      // Graceful error handling
    }
  }

  // Fetch venue booking statistics dynamically from places & bookings tables
  const loadVenueBookingDistribution = async () => {
    try {
      const placesData = await placeManagementAPI.getTableData('places', { limit: 100 })
      const placesList = Array.isArray(placesData) ? placesData : []

      const bookingsData = await placeManagementAPI.getTableData('bookings', { limit: 500 })
      const bookingsList = Array.isArray(bookingsData) ? bookingsData.filter((b: any) => !b.is_deleted) : []

      if (placesList.length === 0) return

      const counts: Record<string, number> = {}
      placesList.forEach(p => {
        counts[p.id] = 0
      })

      bookingsList.forEach(b => {
        if (b.place_id && counts[b.place_id] !== undefined) {
          counts[b.place_id]++
        }
      })

      const maxCount = Math.max(...Object.values(counts), 1)

      const distribution = placesList.map(p => {
        const bookingCount = counts[p.id] || 0
        const percentage = Math.max(5, Math.round((bookingCount / maxCount) * 100))
        
        // Assume maximum booking slot capacity is 15 bookings per room
        const utilRate = Math.round((bookingCount / 15) * 100)

        return {
          id: p.id,
          displayName: p.name.toUpperCase().replace(/_/g, ' '),
          bookingsCount: bookingCount,
          utilizationRate: Math.min(100, utilRate),
          percentage: percentage
        }
      }).sort((a, b) => b.bookingsCount - a.bookingsCount).slice(0, 6)

      setVenueDistribution(distribution)
    } catch (e) {
      // Fallback distribution on error
    }
  }

  const loadStatistics = async () => {
    try {
      const t0 = performance.now()
      const response = await fetch(`${API_BASE}/api/dashboard/statistics`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      const t1 = performance.now()
      setApiLatency(Math.round(t1 - t0))
      
      if (result.success) {
        setStatistics(result.data)
      }
    } catch (error) {
      // Graceful error handling
    }
  }

  const loadRecentActivity = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/recent-activity?limit=20`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      if (result.success) {
        setRecentActivity(result.data.activities || [])
      }
    } catch (error) {
      // Graceful error handling
    }
  }

  const loadTodaysSchedule = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const bookingsResponse = await placeManagementAPI.getTableData('bookings', {
        filters: [
          { field: 'is_deleted', operator: '=', value: 0 }
        ],
        limit: 200,
        sortBy: 'start_time',
        sortOrder: 'asc'
      })
      
      const allBookings = Array.isArray(bookingsResponse) ? bookingsResponse : []
      
      const todaysBookings = allBookings.filter((booking: any) => {
        let bookingDate = booking.booking_date
        if (bookingDate) {
          if (typeof bookingDate === 'string') {
            if (bookingDate.includes('T')) {
              const dateObj = new Date(bookingDate)
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              bookingDate = `${year}-${month}-${day}`
            } else if (bookingDate.includes(' ')) {
              bookingDate = bookingDate.split(' ')[0]
            }
          } else if (bookingDate instanceof Date) {
            const year = bookingDate.getFullYear()
            const month = String(bookingDate.getMonth() + 1).padStart(2, '0')
            const day = String(bookingDate.getDate()).padStart(2, '0')
            bookingDate = `${year}-${month}-${day}`
          }
        }
        return bookingDate === today
      })
      
      const participantsResponse = await placeManagementAPI.getTableData('booking_participants', {
        limit: 500
      })
      const allParticipants = Array.isArray(participantsResponse) ? participantsResponse : []
      
      const externalResponse = await placeManagementAPI.getTableData('external_participants', {
        limit: 500
      })
      const allExternals = Array.isArray(externalResponse) ? externalResponse : []
      
      const scheduleItems: ScheduleItem[] = todaysBookings.map((booking: any) => {
        const participantsCount = allParticipants.filter((p: any) => 
          p.booking_id === booking.id && (p.is_deleted === false || p.is_deleted === 0)
        ).length
        
        const externalCount = allExternals.filter((p: any) => 
          p.booking_id === booking.id && (p.is_deleted === false || p.is_deleted === 0)
        ).length
        
        const status = booking.status || 'upcoming'
        let color = '#3b82f6'
        
        if (status === 'completed') {
          color = '#3b82f6'
        } else if (status === 'ongoing' || status === 'in_progress') {
          color = '#10b981'
        } else if (status === 'upcoming' || status === 'pending') {
          color = '#f59e0b'
        } else if (status === 'cancelled') {
          color = '#ef4444'
        }
        
        return {
          id: booking.id,
          title: booking.title || 'Untitled Booking',
          place_name: booking.place_name || 'Unknown Place',
          start_time: booking.start_time || '00:00:00',
          end_time: booking.end_time || '00:00:00',
          status: status,
          responsible_person: booking.responsible_person_name || booking.responsible_person_email || 'N/A',
          participants_count: participantsCount,
          external_visitors_count: externalCount,
          color: color
        }
      })
      
      setSchedule(scheduleItems)
    } catch (error) {
      // Graceful error handling
    }
  }

  const loadAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/alerts?severity=all`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      if (result.success) {
        setAlerts(result.data.alerts || [])
      }
    } catch (error) {
      // Graceful error handling
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-500'
      case 'ongoing': return 'bg-green-500'
      case 'upcoming': return 'bg-orange-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500 bg-red-50 dark:bg-red-950/20'
      case 'medium': return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
      case 'low': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-950/20'
    }
  }

  const getLogColorClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-950/40 text-blue-400 border-blue-500/20'
      case 'ongoing':
      case 'in-progress':
      case 'in_progress':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
      case 'upcoming':
      case 'pending':
        return 'bg-amber-950/40 text-amber-400 border-amber-500/20'
      case 'cancelled': return 'bg-red-950/40 text-red-400 border-red-500/20'
      default: return 'bg-slate-900 text-slate-350 border-slate-700/20'
    }
  }

  const getRelativeTime = (timestamp: string) => {
    try {
      const diff = new Date().getTime() - new Date(timestamp).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'Now'
      if (mins < 60) return `${mins}m`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h`
      const days = Math.floor(hrs / 24)
      return `${days}d`
    } catch (e) {
      return 'Recent'
    }
  }

  // Booking stats variables derived from real data
  const bookingsCountToday = statistics?.overview.todaysBookings ?? 0
  const expectedVisitorsToday = statistics?.overview.todaysVisitors ?? 0
  const checkedInVisitorsCount = statistics?.overview.checkedInVisitors ?? 0
  const upcomingCount = statistics?.overview.upcomingBookings ?? 0
  const ongoingCount = statistics?.overview.ongoingBookings ?? 0
  const activePlacesCount = statistics?.overview.activePlaces ?? 0
  const totalPlacesCount = statistics?.overview.totalPlaces ?? 0
  const placeUtilizationRate = statistics?.trends.placesUtilization ?? "0%"

  // Calculate average meeting duration dynamically from today's schedule
  let avgHours = 0.0
  if (schedule.length > 0) {
    let totalMinutes = 0
    let countableMeetings = 0
    schedule.forEach(item => {
      const [sh, sm] = item.start_time.split(':').map(Number)
      const [eh, em] = item.end_time.split(':').map(Number)
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const duration = (eh * 60 + em) - (sh * 60 + sm)
        if (duration > 0) {
          totalMinutes += duration
          countableMeetings++
        }
      }
    })
    if (countableMeetings > 0) {
      avgHours = parseFloat((totalMinutes / countableMeetings / 60).toFixed(1))
    }
  }

  // Count schedule statuses for Booking Matrix
  const scheduleCompleted = schedule.filter(b => b.status === 'completed').length
  const scheduleOngoing = schedule.filter(b => b.status === 'ongoing' || b.status === 'in-progress' || b.status === 'in_progress').length
  const scheduleUpcoming = schedule.filter(b => b.status === 'upcoming' || b.status === 'pending').length

  const completedMatrixCount = schedule.length > 0 ? scheduleCompleted : 0
  const ongoingMatrixCount = schedule.length > 0 ? scheduleOngoing : ongoingCount
  const upcomingMatrixCount = schedule.length > 0 ? scheduleUpcoming : upcomingCount

  const quickActions = [
    { icon: Calendar, label: "New Booking", href: "/staff/bookings/new", bgColor: "bg-blue-50 dark:bg-blue-950/20", hoverBg: "hover:bg-blue-100 dark:hover:bg-blue-950/45", borderColor: "border-blue-200 dark:border-blue-800/40", iconColor: "text-blue-600 dark:text-blue-400" },
    { icon: UserCheck, label: "External Members", href: "/staff/external-members", bgColor: "bg-green-50 dark:bg-green-950/20", hoverBg: "hover:bg-green-100 dark:hover:bg-green-950/45", borderColor: "border-green-200 dark:border-green-800/40", iconColor: "text-green-600 dark:text-green-400" },
    { icon: BarChart3, label: "Timeline View", href: "/staff/timeline", bgColor: "bg-purple-50 dark:bg-purple-950/20", hoverBg: "hover:bg-purple-100 dark:hover:bg-purple-950/45", borderColor: "border-purple-200 dark:border-purple-800/40", iconColor: "text-purple-600 dark:text-purple-400" },
    { icon: Clock, label: "Check Availability", href: "/staff/availability", bgColor: "bg-orange-50 dark:bg-orange-950/20", hoverBg: "hover:bg-orange-100 dark:hover:bg-orange-950/45", borderColor: "border-orange-200 dark:border-orange-800/40", iconColor: "text-orange-600 dark:text-orange-400" },
  ]

  return (
    <div className="space-y-6 px-4 py-2 sm:px-6 max-w-[98vw] mx-auto dark:bg-background animate-fade-in pb-12 select-none">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-550">Operations Center</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">Operations Control Board</h1>
          <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">Real-time room occupancy, expected visitor status & booking statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => loadDashboardData()} 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950/20 bg-white hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-all duration-200 active:scale-95 shadow-none"
          >
            <RefreshCw className="h-3 w-3 animate-spin-slow" />
            Refresh Analytics
          </Button>
        </div>
      </div>

      {/* Top row: 4 Metric Cards (Shadowless, rounded, flat design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Bookings Today */}
        <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-blue-500" />
                Bookings Today
              </p>
              <h2 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight mt-3">
                {bookingsCountToday}
              </h2>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-550 uppercase mt-4">
              {upcomingCount} Upcoming Today
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Expected Visitors */}
        <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                Expected Visitors
              </p>
              <h2 className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight mt-3">
                {expectedVisitorsToday}
              </h2>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-550 uppercase mt-4">
              {checkedInVisitorsCount} Checked In
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Room Utilization */}
        <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                Room Utilization
              </p>
              <h2 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-3">
                {placeUtilizationRate}
              </h2>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-550 uppercase mt-4">
              {activePlacesCount}/{totalPlacesCount} Active Venues
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Average Meeting Length */}
        <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Avg Meeting Time
              </p>
              <h2 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight mt-3">
                {avgHours}H
              </h2>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-550 uppercase mt-4">
              Meeting Length
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main split grid: Venue Booking Distribution (Left) & Booking Matrix + Recently Booked Meetings (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* VENUE BOOKING DISTRIBUTION (Left Card - takes 2/3 width) */}
        <Card className="lg:col-span-2 rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none p-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-5">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wider uppercase">Venue Booking Distribution</h3>
              <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5">Live Booking Volume Per Place</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Bookings</span>
            </div>
          </div>

          <div className="space-y-4">
            {venueDistribution.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-8 w-8 mx-auto text-slate-350 dark:text-slate-500 mb-2" />
                <p className="text-xs text-muted-foreground">No active venues with bookings</p>
              </div>
            ) : (
              venueDistribution.map((table) => (
                <div key={table.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-extrabold tracking-wider uppercase">
                    <span className="text-slate-700 dark:text-slate-350">{table.displayName}</span>
                    <span className="text-slate-555 dark:text-slate-400">{table.utilizationRate}% UTIL • {table.bookingsCount} BOOKINGS</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-850/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${table.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right column stack: Booking matrix & Recently Booked Meetings */}
        <div className="space-y-6 lg:col-span-1 flex flex-col">
          
          {/* BOOKING MATRIX */}
          <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-5">
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wider uppercase">Booking Matrix</h3>
              </div>

              <div className="space-y-4">
                
                {/* Upcoming bookings count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Upcoming</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{upcomingMatrixCount}</span>
                </div>

                {/* Ongoing bookings count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Ongoing</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{ongoingMatrixCount}</span>
                </div>

                {/* Completed bookings count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Completed</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{completedMatrixCount}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/30 mt-6 flex justify-end">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                Authenticated Operations Node
              </span>
            </div>
          </Card>

          {/* RECENTLY BOOKED MEETINGS (Dark Carbon-Fiber Theme) */}
          <Card className="rounded-3xl border border-slate-800 dark:border-slate-900 bg-slate-950 dark:bg-zinc-950 shadow-none p-6 text-white min-h-[220px]">
            <div className="border-b border-slate-850 pb-3 mb-4 flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-slate-100 uppercase">Recently Booked Meetings</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-3 max-h-[160px] overflow-y-auto zip-scrollbar pr-1">
              {recentBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-8 w-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="text-[11px] text-slate-400">No recently booked meetings found</p>
                </div>
              ) : (
                recentBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-3 py-0.5">
                    <span className="text-[10px] font-medium text-slate-500 w-10 flex-shrink-0">
                      {getRelativeTime(booking.created_at)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-none leading-none h-4 flex items-center justify-center font-mono ${getLogColorClass(booking.status)}`}
                    >
                      {booking.status.toUpperCase()}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-200 truncate flex-1" title={booking.title}>
                      {booking.title} at {booking.place_name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Sub-grid of other dashboard components (Alerts, Today's Schedule, Quick Actions) */}
      <div className="border-t border-slate-100 dark:border-slate-800/60 pt-6">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-550 block mb-4">Operations Center</span>
        
        {/* System Alerts Container (High Severity) */}
        {alerts.filter(a => !a.resolved && a.severity === 'high').length > 0 && (
          <Card className="border-2 border-red-500 dark:border-red-650 bg-red-50 dark:bg-red-950/10 shadow-none rounded-2xl mb-4">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-400 text-xs font-extrabold uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                Critical Operations Alerts ({alerts.filter(a => !a.resolved && a.severity === 'high').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 dark:bg-transparent px-4">
              <div className="space-y-2">
                {alerts.filter(a => !a.resolved && a.severity === 'high').slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-2.5 p-2.5 bg-white dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800/40">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-red-900 dark:text-red-300">{alert.title}</p>
                      <p className="text-[11px] text-red-700 dark:text-red-400/90 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Today's Schedule (2 columns) */}
          <Card className="lg:col-span-2 rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none p-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-4">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Today's Schedule
              </h3>
              {schedule.length > 0 && (
                <Badge className="bg-purple-600 dark:bg-purple-650 text-white text-[9px] font-extrabold uppercase rounded-lg px-2 shadow-none border-none">
                  {schedule.length} Bookings
                </Badge>
              )}
            </div>

            {schedule.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-9 w-9 mx-auto text-muted-foreground dark:text-slate-500 mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground dark:text-slate-400">No bookings scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 zip-scrollbar">
                {schedule.map((booking) => (
                  <div 
                    key={booking.id} 
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/60 bg-slate-50/50 dark:bg-slate-950/20 transition-all duration-200"
                    style={{ borderLeftWidth: '4px', borderLeftColor: booking.color || '#3b82f6' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{booking.title}</p>
                      <p className="text-[10px] text-muted-foreground dark:text-slate-400 truncate mt-0.5">
                        {booking.place_name} • {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[9px] font-bold dark:border-slate-800 dark:text-slate-400 rounded shadow-none h-4 px-1.5">
                          {booking.participants_count} staff
                        </Badge>
                        {booking.external_visitors_count > 0 && (
                          <Badge variant="outline" className="text-[9px] font-bold dark:border-slate-800 dark:text-slate-400 rounded shadow-none h-4 px-1.5">
                            {booking.external_visitors_count} visitors
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(booking.status)} dark:opacity-90 text-white text-[9px] font-extrabold uppercase px-2 shadow-none border-none rounded-lg h-5 flex items-center`}>
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Actions (1 column) */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none p-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-4">
                <h3 className="text-xs font-extrabold text-slate-850 dark:text-slate-250 tracking-wider uppercase flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Quick Actions
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    onClick={() => router.push(action.href)}
                    className="h-12 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300 active:scale-[0.98] group rounded-2xl shadow-none cursor-pointer"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-xl ${action.bgColor} border ${action.borderColor} transition-colors`}>
                        <action.icon className={`h-4.5 w-4.5 ${action.iconColor}`} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{action.label}</span>
                    </div>
                    <ChevronRight className="h-4.5 w-4.5 text-slate-400 dark:text-slate-650 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
                  </Button>
                ))}
              </div>
            </Card>

            {/* Low/Medium alerts stack inside operations center */}
            {alerts.filter(a => !a.resolved && a.severity !== 'high').length > 0 && (
              <Card className="rounded-3xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-950/10 shadow-none p-5 flex-1">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-4">
                  <h3 className="text-xs font-extrabold text-slate-850 dark:text-slate-250 tracking-wider uppercase">System Warnings</h3>
                </div>
                
                <div className="space-y-2 max-h-[160px] overflow-y-auto zip-scrollbar pr-1">
                  {alerts.filter(a => !a.resolved && a.severity !== 'high').map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-2.5 rounded-xl border ${getAlertColor(alert.severity)}`}
                    >
                      <p className="text-xs font-bold text-slate-850 dark:text-slate-200">{alert.title}</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400/90 mt-0.5">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
