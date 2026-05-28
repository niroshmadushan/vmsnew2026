/**
 * Booking Email API Service
 * 
 * A comprehensive service for managing booking-related emails including:
 * - Getting booking participants
 * - Sending booking details
 * - Sending reminders
 * - Tracking email history
 */

export interface BookingParticipant {
  id: string
  full_name: string
  email: string
  phone?: string
  company_name?: string
  member_type: 'visitor' | 'contractor' | 'vendor' | 'guest' | 'employee'
  user_id?: string
  has_email: number
}

export interface BookingData {
  id: string
  title: string
  start_time: string
  end_time: string
  place_name: string
  description?: string
}

export interface EmailResult {
  participantId: string
  participantName: string
  participantEmail: string
  success: boolean
  message: string
}

export interface EmailHistoryEntry {
  id: string
  booking_id: string
  sent_by: number
  email_type: 'booking_details' | 'booking_confirmation' | 'reminder_24_hours' | 'reminder_1_hour' | 'custom'
  participants_count: number
  sent_at: string
  sent_by_name: string
  sent_by_email: string
  results: EmailResult[]
}

export interface BookingParticipantsResponse {
  success: boolean
  message: string
  data: {
    booking: BookingData
    participants: BookingParticipant[]
    totalParticipants: number
    participantsWithEmail: number
  }
}

export interface SendEmailResponse {
  success: boolean
  message: string
  data: {
    bookingId: string
    bookingTitle: string
    totalParticipants: number
    emailsSent: number
    emailsFailed: number
    results: EmailResult[]
  }
}

export interface EmailHistoryResponse {
  success: boolean
  message: string
  data: {
    bookingId: string
    emailHistory: EmailHistoryEntry[]
    totalEmailsSent: number
  }
}

export class BookingEmailAPI {
  private baseURL: string
  private token: string

  constructor(baseURL: string = '/api', token?: string) {
    this.baseURL = baseURL
    this.token = token || this.getTokenFromStorage()
  }

  private getTokenFromStorage(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || localStorage.getItem('jwt_token') || ''
    }
    return ''
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`

    // Get required headers from environment (same as OTP email sending)
    const appId = process.env.NEXT_PUBLIC_APP_ID || 'default_app_id'
    const serviceKey = process.env.NEXT_PUBLIC_SERVICE_KEY || 'default_service_key'

    const headers = {
      'Content-Type': 'application/json',
      'X-App-Id': appId,
      'X-Service-Key': serviceKey,
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    }

    console.log(`📧 Booking Email API: ${options.method || 'GET'} ${url}`)
    console.log(`🔑 Headers: X-App-Id=${appId}, X-Service-Key=${serviceKey ? '✅ Set' : '❌ Missing'}, Authorization=${this.token ? '✅ Set' : '❌ Missing'}`)

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ Booking Email API Error:`, errorData)
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  }

  /**
   * Get all participants for a specific booking
   */
  async getParticipants(bookingId: string): Promise<BookingParticipantsResponse> {
    const response = await this.makeRequest(`/booking-email/${bookingId}/participants`)
    return response.json()
  }

  /**
   * Send booking details to selected participants
   */
  async sendBookingDetails(
    bookingId: string,
    options: {
      participantIds?: string[]
      emailType?: 'booking_details' | 'booking_confirmation'
      customMessage?: string
    } = {}
  ): Promise<SendEmailResponse> {
    const response = await this.makeRequest(`/booking-email/${bookingId}/send-details`, {
      method: 'POST',
      body: JSON.stringify({
        participantIds: options.participantIds,
        emailType: options.emailType || 'booking_details',
        customMessage: options.customMessage,
      }),
    })

    return response.json()
  }

  /**
   * Send reminder emails to participants
   */
  async sendReminder(
    bookingId: string,
    reminderType: '24_hours' | '1_hour',
    customMessage?: string
  ): Promise<SendEmailResponse> {
    const response = await this.makeRequest(`/booking-email/${bookingId}/send-reminder`, {
      method: 'POST',
      body: JSON.stringify({
        reminderType,
        customMessage,
      }),
    })

    return response.json()
  }

  /**
   * Get email sending history for a booking
   */
  async getEmailHistory(bookingId: string): Promise<EmailHistoryResponse> {
    const response = await this.makeRequest(`/booking-email/${bookingId}/history`)
    return response.json()
  }

  /**
   * Send booking details to all participants with email addresses
   */
  async sendToAllParticipants(
    bookingId: string,
    emailType: 'booking_details' | 'booking_confirmation' = 'booking_details',
    customMessage?: string
  ): Promise<SendEmailResponse> {
    return this.sendBookingDetails(bookingId, {
      emailType,
      customMessage,
      // No participantIds means send to all
    })
  }

  /**
   * Send booking details to specific participants by email addresses
   */
  async sendToParticipantsByEmail(
    bookingId: string,
    emailAddresses: string[],
    emailType: 'booking_details' | 'booking_confirmation' = 'booking_details',
    customMessage?: string
  ): Promise<SendEmailResponse> {
    // First get all participants to find their IDs
    const participantsData = await this.getParticipants(bookingId)

    // Filter participants by email addresses
    const participantIds = participantsData.data.participants
      .filter(p => emailAddresses.includes(p.email))
      .map(p => p.id)

    if (participantIds.length === 0) {
      throw new Error('No participants found with the provided email addresses')
    }

    return this.sendBookingDetails(bookingId, {
      participantIds,
      emailType,
      customMessage,
    })
  }

  /**
   * Check if a booking has participants with email addresses
   */
  async hasParticipantsWithEmail(bookingId: string): Promise<boolean> {
    try {
      const data = await this.getParticipants(bookingId)
      return data.data.participantsWithEmail > 0
    } catch (error) {
      console.error('Error checking participants:', error)
      return false
    }
  }

  /**
   * Get participants count summary
   */
  async getParticipantsSummary(bookingId: string): Promise<{
    total: number
    withEmail: number
    withoutEmail: number
  }> {
    const data = await this.getParticipants(bookingId)
    const total = data.data.totalParticipants
    const withEmail = data.data.participantsWithEmail
    const withoutEmail = total - withEmail

    return { total, withEmail, withoutEmail }
  }
}

