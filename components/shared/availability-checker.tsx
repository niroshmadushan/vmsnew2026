"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  Calendar,
  Clock,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  MapPin,
  Users,
  TrendingUp,
  Sparkles,
  Timer,
  CalendarCheck,
  Building2,
  CircleDot,
  RefreshCw
} from "lucide-react"
import { placeManagementAPI } from "@/lib/place-management-api"
import toast from "react-hot-toast"

interface Place {
  id: string
  name: string
  capacity: number
  place_type: string
}

interface PlaceConfiguration {
  id: string
  place_id: string
  available_monday: boolean
  available_tuesday: boolean
  available_wednesday: boolean
  available_thursday: boolean
  available_friday: boolean
  available_saturday: boolean
  available_sunday: boolean
  start_time: string
  end_time: string
  booking_slot_duration: number
  allow_bookings: boolean
  max_bookings_per_day?: number
}

interface Booking {
  id: string
  title: string
  start_time: string
  end_time: string
  status: string
  responsible_person_name: string
  total_participants?: number
  booking_ref_id?: string
}

interface TimeSlot {
  start: string
  end: string
  duration: string
  isAvailable: boolean
}

interface AvailablePlace extends Place {
  configuration?: PlaceConfiguration
}

interface AvailabilityCheckerProps {
  role?: "admin" | "reception" | "employee" | "staff"
}

