import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LoadingOverlay, Spinner } from "@/components/ui/spinner"
import { alerts } from "@/lib/alerts"
import { apiService } from "@/services/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { KeyRound, MailCheck, ShieldCheck, Eye, EyeOff, RotateCcw } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface GenerateOtpRequest {
  userId: string
}

interface ResetPasswordRequest {
  userId: string
  otp: string
  newPassword: string
  confirmPassword: string
}

export default function ForgotPassword() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const OTP_RESEND_DELAY = 50

  const [resendCountdown, setResendCountdown] = useState(0)
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [activeTab, setActiveTab] = useState<"request" | "reset">("request")
  const [otpRequestedFor, setOtpRequestedFor] = useState<string>("")

  const [requestForm, setRequestForm] = useState<GenerateOtpRequest>({ userId: "" })
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})

  const [resetForm, setResetForm] = useState<ResetPasswordRequest>({
    userId: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({})

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Refs to prevent duplicate submissions (works even in StrictMode)
  const isSubmittingRequest = useRef(false)
  const isSubmittingReset = useRef(false)

  const onChangeRequest = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setRequestForm(prev => ({ ...prev, [id]: value }))
    if (requestErrors[id]) setRequestErrors(prev => ({ ...prev, [id]: "" }))
  }

  const onChangeReset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setResetForm(prev => ({ ...prev, [id]: value }))
    if (resetErrors[id]) setResetErrors(prev => ({ ...prev, [id]: "" }))
  }

  const validateRequest = () => {
    const errs: Record<string, string> = {}
    if (!requestForm.userId.trim()) errs.userId = "Please enter your user ID."
    setRequestErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateReset = () => {
    const errs: Record<string, string> = {}
    if (!resetForm.userId.trim()) errs.userId = "User ID is required."
    if (!resetForm.otp.trim()) errs.otp = "OTP is required."
    if (!resetForm.newPassword.trim()) errs.newPassword = "New password is required."
    if (!resetForm.confirmPassword.trim()) errs.confirmNewPassword = "Please confirm your new password."
    if (
      resetForm.newPassword.trim() &&
      resetForm.confirmPassword.trim() &&
      resetForm.newPassword !== resetForm.confirmPassword
    ) {
      errs.confirmNewPassword = "Passwords do not match."
    }
    if (resetForm.newPassword && resetForm.newPassword.length < 6) {
      errs.newPassword = "Password must be at least 6 characters."
    }
    setResetErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Helper function to extract error message from API response
  const extractResetErrorMessage = (error: any): string => {
    const responseData = error?.response?.data
    
    if (!responseData) {
      return "Failed to reset password. Please try again."
    }

    // Format 1: Check for simple error message in data.error
    if (responseData.data?.error && typeof responseData.data.error === "string") {
      return responseData.data.error
    }

    // Format 2: Check for errors object with field-specific errors
    if (responseData.data?.errors && typeof responseData.data.errors === "object") {
      const errors = responseData.data.errors
      
      // Priority 1: Check for OTP-specific errors
      if (errors.otp && Array.isArray(errors.otp) && errors.otp.length > 0) {
        // Return the first OTP error message
        return errors.otp.join("\n")
      }
      
      // Priority 2: Check for empty key errors (general validation errors)
      if (errors[""] && Array.isArray(errors[""]) && errors[""].length > 0) {
        return errors[""][0]
      }
      
      // Priority 3: Check for other field errors (newPassword, confirmPassword, etc.)
      const errorKeys = Object.keys(errors)
      for (const key of errorKeys) {
        if (Array.isArray(errors[key]) && errors[key].length > 0) {
          return errors[key][0]
        }
      }
    }

    // Fallback: Use the main message or default error
    return responseData.message || "Failed to reset password. Please try again."
  }

  const generateOtpMutation = useMutation({
    mutationKey: ["auth", "forgot-password", "otp"],
    mutationFn: async (payload: GenerateOtpRequest) => {
      return await apiService.post("/auth/forgot-password/otp", payload)
    },
    retry: false, // Prevent automatic retries
    onSuccess: (data: any, variables) => {
      const text: string | undefined = data?.data?.text || data?.message
      const smsStatus: string | undefined = data?.data?.smsStatus
      const emailStatus: string | undefined = data?.data?.emailStatus
      const details = [text?.trim(), (smsStatus || emailStatus) ? `SMS: ${smsStatus || "N/A"}, Email: ${emailStatus || "N/A"}` : undefined]
        .filter(Boolean)
        .join(" \u2013 ")
      alerts.success("OTP Sent", details || "Please check your registered contact for the OTP.")
      setOtpRequestedFor(variables.userId)
      setResetForm(prev => ({ ...prev, userId: variables.userId }))
      setActiveTab("reset")
      setRequestForm({ userId: "" })
      setResendCountdown(OTP_RESEND_DELAY)

  if (resendTimerRef.current) {
    clearInterval(resendTimerRef.current)
  }

  resendTimerRef.current = setInterval(() => {
    setResendCountdown(prev => {
      if (prev <= 1) {
        clearInterval(resendTimerRef.current!)
        resendTimerRef.current = null
        return 0
      }
      return prev - 1
    })
  }, 1000)
      queryClient.invalidateQueries({ queryKey: ["auth", "forgot-password"] })
    },
    onError: (error: any) => {
      // Handle error response structure: { status: "error", message: { error: "...", errorId: "..." } }
      const errorMessage = error?.response?.data?.message?.error || 
                          (typeof error?.response?.data?.message === 'string' ? error?.response?.data?.message : null) ||
                          "Failed to send OTP. Please try again."
      alerts.error("OTP Error", errorMessage)
    },
    onSettled: () => {
      // Always reset submission flag when mutation completes (success or error)
      isSubmittingRequest.current = false
    },
  })

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current)
      }
    }
  }, [])

  const resetPasswordMutation = useMutation({
    mutationKey: ["auth", "forgot-password", "reset"],
    mutationFn: async (payload: ResetPasswordRequest) => {
      // Endpoint per provided cURL: /auth/change-password/otp
      return await apiService.post("/auth/change-password/otp", payload)
    },
    retry: false, // Prevent automatic retries
    onSuccess: (response: any) => {
      const message = response?.data?.text
      alerts.success("Password Reset", message)
      setResetForm({ userId: "", otp: "", newPassword: "", confirmPassword: "" })
      setActiveTab("request")
      queryClient.invalidateQueries({ queryKey: ["auth", "forgot-password"] })
      navigate("/login")
    },
    onError: (error: any) => {
      const errorMessage = extractResetErrorMessage(error)
      alerts.error("Reset Error", errorMessage)
    },
    onSettled: () => {
      // Always reset submission flag when mutation completes (success or error)
      isSubmittingReset.current = false
    },
  })

  const onSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling
    
    // Prevent duplicate submissions - check ref flag first (synchronous, prevents StrictMode double calls)
    if (isSubmittingRequest.current) {
      return
    }
    
    // Also check if mutation is already pending
    if (generateOtpMutation.isPending) {
      return
    }
    
    if (!validateRequest()) {
      alerts.error("Validation Error", "Please correct the highlighted fields.")
      return
    }
    
    // Set flag immediately BEFORE mutation to prevent duplicate submissions
    isSubmittingRequest.current = true
    generateOtpMutation.mutate({ userId: requestForm.userId.trim() })
  }

  const onSubmitReset = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling
    
    // Prevent duplicate submissions - check ref flag first (synchronous, prevents StrictMode double calls)
    if (isSubmittingReset.current) {
      return
    }
    
    // Also check if mutation is already pending
    if (resetPasswordMutation.isPending) {
      return
    }
    
    if (!validateReset()) {
      alerts.error("Validation Error", "Please correct the highlighted fields.")
      return
    }
    
    // Set flag immediately BEFORE mutation to prevent duplicate submissions
    isSubmittingReset.current = true
    resetPasswordMutation.mutate({
      userId: resetForm.userId.trim(),
      otp: resetForm.otp.trim(),
      newPassword: resetForm.newPassword,
      confirmPassword: resetForm.confirmPassword,
    })
  }

  const isRequesting = generateOtpMutation.isPending
  const isResetting = resetPasswordMutation.isPending
  const loading = isRequesting || isResetting

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <LoadingOverlay show={loading} />
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>Recover access to your Munify account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="request" disabled={isResetting}>Request OTP</TabsTrigger>
                <TabsTrigger value="reset" disabled={!otpRequestedFor && activeTab !== "reset" || isRequesting}>Reset Password</TabsTrigger>
              </TabsList>

              <TabsContent value="request" className="mt-6">
                <form className="space-y-6" onSubmit={onSubmitRequest}>
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <div className="relative">
                      <Input
                        id="userId"
                        type="text"
                        placeholder="Enter your user ID"
                        value={requestForm.userId}
                        onChange={onChangeRequest}
                        disabled={isRequesting}
                      />
                      {requestErrors.userId && (
                        <span className="absolute right-0 -bottom-5 text-xs text-red-600">{requestErrors.userId}</span>
                      )}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isRequesting}>
                    {isRequesting ? (
                      <span className="inline-flex items-center gap-2"><Spinner size={16} /> Sending OTP...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><MailCheck className="h-4 w-4" /> Send OTP</span>
                    )}
                  </Button>
                  {otpRequestedFor && (
                    <Alert>
                      <AlertTitle>OTP Requested</AlertTitle>
                      <AlertDescription>
                        An OTP has been requested for user ID: <span className="font-medium">{otpRequestedFor}</span>.
                        Proceed to the Reset Password tab once you receive it.
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="reset" className="mt-6">
                <form className="space-y-6" onSubmit={onSubmitReset}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="userId">User ID</Label>
                      <div className="relative">
                        <Input
                          id="userId"
                          type="text"
                          placeholder="Enter your user ID"
                          value={resetForm.userId}
                          onChange={onChangeReset}
                          disabled={isResetting}
                        />
                        {resetErrors.userId && (
                          <span className="absolute right-0 -bottom-5 text-xs text-red-600">{resetErrors.userId}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otp">OTP</Label>
                      <div className="relative">
                        <Input
                          id="otp"
                          type="text"
                          placeholder="Enter the OTP"
                          value={resetForm.otp}
                          onChange={onChangeReset}
                          disabled={isResetting}
                        />
                        {resetErrors.otp && (
                          <span className="absolute right-0 -bottom-5 text-xs text-red-600">{resetErrors.otp}</span>
                        )}
                      </div>
                      {(resetForm.userId || otpRequestedFor) && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto px-0 py-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            onClick={() => {
                              const userIdToUse = resetForm.userId.trim() || otpRequestedFor.trim()
                              if (!isSubmittingRequest.current && !generateOtpMutation.isPending && userIdToUse) {
                                isSubmittingRequest.current = true
                                generateOtpMutation.mutate({ userId: userIdToUse })
                              }
                            }}
                            disabled={isRequesting || isResetting || resendCountdown > 0 || !(resetForm.userId.trim() || otpRequestedFor.trim())}
                          >
                            {isRequesting ? (
                              <span className="inline-flex items-center gap-1">
                                <Spinner size={12} />
                                Sending...
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {resendCountdown > 0 && `(${resendCountdown}s)`}
                                <RotateCcw className="h-3 w-3" />
                                Resend OTP
                              </span>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={resetForm.newPassword}
                        onChange={onChangeReset}
                        disabled={isResetting}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isResetting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      {resetErrors.newPassword && (
                        <span className="absolute right-0 -bottom-5 text-xs text-red-600">{resetErrors.newPassword}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={resetForm.confirmPassword}
                        onChange={onChangeReset}
                        disabled={isResetting}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isResetting}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      {resetErrors.confirmNewPassword && (
                        <span className="absolute right-0 -bottom-5 text-xs text-red-600">{resetErrors.confirmNewPassword}</span>
                      )}
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isResetting}>
                    {isResetting ? (
                      <span className="inline-flex items-center gap-2"><Spinner size={16} /> Resetting...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password</span>
                    )}
                  </Button>

                  {!otpRequestedFor && activeTab === "reset" && (
                    <Alert>
                      <AlertTitle>Note</AlertTitle>
                      <AlertDescription>
                        If you haven’t requested an OTP yet, go to the Request OTP tab first.
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="mt-4 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          We never share your credentials with anyone.
        </div>
      </div>
    </div>
  )
}