// Export a default instance
export const bookingEmailAPI = new BookingEmailAPI()

/**
 * Send booking email with all details from frontend (simplified API - no database queries)
 * This is a simpler alternative that accepts all booking data directly from the frontend
 */
export async function sendBookingEmailFromFrontend(data: {
  meetingName: string
  date: string
  startTime: string
  endTime: string
  place?: string
  description?: string
  participantEmails: string[]
  emailType?: 'booking_details' | 'booking_confirmation'
  customMessage?: string
  includeCalendar?: boolean
  calendarFormat?: 'ics' | 'google' | 'outlook'
  bookingRefId?: string
}): Promise<{
  success: boolean
  message: string
  data?: {
    meetingName: string
    totalParticipants: number
    emailsSent: number
    emailsFailed: number
    results: Array<{
      participantEmail: string
      success: boolean
      message: string
    }>
  }
  error?: string
}> {
  try {
    console.log('📧 ==========================================')
    console.log('📧 LIBRARY - SEND BOOKING EMAIL FROM FRONTEND')
    console.log('📧 ==========================================')
    console.log('📧 Meeting Name:', data.meetingName)
    console.log('📧 Date:', data.date)
    console.log('📧 Start Time:', data.startTime)
    console.log('📧 End Time:', data.endTime)
    console.log('📧 Place:', data.place || 'Not specified')
    console.log('📧 Description:', data.description || 'Not specified')
    console.log('📧 Participant Emails Count:', data.participantEmails.length)
    console.log('📧 Participant Emails:', data.participantEmails)
    console.log('📧 Email Type:', data.emailType || 'booking_details')
    console.log('📧 Custom Message:', data.customMessage || '(none)')

    // Get token from localStorage
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('authToken') ||
        localStorage.getItem('jwt_token') ||
        localStorage.getItem('token') ||
        '')
      : ''

    console.log('📧 Token Available:', !!token)
    console.log('📧 Token Preview:', token ? token.substring(0, 20) + '...' : 'NO TOKEN')

    if (!token) {
      console.error('❌ Authentication token not found')
      throw new Error('Authentication token not found')
    }

    console.log('📧 ==========================================')
    console.log('📧 SENDING API REQUEST')
    console.log('📧 ==========================================')
    console.log('📧 API URL: /api/booking-email/send-from-frontend')
    console.log('📧 Method: POST')
    console.log('📧 Headers:', {
      'Content-Type': 'application/json',
      'Authorization': token ? 'Bearer ' + token.substring(0, 20) + '...' : '❌ Missing'
    })

    const apiUrl = '/api/booking-email/send-from-frontend'
    const requestStartTime = Date.now()
    // Get required headers from environment (same as OTP email sending)
    const appId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_ID || 're_J561ebQe_8pHNiwDmVVxV46rs3V8FMRUQ' : 're_J561ebQe_8pHNiwDmVVxV46rs3V8FMRUQ'
    const serviceKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SERVICE_KEY || 're_J561ebQe_8pHNiwDmVVxV46rs3V8FMRUQ12345' : 're_J561ebQe_8pHNiwDmVVxV46rs3V8FMRUQ12345'

    console.log('📧 Sending API request to:', apiUrl)

    // Add calendar options if not already present
    const requestBody = {
      ...data,
      includeCalendar: data.includeCalendar !== undefined ? data.includeCalendar : true,
      calendarFormat: data.calendarFormat || 'ics'
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-App-Id': appId,
        'X-Service-Key': serviceKey
      },
      body: JSON.stringify(requestBody)
    })

    const requestDuration = Date.now() - requestStartTime
    console.log('📧 ==========================================')
    console.log('📧 API RESPONSE RECEIVED')
    console.log('📧 ==========================================')
    console.log('📧 Response Status:', response.status)
    console.log('📧 Response OK:', response.ok)
    console.log('📧 Request Duration:', requestDuration + 'ms')

    if (response.status === 401) {
      console.error('❌ Authentication failed (401)')
      throw new Error('Authentication failed')
    }

    const result = await response.json()
    console.log('📧 ==========================================')
    console.log('📧 LIBRARY - EMAIL SENDING RESULT')
    console.log('📧 ==========================================')
    console.log('📧 Success:', result.success)
    console.log('📧 Message:', result.message)
    if (result.data) {
      console.log('📧 Meeting Name:', result.data.meetingName)
      console.log('📧 Total Participants:', result.data.totalParticipants)
      console.log('📧 Emails Sent:', result.data.emailsSent)
      console.log('📧 Emails Failed:', result.data.emailsFailed)
      console.log('📧 Success Rate:', result.data.totalParticipants > 0
        ? `${((result.data.emailsSent / result.data.totalParticipants) * 100).toFixed(1)}%`
        : 'N/A')
    }
    if (result.error) {
      console.error('❌ Error:', result.error)
    }
    console.log('📧 ==========================================')

    return result
  } catch (error: any) {
    console.error('❌ ==========================================')
    console.error('❌ LIBRARY - EMAIL SENDING ERROR')
    console.error('❌ ==========================================')
    console.error('❌ Error Type:', error.constructor.name)
    console.error('❌ Error Message:', error.message)
    console.error('❌ Error Stack:', error.stack)
    console.error('❌ Full Error:', error)
    console.error('❌ ==========================================')

    return {
      success: false,
      message: error.message || 'Failed to send booking emails',
      error: error.message
    }
  }
}

// Export utility functions
export const formatBookingTime = (startTime: string, endTime: string): string => {
  const start = new Date(startTime)
  const end = new Date(endTime)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return `${formatTime(start)} - ${formatTime(end)}`
}

export const formatBookingDate = (dateTime: string): string => {
  const date = new Date(dateTime)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const getReminderTypeLabel = (type: '24_hours' | '1_hour'): string => {
  return type === '24_hours' ? '24 Hours Before' : '1 Hour Before'
}

export const getEmailTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'booking_details': 'Booking Details',
    'booking_confirmation': 'Booking Confirmation',
    'reminder_24_hours': '24-Hour Reminder',
    'reminder_1_hour': '1-Hour Reminder',
    'custom': 'Custom Message'
  }
  return labels[type] || type
}