export function AvailabilityChecker({ role }: AvailabilityCheckerProps) {
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const [availablePlaces, setAvailablePlaces] = useState<AvailablePlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState("")
  const [selectedPlaceData, setSelectedPlaceData] = useState<AvailablePlace | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [placeConfig, setPlaceConfig] = useState<PlaceConfiguration | null>(null)
  const [existingBookings, setExistingBookings] = useState<Booking[]>([])
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])

  // Helper function to get day of week from date string
  const getDayOfWeek = (dateString: string): string => {
    const date = new Date(dateString)
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return days[date.getDay()]
  }

  // Fetch all places (active and not deleted) on mount
  useEffect(() => {
    fetchAllPlaces()
  }, [])

  // Fetch available places when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchAvailablePlaces(selectedDate)
    } else {
      setAvailablePlaces([])
      setSelectedPlace("")
      setSelectedPlaceData(null)
    }
  }, [selectedDate, allPlaces])

  // Fetch all active, non-deleted places using recursive paging
  const fetchAllPlaces = async () => {
    try {
      let allPlacesData: Place[] = []
      let currentPage = 1
      let keepFetching = true

      while (keepFetching) {
        const response = await placeManagementAPI.getTableData('places', {
          filters: [
            { column: 'is_active', operator: 'equals', value: 1 },
            { column: 'is_deleted', operator: 'equals', value: 0 }
          ],
          limit: 100,
          page: currentPage
        })

        const pageData = Array.isArray(response) ? response : response?.data || []
        if (pageData.length > 0) {
          allPlacesData = [...allPlacesData, ...pageData]
        }

        if (pageData.length < 100) {
          keepFetching = false
        } else {
          currentPage++
          if (currentPage > 20) keepFetching = false
        }
      }

      setAllPlaces(allPlacesData)
    } catch (error) {
      // Silent fail
    }
  }

  // Fetch places available for the selected date
  const fetchAvailablePlaces = async (dateString: string) => {
    if (allPlaces.length === 0) return

    try {
      setIsLoadingPlaces(true)

      // Fetch all place configurations using recursive paging
      let configsData: any[] = []
      let currentPage = 1
      let keepFetching = true

      while (keepFetching) {
        const response = await placeManagementAPI.getTableData('place_configuration', {
          limit: 100,
          page: currentPage
        })

        const pageData = Array.isArray(response) ? response : response?.data || []
        if (pageData.length > 0) {
          configsData = [...configsData, ...pageData]
        }

        if (pageData.length < 100) {
          keepFetching = false
        } else {
          currentPage++
          if (currentPage > 20) keepFetching = false
        }
      }

      // Show ALL active places in the dropdown
      const availablePlacesForDate: AvailablePlace[] = allPlaces
        .map((place: Place) => {
          const config = configsData.find((c: any) => c.place_id === place.id)

          return {
            ...place,
            configuration: config
          } as AvailablePlace
        })
        .filter((place: AvailablePlace | null): place is AvailablePlace => place !== null)

      setAvailablePlaces(availablePlacesForDate)
    } catch (error) {
      toast.error('Failed to load available places')
    } finally {
      setIsLoadingPlaces(false)
    }
  }

  const checkAvailability = async () => {
    if (!selectedPlace || !selectedDate) {
      toast.error('Please select both place and date')
      return
    }

    try {
      setIsChecking(true)
      setHasChecked(false)

      const place = availablePlaces.find(p => p.id === selectedPlace)
      if (!place || !place.configuration) {
        toast.error('Place configuration not found')
        return
      }

      setSelectedPlaceData(place)
      const config = place.configuration
      setPlaceConfig(config)

      // Fetch existing bookings using recursive paging
      let bookingsData: any[] = []
      let currentPage = 1
      let keepFetching = true

      while (keepFetching) {
        const response = await placeManagementAPI.getTableData('bookings', {
          filters: [
            { column: 'is_deleted', operator: 'equals', value: 0 },
            { column: 'place_id', operator: 'equals', value: selectedPlace },
            { column: 'booking_date', operator: 'equals', value: selectedDate }
          ],
          limit: 100,
          page: currentPage
        })

        const pageData = Array.isArray(response) ? response : response?.data || []
        if (pageData.length > 0) {
          bookingsData = [...bookingsData, ...pageData]
        }

        if (pageData.length < 100) {
          keepFetching = false
        } else {
          currentPage++
          if (currentPage > 20) keepFetching = false
        }
      }

      const filteredBookings = bookingsData.filter((booking: any) => {
        const status = booking.status?.toLowerCase()?.trim()
        const isCancelled = status === 'cancelled' || !!booking.cancelled_at
        return !isCancelled && booking.is_deleted !== 1
      })

      setExistingBookings(filteredBookings)
      generateAvailableSlots(config, filteredBookings)
      setHasChecked(true)
      toast.success('Availability checked')
    } catch (error) {
      toast.error('Failed to check availability')
    } finally {
      setIsChecking(false)
    }
  }

  const generateAvailableSlots = (config: PlaceConfiguration, bookings: Booking[]) => {
    const startTime = config.start_time.substring(0, 5)
    const endTime = config.end_time.substring(0, 5)
    const minDuration = config.booking_slot_duration || 30

    const sortedBookings = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time))
    const available: TimeSlot[] = []

    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }

    const minutesToTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
    }

    const calculateDuration = (start: string, end: string) => {
      const diff = timeToMinutes(end) - timeToMinutes(start)
      const hours = Math.floor(diff / 60)
      const mins = diff % 60
      if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
      if (hours > 0) return `${hours}h`
      return `${mins}m`
    }

    let currentTime = timeToMinutes(startTime)
    const closeTime = timeToMinutes(endTime)

    if (sortedBookings.length === 0) {
      available.push({
        start: startTime,
        end: endTime,
        duration: calculateDuration(startTime, endTime),
        isAvailable: true
      })
    } else {
      const firstBookingStart = timeToMinutes(sortedBookings[0].start_time.substring(0, 5))
      if (firstBookingStart - currentTime >= minDuration) {
        available.push({
          start: minutesToTime(currentTime),
          end: minutesToTime(firstBookingStart),
          duration: calculateDuration(minutesToTime(currentTime), minutesToTime(firstBookingStart)),
          isAvailable: true
        })
      }

      for (let i = 0; i < sortedBookings.length - 1; i++) {
        const currentEnd = timeToMinutes(sortedBookings[i].end_time.substring(0, 5))
        const nextStart = timeToMinutes(sortedBookings[i + 1].start_time.substring(0, 5))
        if (nextStart - currentEnd >= minDuration) {
          available.push({
            start: minutesToTime(currentEnd),
            end: minutesToTime(nextStart),
            duration: calculateDuration(minutesToTime(currentEnd), minutesToTime(nextStart)),
            isAvailable: true
          })
        }
      }

      const lastEnd = timeToMinutes(sortedBookings[sortedBookings.length - 1].end_time.substring(0, 5))
      if (closeTime - lastEnd >= minDuration) {
        available.push({
          start: minutesToTime(lastEnd),
          end: minutesToTime(closeTime),
          duration: calculateDuration(minutesToTime(lastEnd), minutesToTime(closeTime)),
          isAvailable: true
        })
      }
    }

    setAvailableSlots(available)
  }

  const calculateUtilization = () => {
    if (!placeConfig) return 0
    const startMins = timeToMinutes(placeConfig.start_time)
    const endMins = timeToMinutes(placeConfig.end_time)
    const total = endMins - startMins
    if (total <= 0) return 0
    const booked = existingBookings.reduce((acc, b) => acc + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)), 0)
    return Math.round((booked / total) * 100)
  }

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Check Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Select Place</Label>
              <Select value={selectedPlace} onValueChange={setSelectedPlace}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPlaces ? "Loading..." : "Choose a place"} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlaces.map(place => (
                    <SelectItem key={place.id} value={place.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{place.name}</span>
                        <Badge variant="outline">{place.capacity} seats</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={checkAvailability}
                disabled={!selectedPlace || !selectedDate || isChecking}
                className="w-full"
              >
                {isChecking ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {isChecking ? "Checking..." : "Check Availability"}
              </Button>
            </div>
          </div>

          {selectedPlaceData && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{selectedPlaceData.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPlaceData.place_type} • Capacity: {selectedPlaceData.capacity} people
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasChecked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Availability Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{existingBookings.length}</p>
                <p className="text-xs text-muted-foreground">Bookings</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{availableSlots.length}</p>
                <p className="text-xs text-muted-foreground">Available Slots</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{calculateUtilization()}%</p>
                <p className="text-xs text-muted-foreground">Utilization</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Available Time Slots</h4>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-green-50/30">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{slot.start} - {slot.end}</span>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                        {slot.duration}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No free slots available</p>
              )}
            </div>

            {existingBookings.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Existing Bookings</h4>
                <div className="space-y-2">
                  {existingBookings.map((booking) => (
                    <div key={booking.id} className="p-3 border rounded-lg bg-orange-50/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{booking.title}</p>
                          <p className="text-xs text-muted-foreground">{booking.start_time} - {booking.end_time}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{booking.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
