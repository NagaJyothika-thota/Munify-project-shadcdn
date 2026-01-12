import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import apiService from "@/services/api"
import { alerts } from "@/lib/alerts"
import { 
  MapPin, 
  Calendar, 
  Star,
  Eye,
  Heart,
  AlertCircle
} from "lucide-react"

// Helper function to normalize API response
const normalizeProjects = (data: any): any[] => {
  return data?.data || []
}

// Helper function to normalize numeric amount (in rupees)
const normalizeAmount = (amount: string | number): number => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
  return Number.isNaN(numAmount) ? 0 : numAmount
}

// Helper function to format amounts for display with dynamic units
// e.g. 950 → ₹950, 150000 → ₹1.5L, 25000000 → ₹2.5Cr
const formatAmountDisplay = (amount: number): string => {
  if (!amount || Number.isNaN(amount)) return "₹0"

  if (amount >= 10000000) {
    // 1 Cr = 10,000,000
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  }

  if (amount >= 100000) {
    // 1 Lakh = 100,000
    return `₹${(amount / 100000).toFixed(1)}L`
  }

  if (amount >= 1000) {
    // Thousands for mid‑range small amounts
    return `₹${(amount / 1000).toFixed(1)}K`
  }

  // Very small amounts – show full rupee value
  return `₹${amount.toFixed(0)}`
}

// Helper function to get progress percentage
const getProgress = (fundingPercentage: string | null | number): number => {
  if (fundingPercentage === null || fundingPercentage === undefined) return 100
  const percentage = typeof fundingPercentage === 'string' ? parseFloat(fundingPercentage) : fundingPercentage
  return isNaN(percentage) ? 100 : Math.min(100, Math.max(0, percentage))
}

// Helper function to format dates
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

export default function MyProjects() {
  const navigate = useNavigate()
  const userId = "shubhamw20" // TODO: Replace with auth user id

  // Fetch funded projects by user
  const { data, isLoading, error, isError } = useQuery<any>({
    queryKey: ['projects', 'funded-by-user', userId],
    queryFn: async () => {
      try {
        const response = await apiService.get<any>('/projects/funded-by-user', {
          committed_by: userId,
          skip: 0,
          limit: 100
        })
        return response
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to fetch funded projects'
        alerts.error('Error', errorMessage)
        throw err
      }
    },
  })

  // Normalize API response to array
  const fundedProjects = useMemo(() => {
    return normalizeProjects(data)
  }, [data])
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Funded Projects</h1>
        <p>View of funded projects by you</p>
      </div>

      {/* Error State */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {(error as any)?.response?.data?.message ||
              (error as any)?.response?.data?.detail ||
              (error as Error)?.message ||
              'Failed to fetch funded projects. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner size={20} />
            <span>Loading funded projects...</span>
          </div>
        </div>
      )}

      {/* Funded Projects */}
      {!isLoading && !isError && (
        <>
          {fundedProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No funded projects</h3>
                  <p className="text-sm text-muted-foreground">
                    You haven't funded any projects yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fundedProjects.map((project: any) => {
                // Get commitment details from API response
                const commitment = project.commitment || project.commitment_details || {}
                const commitmentStatus = commitment.status || 0
                const commitmentAmount = commitment.amount || 0
                
                const progress = getProgress(project.funding_percentage)
                const myInvestment = normalizeAmount(commitmentAmount)
                const expectedROI = commitment.interest_rate || project.average_interest_rate || null
                const currentValue = expectedROI ? myInvestment * (1 + (expectedROI / 100)) : myInvestment
                const municipality = project.city || project.state || project.organization_id || 'N/A'
                const stateDisplay = project.state || 'N/A'
                const statusDisplay = commitmentStatus
                  ? commitmentStatus.split('_').map((word: string) =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
                  : 'Live'
                const projectImage = project.image || 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=200&fit=crop&crop=center'
                const investmentDate = commitment.created_at || commitment.commitment_date || project.created_at || project.fundraising_start_date || new Date().toISOString()
                
                // Extract commitment-specific fields
                const projectReferenceId = project.project_reference_id || commitment.project_reference_id || 'N/A'
                const fundingMode = commitment.funding_mode || project.funding_mode || 'N/A'
                const tenureMonths = commitment.tenure_months || project.tenure_months || null
                const termsConditions = commitment.terms_conditions_text || commitment.terms || project.terms_conditions_text || null

                return (
                  <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-gradient-to-r from-blue-500 to-purple-600 relative">
                      <img
                        src={projectImage}
                        alt={project.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=200&fit=crop&crop=center'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute top-4 right-4">
                        <Badge variant="secondary" className="bg-green-600">
                          {statusDisplay}
                        </Badge>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">{municipality}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Star className="h-4 w-4" />
                            <span className="text-sm">My Investment</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{project.title || 'Untitled Project'}</CardTitle>
                          <CardDescription className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3" />
                            <span>{stateDisplay}</span>
                          </CardDescription>
                          <div className="pt-1">
                            <span className="text-xs text-muted-foreground">Ref ID: </span>
                            <span className="text-xs font-mono font-medium">{projectReferenceId}</span>
                          </div>
                        </div>
                        <Badge variant="outline">{project.category || 'N/A'}</Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Investment Details */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>My Investment</span>
                          <span className="font-medium">{formatAmountDisplay(myInvestment)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Current Value</span>
                          <span className="font-medium text-green-600">{formatAmountDisplay(currentValue)}</span>
                        </div>
                        {expectedROI !== null && (
                          <div className="flex justify-between text-sm">
                            <span>Interest Rate</span>
                            <span className="font-medium text-blue-600">{Math.round(expectedROI * 10) / 10}%</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span>Funding Mode</span>
                          <span className="font-medium capitalize">{fundingMode}</span>
                        </div>
                        {tenureMonths && (
                          <div className="flex justify-between text-sm">
                            <span>Tenure</span>
                            <span className="font-medium">{tenureMonths} {tenureMonths === 1 ? 'Month' : 'Months'}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Project Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Project Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      
                      {/* Investment Date */}
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Invested: {formatDate(investmentDate)}</span>
                      </div>
                      
                      {/* Terms & Conditions */}
                      {termsConditions && (
                        <div className="pt-2 border-t">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Terms & Conditions</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {termsConditions}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-4">
                        <Button 
                          className="flex-1"
                          onClick={() => navigate(`/main/projects/${project.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button variant="outline" size="icon">
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
