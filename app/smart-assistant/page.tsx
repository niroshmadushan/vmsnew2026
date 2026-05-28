"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  QrCode, Hash, Search, Calendar, MapPin, Users, Clock,
  UserCheck, CheckCircle, Building2, Phone, Mail, ArrowRight, ArrowLeft, AlertCircle, User, Plus, X, Loader2,
  CreditCard, Activity
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { placeManagementAPI } from "@/lib/place-management-api"
import toast from "react-hot-toast"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { sanitizeInput } from "@/lib/validation"

interface Meeting {
  id: string
  booking_ref_id: string
  title: string
  description: string
  booking_date: string
  start_time: string
  end_time: string
  place_name: string
  responsible_person_name: string
  responsible_person_email: string
  status: string
}

interface ExternalVisitor {
  id: string
  full_name: string
  email: string
  phone: string
  reference_type: string
  reference_value: string
  company_name?: string
  designation?: string
}

export default function SmartAssistantPage() {
  const { signOut, user } = useAuth()
  const { theme, setTheme } = useTheme()

  const [currentView, setCurrentView] = useState<'search' | 'details' | 'confirm' | 'success' | 'error' | 'adhoc-nic' | 'adhoc-details' | 'adhoc-purpose'>('search')
  const [meetingId, setMeetingId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [externalVisitors, setExternalVisitors] = useState<ExternalVisitor[]>([])
  const [selectedVisitor, setSelectedVisitor] = useState<ExternalVisitor | null>(null)
  const [isTodayBooking, setIsTodayBooking] = useState(false)

  // Add member state
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [memberDialogTab, setMemberDialogTab] = useState<'search' | 'create'>('search')
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [searchedMembers, setSearchedMembers] = useState<any[]>([])
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
    designation: "",
    reference_type: "NIC" as "NIC" | "Passport" | "Employee ID",
    reference_value: "",
  })
  const [isAddingMember, setIsAddingMember] = useState(false)
  
  // Ad-hoc flow state
  const [adhocNic, setAdhocNic] = useState("")
  const [adhocPurpose, setAdhocPurpose] = useState("")
  const [adhocMember, setAdhocMember] = useState<any>(null)
  const [isSearchingNic, setIsSearchingNic] = useState(false)
  const [adhocSuggestions, setAdhocSuggestions] = useState<any[]>([])
  const [showAdhocSuggestions, setShowAdhocSuggestions] = useState(false)

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  const handleSearch = async () => {
    setErrorMessage("")

    if (!meetingId.trim()) {
      setErrorMessage('Please enter a Meeting ID')
      return
    }

    try {
      setIsLoading(true)
      const sanitizedMeetingId = sanitizeInput(meetingId.trim().toUpperCase())

      // Robust fetch: Load all active bookings to bypass backend filter issues
      let allBookings: any[] = []
      let bPage = 1
      let bKeepFetching = true

      while (bKeepFetching) {
        const bResponse = await placeManagementAPI.getTableData('bookings', {
          filters: [{ column: 'is_deleted', operator: 'equals', value: 0 }],
          limit: 100,
          page: bPage
        })

        const bData = Array.isArray(bResponse) ? bResponse : bResponse?.data || []
        if (bData.length > 0) {
          allBookings = [...allBookings, ...bData]
        }

        if (bData.length < 100) {
          bKeepFetching = false
        } else {
          bPage++
          if (bPage > 50) bKeepFetching = false // Safety limit: max 5000 bookings
        }
      }

      // Exact client-side match to ensure we get the right meeting
      const foundBooking = allBookings.find(b => b.booking_ref_id === sanitizedMeetingId)

      if (!foundBooking) {
        setErrorMessage(`Meeting ID "${sanitizedMeetingId}" not found. Please check and try again.`)
        setCurrentView('error')
        return
      }

      // Process found booking
      let normalizedDate = foundBooking.booking_date
      if (normalizedDate && typeof normalizedDate === 'string' && normalizedDate.includes('T')) {
        const d = new Date(normalizedDate)
        normalizedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }

      setMeeting({
        ...foundBooking,
        booking_date: normalizedDate
      })

      // Check if booking is for today
      const today = new Date().toISOString().split('T')[0]
      setIsTodayBooking(normalizedDate === today)

      // Fetch participants for this booking specifically
      let allParticipants: any[] = []
      let pPage = 1
      let pKeepFetching = true

      while (pKeepFetching) {
        const pResponse = await placeManagementAPI.getTableData('external_participants', {
          filters: [{ column: 'booking_id', operator: 'equals', value: foundBooking.id }],
          limit: 100,
          page: pPage
        })

        const pData = Array.isArray(pResponse) ? pResponse : pResponse?.data || []
        if (pData.length > 0) {
          allParticipants = [...allParticipants, ...pData]
        }

        if (pData.length < 100) {
          pKeepFetching = false
        } else {
          pPage++
          if (pPage > 10) pKeepFetching = false
        }
      }

      // Strict client-side filter to ensure only this meeting's participants are shown
      // This protects against backend issues that might ignore the booking_id filter
      const filteredParticipants = allParticipants.filter(p => p.booking_id === foundBooking.id)

      setExternalVisitors(filteredParticipants)
      setCurrentView('details')
      toast.success('Meeting found!')

    } catch (error) {
      setErrorMessage('Failed to search for meeting. Please try again.')
      setCurrentView('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVisitor = (visitor: ExternalVisitor) => {
    setSelectedVisitor(visitor)
    setCurrentView('confirm')
  }

  const handleConfirmAttendance = async () => {
    if (!selectedVisitor) return

    // Check if already marked
    const isAlreadyMarked = selectedVisitor.participation_status === 'confirmed' ||
      selectedVisitor.participation_status === 'checked_in' ||
      selectedVisitor.checked_in_at ||
      selectedVisitor.check_in_time

    if (isAlreadyMarked) {
      toast.error('Attendance has already been marked for this visitor.')
      setCurrentView('details')
      return
    }

    try {
      setIsLoading(true)

      await placeManagementAPI.updateRecord('external_participants',
        { id: selectedVisitor.id },
        {
          participation_status: 'confirmed',
          check_in_time: new Date().toISOString(),
          checked_in_at: new Date().toISOString()
        }
      )

      // Update local state to reflect the change
      setExternalVisitors(prevVisitors =>
        prevVisitors.map(v =>
          v.id === selectedVisitor.id
            ? { ...v, participation_status: 'confirmed', checked_in_at: new Date().toISOString(), check_in_time: new Date().toISOString() }
            : v
        )
      )

      toast.success(`✅ Attendance confirmed for ${selectedVisitor.full_name}!`)
      setCurrentView('details')
      setSelectedVisitor(null)

    } catch (error) {
      // Generic error message - don't expose internal error details
      toast.error('Failed to submit attendance. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNicChange = async (val: string) => {
    const value = val.toUpperCase()
    setAdhocNic(value)
    
    if (value.length < 3) {
      setAdhocSuggestions([])
      setShowAdhocSuggestions(false)
      return
    }

    try {
      const res = await placeManagementAPI.getTableData('external_members', {
        filters: [
          { column: 'reference_value', operator: 'contains', value: value },
          { column: 'is_deleted', operator: 'equals', value: 0 }
        ],
        limit: 5
      })
      
      const data = Array.isArray(res) ? res : res?.data || []
      setAdhocSuggestions(data)
      setShowAdhocSuggestions(data.length > 0)
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    }
  }

  const selectAdhocSuggestion = (member: any) => {
    setAdhocMember(member)
    setAdhocNic(member.reference_value)
    setNewMemberForm({
      full_name: member.full_name,
      email: member.email || "",
      phone: member.phone || "",
      company_name: member.company_name || "",
      designation: member.designation || "",
      reference_type: member.reference_type || "NIC",
      reference_value: member.reference_value,
    })
    setShowAdhocSuggestions(false)
    toast.success(`Welcome back, ${member.full_name}!`)
    setCurrentView('adhoc-details')
  }

  const handleAdhocNicSearch = async () => {
    if (!adhocNic.trim()) {
      toast.error("Please enter NIC / Reference")
      return
    }
    
    setIsSearchingNic(true)
    try {
      const res = await placeManagementAPI.getTableData('external_members', {
        filters: [
          { column: 'reference_value', operator: 'equals', value: adhocNic.trim() },
          { column: 'is_deleted', operator: 'equals', value: 0 }
        ],
        limit: 1
      })
      
      const resData = Array.isArray(res) ? res : res?.data || []
      const member = resData.length > 0 ? resData[0] : null
      
      if (member) {
        setAdhocMember(member)
        setNewMemberForm({
          full_name: member.full_name,
          email: member.email || "",
          phone: member.phone || "",
          company_name: member.company_name || "",
          designation: member.designation || "",
          reference_type: member.reference_type || "NIC",
          reference_value: member.reference_value,
        })
        toast.success("Welcome back! Your details have been found.")
      } else {
        setAdhocMember(null)
        setNewMemberForm({
          full_name: "",
          email: "",
          phone: "",
          company_name: "",
          designation: "",
          reference_type: "NIC",
          reference_value: adhocNic.trim(),
        })
        toast.success("New visitor detected. Please enter your details.")
      }
      setCurrentView('adhoc-details')
    } catch (error) {
      toast.error("Search failed. Please try again.")
    } finally {
      setIsSearchingNic(false)
    }
  }

  const handleAdhocSubmit = async () => {
    if (!adhocPurpose.trim()) {
      toast.error("Please enter the reason for your visit")
      return
    }

    // Validate required fields before submission
    if (!newMemberForm.full_name || !newMemberForm.phone) {
      toast.error("Please ensure your name and phone number are provided")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let memberId = adhocMember?.id
      const timestamp = new Date().toISOString()
      const userId = user?.id || 'assistant-kiosk'

      if (adhocMember) {
        // Update existing member details if they've changed
        await placeManagementAPI.updateRecord('external_members', 
          { id: memberId }, 
          {
            full_name: newMemberForm.full_name.trim(),
            email: newMemberForm.email.trim(),
            phone: newMemberForm.phone.trim(),
            company_name: newMemberForm.company_name?.trim() || "",
            designation: newMemberForm.designation?.trim() || "",
            updated_at: timestamp,
            updated_by: userId
          }
        )
      } else {
        // Create new member record
        memberId = `member_${Date.now()}`
        await placeManagementAPI.insertRecord('external_members', {
          id: memberId,
          full_name: newMemberForm.full_name.trim(),
          email: newMemberForm.email.trim(),
          phone: newMemberForm.phone.trim(),
          company_name: newMemberForm.company_name?.trim() || "",
          designation: newMemberForm.designation?.trim() || "",
          reference_type: newMemberForm.reference_type,
          reference_value: newMemberForm.reference_value.trim(),
          is_active: 1,
          is_deleted: 0,
          created_at: timestamp,
          updated_at: timestamp,
          created_by: userId,
          updated_by: userId
        })
      }

      // Create external participant record linked to adhoc booking marker
      await placeManagementAPI.insertRecord('external_participants', {
        id: `req_${Date.now()}`,
        booking_id: "adhoc-request",
        member_id: memberId,
        full_name: newMemberForm.full_name.trim(),
        email: newMemberForm.email.trim(),
        phone: newMemberForm.phone.trim(),
        company_name: newMemberForm.company_name?.trim() || "",
        designation: newMemberForm.designation?.trim() || "",
        reference_type: newMemberForm.reference_type,
        reference_value: newMemberForm.reference_value.trim(),
        participation_status: 'pending',
        notes: adhocPurpose.trim(),
        is_deleted: 0,
        is_active: 1,
        created_at: timestamp,
        updated_at: timestamp,
        created_by: userId,
        updated_by: userId
      })

      setCurrentView('success')
    } catch (error) {
      console.error("Ad-hoc submission error:", error)
      toast.error("Submission failed. Please check your network or contact support.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setMeetingId("")
    setMeeting(null)
    setExternalVisitors([])
    setSelectedVisitor(null)
    setErrorMessage("")
    setIsTodayBooking(false)
    setCurrentView('search')
    setShowAddMemberDialog(false)
    setMemberSearchTerm("")
    setSearchedMembers([])
    setShowMemberDropdown(false)
    setAdhocNic("")
    setAdhocPurpose("")
    setAdhocMember(null)
  }

  // Search external members by reference
  const searchExternalMembers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchedMembers([])
      return
    }

    try {
      let allParticipants: any[] = []
      let pPage = 1
      let pKeepFetching = true

      while (pKeepFetching) {
        const pResponse = await placeManagementAPI.getTableData('external_participants', {
          limit: 100,
          page: pPage
        })

        const pData = Array.isArray(pResponse) ? pResponse : pResponse?.data || []
        if (pData.length > 0) {
          allParticipants = [...allParticipants, ...pData]
        }

        if (pData.length < 100) {
          pKeepFetching = false
        } else {
          pPage++
          if (pPage > 50) pKeepFetching = false
        }
      }

      // De-duplicate by Email to get a unique list of people
      const peopleMap = new Map()
      allParticipants.forEach(p => {
        if (p.email && !peopleMap.has(p.email.toLowerCase())) {
          peopleMap.set(p.email.toLowerCase(), p)
        }
      })
      const uniquePeople = Array.from(peopleMap.values())

      // Search by reference value, name, email, phone, or company
      const filtered = uniquePeople.filter((person: any) =>
        person.reference_value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.phone?.includes(searchTerm) ||
        person.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10)

      setSearchedMembers(filtered)
    } catch (error) {
      setSearchedMembers([])
    }
  }

  // Select existing member and add to meeting
  const selectExistingMember = async (member: any) => {
    if (!meeting) return

    // Check if member is already in the meeting
    if (externalVisitors.some(v => v.email === member.email)) {
      toast.error('This member is already added to the meeting')
      return
    }

    try {
      setIsAddingMember(true)

      // Create external participant record
      const participantId = `participant_${Date.now()}`
      await placeManagementAPI.insertRecord('external_participants', {
        id: participantId,
        booking_id: meeting.id,
        full_name: member.full_name || "",
        email: member.email || "",
        phone: member.phone || "",
        company_name: member.company_name || "",
        designation: member.designation || "",
        reference_type: member.reference_type || "NIC",
        reference_value: member.reference_value || "",
        participation_status: 'invited',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id || 'system',
        updated_by: user?.id || 'system'
      })

      // Add to local state
      const newVisitor: ExternalVisitor = {
        id: participantId,
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        reference_type: member.reference_type,
        reference_value: member.reference_value,
        company_name: member.company_name,
        designation: member.designation,
      }

      setExternalVisitors([...externalVisitors, newVisitor])
      setMemberSearchTerm("")
      setSearchedMembers([])
      setShowMemberDropdown(false)
      setShowAddMemberDialog(false)
      toast.success(`Added ${member.full_name} to the meeting`)
    } catch (error: any) {
      // Generic error message - don't expose internal error details
      toast.error('Failed to add member to meeting. Please try again.')
    } finally {
      setIsAddingMember(false)
    }
  }

  // Create new member and add to meeting
  const createAndAddMember = async () => {
    if (!meeting) return

    // Validate required fields
    if (!newMemberForm.full_name || !newMemberForm.email || !newMemberForm.phone || !newMemberForm.reference_value) {
      toast.error('Please fill in all required fields')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newMemberForm.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      setIsAddingMember(true)

      // Check for duplicate email or phone in historical participants
      let allParticipants: any[] = []
      let pPage = 1
      let pKeepFetching = true

      while (pKeepFetching) {
        const pResponse = await placeManagementAPI.getTableData('external_participants', {
          limit: 100,
          page: pPage
        })

        const pData = Array.isArray(pResponse) ? pResponse : pResponse?.data || []
        if (pData.length > 0) {
          allParticipants = [...allParticipants, ...pData]
        }

        if (pData.length < 100) {
          pKeepFetching = false
        } else {
          pPage++
          if (pPage > 50) pKeepFetching = false
        }
      }

      // Check if member is already in the meeting
      if (externalVisitors.some(v => v.email === newMemberForm.email.trim())) {
        toast.error('This member is already added to the meeting')
        return
      }

      // Create external participant record linked to booking
      const participantId = `participant_${Date.now()}`
      await placeManagementAPI.insertRecord('external_participants', {
        id: participantId,
        booking_id: meeting.id,
        full_name: newMemberForm.full_name.trim(),
        email: newMemberForm.email.trim(),
        phone: newMemberForm.phone.trim(),
        company_name: newMemberForm.company_name?.trim() || "",
        designation: newMemberForm.designation?.trim() || "",
        reference_type: newMemberForm.reference_type,
        reference_value: newMemberForm.reference_value.trim(),
        participation_status: 'invited',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id || 'system',
        updated_by: user?.id || 'system'
      })

      // Add to local state
      const newVisitor: ExternalVisitor = {
        id: participantId,
        full_name: newMemberForm.full_name.trim(),
        email: newMemberForm.email.trim(),
        phone: newMemberForm.phone.trim(),
        reference_type: newMemberForm.reference_type,
        reference_value: newMemberForm.reference_value.trim(),
        company_name: newMemberForm.company_name?.trim(),
        designation: newMemberForm.designation?.trim(),
      }

      setExternalVisitors([...externalVisitors, newVisitor])

      // Reset form and close dialog
      setNewMemberForm({
        full_name: "",
        email: "",
        phone: "",
        company_name: "",
        designation: "",
        reference_type: "NIC",
        reference_value: "",
      })
      setShowAddMemberDialog(false)
    } catch (error: any) {
      toast.error('Failed to create and add member. Please try again.')
    } finally {
      setIsAddingMember(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5)
  }

  // Floating Action Buttons Component
  const FloatingButtons = () => (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      <Button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        size="sm"
        className="rounded-full w-10 h-10 shadow-lg hover:scale-110 transition-transform dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:hover:bg-gray-700 dark:backdrop-blur-sm"
        variant="outline"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button
        onClick={handleLogout}
        size="sm"
        className="rounded-full w-10 h-10 shadow-lg bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white hover:scale-110 transition-transform"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )

  // Ad-hoc NIC Search View
  if (currentView === 'adhoc-nic') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <Button variant="outline" onClick={handleReset} className="mb-4 text-sm px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="p-6 dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm shadow-xl">
            <CardHeader className="text-center pb-4 dark:border-gray-700">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 border border-indigo-200">
                <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-xl dark:text-gray-100 font-semibold">Walk-in Visit</CardTitle>
              <CardDescription className="text-sm dark:text-gray-300">Enter your NIC or ID number to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-center">
                <Label htmlFor="adhoc-nic" className="text-sm font-medium">NIC / Identification Number</Label>
                <div className="relative">
                  <Input
                    id="adhoc-nic"
                    placeholder="Enter ID Number"
                    value={adhocNic}
                    onChange={(e) => handleNicChange(e.target.value)}
                    className="text-lg font-mono tracking-wider uppercase p-4 text-center h-14"
                    onKeyPress={(e) => e.key === "Enter" && handleAdhocNicSearch()}
                    autoComplete="off"
                  />
                  
                  {showAdhocSuggestions && adhocSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 border-b dark:border-gray-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        Returning Visitor?
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {adhocSuggestions.map((m) => (
                          <div 
                            key={m.id} 
                            className="p-3 border-b dark:border-gray-700 last:border-0 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer flex items-center justify-between group transition-colors"
                            onClick={() => selectAdhocSuggestion(m)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                                {m.full_name?.[0]?.toUpperCase()}
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-sm dark:text-gray-100">{m.full_name}</p>
                                <p className="text-[10px] text-muted-foreground dark:text-gray-400 font-mono">{m.reference_value}</p>
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={handleAdhocNicSearch}
                  disabled={!adhocNic.trim() || isSearchingNic}
                  className="w-full text-base py-4 bg-gradient-to-r from-indigo-600 to-blue-600 h-14 font-bold shadow-lg"
                >
                  {isSearchingNic ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Continue
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Ad-hoc Details View
  if (currentView === 'adhoc-details') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto pb-20">
          <Button variant="outline" onClick={() => setCurrentView('adhoc-nic')} className="mb-4 text-sm px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="border-2 shadow-2xl dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50 text-center border-b-2 dark:border-b-indigo-500/30 pb-4">
              <CardTitle className="text-xl text-indigo-900 dark:text-indigo-300 font-bold">
                {adhocMember ? "Confirm Your Details" : "Register Your Details"}
              </CardTitle>
              <CardDescription className="text-sm dark:text-indigo-400/80">
                {adhocMember ? "We found your record. Please update if needed." : "Please provide your information for the security team."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-500" /> Full Name *
                  </Label>
                  <Input
                    value={newMemberForm.full_name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, full_name: e.target.value })}
                    placeholder="Enter your full name"
                    className="h-12 text-base"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-indigo-500" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={newMemberForm.email}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Phone className="h-4 w-4 text-indigo-500" /> Phone *
                    </Label>
                    <Input
                      value={newMemberForm.phone}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                      placeholder="Phone Number"
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-500" /> Company
                    </Label>
                    <Input
                      value={newMemberForm.company_name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, company_name: e.target.value })}
                      placeholder="Company Name"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Hash className="h-4 w-4 text-indigo-500" /> {newMemberForm.reference_type}
                    </Label>
                    <Input
                      value={newMemberForm.reference_value}
                      disabled
                      className="h-12 bg-muted font-mono"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!newMemberForm.full_name || !newMemberForm.phone) {
                    toast.error("Please fill in required fields")
                    return
                  }
                  setCurrentView('adhoc-purpose')
                }}
                className="w-full text-lg py-6 bg-gradient-to-r from-indigo-600 to-blue-600 h-16 font-bold shadow-xl mt-4"
              >
                Proceed to Visit Details
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Ad-hoc Purpose View
  if (currentView === 'adhoc-purpose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <Button variant="outline" onClick={() => setCurrentView('adhoc-details')} className="mb-4 text-sm px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Details
          </Button>

          <Card className="border-2 shadow-2xl dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-4 border-2 border-indigo-100 dark:border-indigo-500/30 rotate-3">
                <Activity className="h-8 w-8 text-indigo-600 dark:text-indigo-400 -rotate-3" />
              </div>
              <CardTitle className="text-2xl text-indigo-900 dark:text-indigo-100 font-bold">Purpose of Visit</CardTitle>
              <CardDescription className="text-base dark:text-gray-300">Why are you visiting us today?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Reason / Note for Security</Label>
                <textarea
                  value={adhocPurpose}
                  onChange={(e) => setAdhocPurpose(e.target.value)}
                  placeholder="e.g., Deliver items to Finance, Interview with Mr. Sam, System maintenance in Server Room..."
                  className="w-full min-h-[150px] p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 transition-all text-lg resize-none"
                />
              </div>

              <Button
                onClick={handleAdhocSubmit}
                disabled={!adhocPurpose.trim() || isLoading}
                className="w-full text-xl py-8 bg-gradient-to-br from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 h-20 font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-6 w-6 mr-3" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-6 w-6 mr-3" />
                    Submit Pass Request
                  </>
                )}
              </Button>
              
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Your request will be sent to the security desk for approval
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error View
  if (currentView === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <Card className="p-6 dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm shadow-xl">
            <CardContent className="text-center space-y-4">
              <div className="h-16 w-16 bg-destructive/10 dark:bg-red-950/40 dark:border dark:border-red-500/40 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-destructive dark:text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-destructive dark:text-red-400">Meeting Not Found</h1>
              <p className="text-sm text-muted-foreground dark:text-gray-300">{errorMessage}</p>

              <Button onClick={handleReset} className="w-full text-sm py-3 dark:bg-blue-500 dark:text-gray-950 dark:hover:bg-blue-400 dark:font-semibold shadow-md">
                <Search className="h-4 w-4 mr-2" />
                Try Another Search
              </Button>

              <div className="text-center text-muted-foreground dark:text-gray-400">
                <p className="text-sm">Need help?</p>
                <p className="text-xs">Contact reception or the meeting organizer</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Search View
  if (currentView === 'search') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-xl shadow-lg dark:shadow-blue-500/20">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground dark:text-gray-100 mb-2">Smart Assistant</h1>
            <p className="text-base text-muted-foreground dark:text-gray-300">Mark your attendance - No login required</p>
          </div>

          <Card className="p-6 dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm shadow-xl">
            <CardHeader className="text-center pb-4 dark:border-gray-700">
              <CardTitle className="text-xl dark:text-gray-100 font-semibold">Find Your Meeting</CardTitle>
              <CardDescription className="text-sm dark:text-gray-300">Enter your 6-character Meeting ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-3">
                  <Label htmlFor="meeting-id" className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    Meeting ID
                  </Label>
                  <Input
                    id="meeting-id"
                    placeholder="e.g., ABC123"
                    value={meetingId}
                    onChange={(e) => {
                      const cleanValue = sanitizeInput(e.target.value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                      setMeetingId(cleanValue.substring(0, 50))
                      setErrorMessage("")
                    }}
                    className="text-lg font-mono tracking-wider uppercase p-4 text-center"
                    maxLength={6}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <p className="text-xs text-muted-foreground">
                    The Meeting ID can be found in your invitation email
                  </p>
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={!meetingId.trim() || isLoading}
                  className="w-full text-base py-3 bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Find Meeting
                    </div>
                  )}
                </Button>

                <div className="relative pt-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground dark:text-gray-400">No Meeting ID?</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    handleReset()
                    setCurrentView('adhoc-nic')
                  }}
                  variant="outline"
                  className="w-full text-base py-3 border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-950/30 font-bold"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Walk-in / Ad-hoc Visit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Details View - Show external visitors list
  if (currentView === 'details' && meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-2xl mx-auto">
          <Button variant="outline" onClick={handleReset} className="mb-4 text-sm px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>

          <div className="space-y-4">
            {/* Meeting Details Card */}
            <Card className="border-2 border-green-500 dark:border-green-500/60 shadow-lg dark:bg-gray-800/80 dark:backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 dark:border-green-500/30 border-b-2 dark:border-b-green-500/30 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-green-900 dark:text-green-300 font-bold">{meeting.title}</CardTitle>
                    <CardDescription className="text-sm dark:text-green-400/80">Meeting Details</CardDescription>
                  </div>
                  <Badge className="bg-green-600 dark:bg-green-500 dark:text-gray-950 dark:font-semibold text-white text-sm px-3 py-1 shadow-md">
                    {meeting.booking_ref_id}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 dark:bg-gray-800/50">
                {meeting.description && (
                  <p className="text-muted-foreground dark:text-gray-300 mb-3 text-sm">{meeting.description}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500/40 rounded-lg border dark:border-blue-500/40 shadow-sm">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium dark:text-blue-200">{formatDate(meeting.booking_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-500/40 rounded-lg border dark:border-purple-500/40 shadow-sm">
                    <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium dark:text-purple-200">
                      {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-orange-50 dark:bg-orange-950/40 dark:border-orange-500/40 rounded-lg border dark:border-orange-500/40 shadow-sm">
                    <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-medium dark:text-orange-200">{meeting.place_name}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-pink-50 dark:bg-pink-950/40 dark:border-pink-500/40 rounded-lg border dark:border-pink-500/40 shadow-sm">
                    <User className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    <span className="font-medium dark:text-pink-200">{meeting.responsible_person_name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* External Visitors List */}
            <Card className="border-2 shadow-lg dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm">
              <CardHeader className={`bg-gradient-to-r ${isTodayBooking ? 'from-indigo-50 to-sky-50 dark:from-indigo-950/50 dark:to-sky-950/50 dark:border-indigo-500/30' : 'from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 dark:border-gray-700'} border-b-2 dark:border-b-gray-700 pb-3`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100 font-semibold">
                    <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="dark:text-gray-100">Select Your Name to Mark Attendance</span>
                    <Badge className="bg-indigo-600 dark:bg-indigo-500 dark:text-gray-950 dark:font-semibold text-white text-xs shadow-md">
                      {externalVisitors.length} Visitors
                    </Badge>
                  </CardTitle>
                  <Button
                    onClick={() => setShowAddMemberDialog(true)}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-400 dark:hover:to-indigo-400 dark:text-gray-950 dark:font-semibold shadow-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add External Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 dark:bg-gray-800/50">
                {externalVisitors.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground dark:text-gray-400 mb-3" />
                    <p className="text-base font-medium text-muted-foreground dark:text-gray-300">No external visitors for this meeting</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Alert className="border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/40 dark:backdrop-blur-sm">
                      <AlertDescription className="text-indigo-900 dark:text-indigo-200 text-sm font-medium">
                        <strong className="dark:text-indigo-100">Instructions:</strong> Please find your name below and click on your card to mark your attendance. If you've already marked attendance, your card will show a green checkmark.
                      </AlertDescription>
                    </Alert>

                    {externalVisitors.map((visitor) => {
                      const isAlreadyMarked = visitor.participation_status === 'confirmed' ||
                        visitor.participation_status === 'checked_in' ||
                        visitor.checked_in_at ||
                        visitor.check_in_time

                      return (
                        <Card
                          key={visitor.id}
                          className={`border-2 transition-all duration-200 ${!isAlreadyMarked
                            ? 'cursor-pointer hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-400 dark:hover:shadow-indigo-500/20 hover:scale-[1.02] bg-gradient-to-r from-white to-indigo-50/30 dark:from-gray-800/90 dark:to-indigo-950/30 dark:border-gray-700 dark:backdrop-blur-sm'
                            : 'cursor-default opacity-90 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-500/40 border-green-300'
                            }`}
                          onClick={!isAlreadyMarked ? () => handleSelectVisitor(visitor) : undefined}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-500 dark:to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                    {visitor.full_name.charAt(0).toUpperCase()}
                                  </div>
                                  <h3 className="text-lg font-bold dark:text-gray-100">{visitor.full_name}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {visitor.email && (
                                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500/40 rounded-md border dark:border-blue-500/40 shadow-sm">
                                      <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                      <span className="truncate text-blue-900 dark:text-blue-200">{visitor.email}</span>
                                    </div>
                                  )}
                                  {visitor.phone && (
                                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/40 dark:border-green-500/40 rounded-md border dark:border-green-500/40 shadow-sm">
                                      <Phone className="h-3 w-3 text-green-600 dark:text-green-400" />
                                      <span className="text-green-900 dark:text-green-200">{visitor.phone}</span>
                                    </div>
                                  )}
                                  {visitor.company_name && (
                                    <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-500/40 rounded-md border dark:border-purple-500/40 shadow-sm">
                                      <Building2 className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                      <span className="truncate text-purple-900 dark:text-purple-200">{visitor.company_name}</span>
                                    </div>
                                  )}
                                  {visitor.reference_type && (
                                    <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/40 dark:border-orange-500/40 rounded-md border dark:border-orange-500/40 shadow-sm">
                                      <Hash className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                      <span className="truncate text-orange-900 dark:text-orange-200">
                                        <span className="font-medium">{visitor.reference_type}:</span> {visitor.reference_value}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {!isAlreadyMarked ? (
                                <div className="ml-4 p-2 bg-indigo-100 dark:bg-indigo-500/20 dark:border dark:border-indigo-500/40 rounded-full shadow-sm">
                                  <ArrowRight className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                                </div>
                              ) : (
                                <div className="ml-4 flex flex-col items-center gap-1">
                                  <div className="p-2 bg-green-100 dark:bg-green-900/50 dark:border dark:border-green-500/40 rounded-full shadow-sm">
                                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">Confirmed</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Unified Add External Member Dialog */}
        <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
          setShowAddMemberDialog(open)
          if (open) setMemberDialogTab('search')
        }}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                Add External Member to Meeting
              </DialogTitle>
            </DialogHeader>

            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg mb-4">
              <button
                onClick={() => setMemberDialogTab('search')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${memberDialogTab === 'search'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
              >
                Search Existing
              </button>
              <button
                onClick={() => setMemberDialogTab('create')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${memberDialogTab === 'create'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
              >
                Create New
              </button>
            </div>

            {memberDialogTab === 'search' ? (
              <div className="space-y-4">
                <div className="space-y-3 p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-2 border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-sm">
                  <Label className="text-indigo-900 dark:text-indigo-200 font-semibold flex items-center gap-2 text-base">
                    <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg">
                      <Search className="h-4 w-4 text-white" />
                    </div>
                    Search by Reference, Name, or Email
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g., Name, Email, NIC..."
                      value={memberSearchTerm}
                      onChange={(e) => {
                        const sanitized = sanitizeInput(e.target.value)
                        setMemberSearchTerm(sanitized)
                        searchExternalMembers(sanitized)
                        setShowMemberDropdown(true)
                      }}
                      onFocus={() => memberSearchTerm.length >= 2 && setShowMemberDropdown(true)}
                      className="pl-10 border-2 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 h-10"
                    />
                  </div>
                  {showMemberDropdown && searchedMembers.length > 0 && (
                    <div className="mt-2 border-2 border-indigo-200 dark:border-indigo-500/30 rounded-lg bg-white dark:bg-gray-800 shadow-xl max-h-60 overflow-y-auto">
                      {searchedMembers.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => selectExistingMember(member)}
                          className="p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 cursor-pointer border-b last:border-b-0 dark:border-gray-700 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {member.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold dark:text-gray-100">{member.full_name}</div>
                              <div className="text-xs text-muted-foreground dark:text-gray-400 truncate">
                                {member.email} • {member.phone}
                              </div>
                            </div>
                            <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {memberSearchTerm.length >= 2 && searchedMembers.length === 0 && !isAddingMember && (
                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        No member found. <button onClick={() => setMemberDialogTab('create')} className="font-bold underline">Create a new member record</button>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200">Full Name *</Label>
                    <Input
                      value={newMemberForm.full_name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, full_name: sanitizeInput(e.target.value) })}
                      placeholder="Jane Doe"
                      className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200">Email *</Label>
                    <Input
                      type="email"
                      value={newMemberForm.email}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, email: sanitizeInput(e.target.value.toLowerCase()) })}
                      placeholder="jane@example.com"
                      className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200">Phone *</Label>
                    <Input
                      value={newMemberForm.phone}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: sanitizeInput(e.target.value) })}
                      placeholder="+94 77 123 4567"
                      className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200">Company</Label>
                    <Input
                      value={newMemberForm.company_name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, company_name: sanitizeInput(e.target.value) })}
                      placeholder="Company Name (Optional)"
                      className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200 font-medium">Designation</Label>
                    <Input
                      value={newMemberForm.designation}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, designation: sanitizeInput(e.target.value) })}
                      placeholder="e.g. Director, Manager"
                      className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-gray-200 font-medium">Reference Type *</Label>
                    <Select
                      value={newMemberForm.reference_type}
                      onValueChange={(val: any) => setNewMemberForm({ ...newMemberForm, reference_type: val })}
                    >
                      <SelectTrigger className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="NIC">NIC</SelectItem>
                        <SelectItem value="Passport">Passport</SelectItem>
                        <SelectItem value="Employee ID">Employee ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="dark:text-gray-200 font-medium">Reference Value *</Label>
                  <Input
                    value={newMemberForm.reference_value}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, reference_value: sanitizeInput(e.target.value.toUpperCase()) })}
                    placeholder="Enter ID Number"
                    className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  />
                </div>

                <Button
                  onClick={createAndAddMember}
                  disabled={isAddingMember}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-12 shadow-lg"
                >
                  {isAddingMember ? <Loader2 className="animate-spin h-5 w-5" /> : "Create & Add to Meeting"}
                </Button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end">
              <Button variant="ghost" onClick={() => setShowAddMemberDialog(false)} className="dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Confirm View
  if (currentView === 'confirm' && selectedVisitor && meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <Button variant="outline" onClick={() => setCurrentView('details')} className="mb-4 text-sm px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Visitor List
          </Button>

          <Card className="border-2 shadow-2xl dark:bg-gray-800/80 dark:border-gray-700 dark:backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 text-center border-b-2 dark:border-b-green-500/30 pb-3">
              <CardTitle className="text-xl text-green-900 dark:text-green-300 font-bold">Confirm Attendance</CardTitle>
              <CardDescription className="text-sm dark:text-green-400/80">Please confirm the details below</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 dark:bg-gray-800/50">
              {/* Meeting Info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-500/40 rounded-lg shadow-sm">
                <h3 className="font-bold text-base mb-3 text-blue-900 dark:text-blue-200">Meeting Information</h3>
                <div className="space-y-1 text-sm dark:text-blue-300">
                  <p><strong>Title:</strong> {meeting.title}</p>
                  <p><strong>Date:</strong> {formatDate(meeting.booking_date)}</p>
                  <p><strong>Time:</strong> {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</p>
                  <p><strong>Location:</strong> {meeting.place_name}</p>
                  <p><strong>Organizer:</strong> {meeting.responsible_person_name}</p>
                </div>
              </div>

              {/* Visitor Info */}
              <div className="p-4 bg-green-50 dark:bg-green-950/40 border-2 border-green-300 dark:border-green-500/40 rounded-lg shadow-sm">
                <h3 className="font-bold text-base mb-3 text-green-900 dark:text-green-200">Your Information</h3>
                <div className="space-y-1 text-sm dark:text-green-300">
                  <p><strong>Name:</strong> {selectedVisitor.full_name}</p>
                  <p><strong>Email:</strong> {selectedVisitor.email}</p>
                  <p><strong>Phone:</strong> {selectedVisitor.phone}</p>
                  {selectedVisitor.company_name && (
                    <p><strong>Company:</strong> {selectedVisitor.company_name}</p>
                  )}
                  <p><strong>{selectedVisitor.reference_type}:</strong> {selectedVisitor.reference_value}</p>
                </div>
              </div>

              <Alert className="border-green-500 dark:border-green-500/50 bg-green-50 dark:bg-green-950/40 dark:backdrop-blur-sm">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-900 dark:text-green-200 text-sm font-medium">
                  By confirming, you acknowledge your attendance at this meeting
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentView('details')}
                  className="flex-1 text-sm py-3 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAttendance}
                  disabled={isLoading}
                  className="flex-1 text-sm py-3 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 dark:hover:from-green-400 dark:hover:to-emerald-400 dark:text-gray-950 dark:font-semibold shadow-md"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Attendance
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Success View
  if (currentView === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <FloatingButtons />
        <div className="max-w-lg mx-auto">
          <Card className="border-2 border-green-500 dark:border-green-500/60 shadow-2xl dark:bg-gray-800/80 dark:backdrop-blur-sm">
            <CardContent className="pt-8 pb-8 text-center space-y-4 dark:bg-gray-800/50">
              <div className="mx-auto w-16 h-16 bg-green-500 dark:bg-green-500 rounded-full flex items-center justify-center mb-3 animate-bounce-gentle shadow-lg">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-green-900 dark:text-green-300">Attendance Confirmed!</h1>
              <p className="text-base text-muted-foreground dark:text-gray-300">
                Thank you, {selectedVisitor?.full_name}
              </p>

              <div className="bg-green-50 dark:bg-green-950/40 border-2 border-green-300 dark:border-green-500/40 rounded-lg p-4 shadow-sm">
                <p className="text-green-900 dark:text-green-200 font-semibold mb-2 text-sm">
                  ✅ Check-in successful
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Meeting: {meeting?.title}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {new Date().toLocaleString()}
                </p>
              </div>

              <Button
                onClick={handleReset}
                className="w-full text-sm py-3 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-400 dark:hover:to-purple-400 dark:text-gray-950 dark:font-semibold shadow-md"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Mark Attendance for Another Visitor
              </Button>

              <Link href="/" className="block">
                <Button variant="outline" className="w-full text-sm py-2 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-600">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fallback
  return null
}

