import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Edit, Building2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataTable, type ColumnDef } from '@/components/data-table/data-table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronDown, File as FileIcon, X, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiService, { api } from '@/services/api'
import { alerts } from '@/lib/alerts'
import { toast } from '@/hooks/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FeeConfigurationDialog } from '../components/FeeConfigurationDialog'

interface Organization {
  id: number
  bankId: number
  version: number
  parentBranchId: number
  branchName: string
  branchMailId: string
  pinCode: number
  branchOpenDate: string
  cashLimit: number
  fingerPrintDeviceType: string
}

type OrganizationItem = {
  id: number
  branchName: string
  version?: number
}

type OrganizationForm = {
  bankId: number
  parentBranchId: number
  branchName: string
  branchMailId: string
  pinCode: string
  branchOpenDate: string
  cashLimit: number
  fingerPrintDeviceType: string
  // Conditional fields for Lender
  lenderType?: string // Bank, NBFC, Multilateral, Philanthropy, Other
  panNumber?: string
  gstNumber?: string
  panDocument?: File | null
  gstDocument?: File | null
  // Conditional fields for Municipality
  state?: string
  district?: string
}

export default function OrganizationsManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [formData, setFormData] = useState<OrganizationForm>({
    bankId: 1,
    parentBranchId: 1,
    branchName: '',
    branchMailId: '',
    pinCode: '',
    branchOpenDate: '',
    cashLimit: 0,
    fingerPrintDeviceType: 'SAGEM',
    lenderType: '',
    panNumber: '',
    gstNumber: '',
    panDocument: null,
    gstDocument: null,
    state: '',
    district: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrgType, setSelectedOrgType] = useState<string>('')
  const [orgTypeOpen, setOrgTypeOpen] = useState(false)
  // Store existing document information for edit mode
  const [existingPanDocument, setExistingPanDocument] = useState<any>(null)
  const [existingGstDocument, setExistingGstDocument] = useState<any>(null)
  // Fee configuration dialog state
  const [isFeeConfigDialogOpen, setIsFeeConfigDialogOpen] = useState(false)
  const [selectedOrgForFeeConfig, setSelectedOrgForFeeConfig] = useState<{
    id: number
    name: string
    type: 'lender' | 'municipality'
    parentBranchId: number
  } | null>(null)
  // Municipality dropdown state
  const [municipalityOpen, setMunicipalityOpen] = useState(false)

  // Fetch organization types using Perdix API with parent_branch_id: 999
  const {
    data: organizationTypes = [],
    isLoading: loadingOrgTypes,
  } = useQuery({
    queryKey: ["organizationTypes"],
    queryFn: async () => {
      const response = await apiService.post("/perdix/query", {
        identifier: "childBranch.list",
        limit: 0,
        offset: 0,
        parameters: {
          parent_branch_id: 999
        },
        skip_relogin: "yes"
      }, {
        usePerdixTimeout: true
      })
      // Extract results array and map branch_name to branchName for consistency
      const results = (response as any)?.results || []
      return results.map((item: any): OrganizationItem => ({
        id: item.id,
        branchName: item.branch_name || item.branchName,
        version: item.version
      }))
    },
  })

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations()
  }, [])

  // Update selectedOrgType when organizationTypes loads and we're editing
  useEffect(() => {
    if (editingOrganization && organizationTypes.length > 0 && isEditDialogOpen) {
      const parentOrgType = organizationTypes.find((org: OrganizationItem) => org.id === editingOrganization.parentBranchId)
      if (parentOrgType) {
        const orgTypeValue = `${parentOrgType.id}-${parentOrgType.branchName}`
        // Only update if it's different to avoid unnecessary re-renders
        if (selectedOrgType !== orgTypeValue) {
          setSelectedOrgType(orgTypeValue)
          // Also update formData.parentBranchId to ensure consistency
          setFormData(prev => ({ ...prev, parentBranchId: parentOrgType.id }))
        }
      }
    }
  }, [organizationTypes, editingOrganization, isEditDialogOpen])

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiService.get('/organizations/organizations')
      setOrganizations(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Failed to fetch organizations. Please try again.')
      console.error('Error fetching organizations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Use useMemo to create the Map only when organizationTypes change
const organizationTypeMap = useMemo(() => {
  const map = new Map<number, string>();
  organizationTypes.forEach((item: OrganizationItem) => {
    map.set(item.id, item.branchName);
  });
  return map;
}, [organizationTypes]);


  const handleCreateOrganization = async () => {
    try {
      if (submitting) return
      setSubmitting(true)
      
      // Validate all required fields
      if (!selectedOrgType) {
        toast({ title: 'Validation Error', description: 'Organization type is required', variant: 'destructive' })
        return
      }
      if (!formData.branchName.trim()) {
        toast({ title: 'Validation Error', description: 'Organization name is required', variant: 'destructive' })
        return
      }
      if (!formData.branchMailId.trim()) {
        toast({ title: 'Validation Error', description: 'Organization email is required', variant: 'destructive' })
        return
      }
      if (!formData.pinCode || formData.pinCode.length !== 6) {
        toast({ title: 'Validation Error', description: 'Valid pin code is required (6 digits)', variant: 'destructive' })
        return
      }
      if (!formData.branchOpenDate) {
        toast({ title: 'Validation Error', description: 'Organization open date is required', variant: 'destructive' })
        return
      }

      // Validate conditional fields based on organization type
      if (isLenderType()) {
        if (!formData.lenderType) {
          toast({ title: 'Validation Error', description: 'Type of Lender is required', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.panNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'PAN Number is required for Lender', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.gstNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'GST Number is required for Lender', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }
      
      if (isMunicipalityType()) {
        if (!formData.state?.trim()) {
          toast({ title: 'Validation Error', description: 'State is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.district?.trim()) {
          toast({ title: 'Validation Error', description: 'District is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.panNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'PAN Number is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.gstNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'GST Number is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }

      // Always use FormData as API is designed to accept FormData
      const formDataObj = buildFormData(false)
      await apiService.post('/organizations/create', formDataObj, {
        // axios will automatically set Content-Type to multipart/form-data for FormData
      })
      alerts.success("Success", "Organization created successfully")
      setIsCreateDialogOpen(false)
      resetForm()
      fetchOrganizations()
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to create organization. Please try again."
      alerts.error("Error", message)
      setIsCreateDialogOpen(false)
      console.error('Error creating organization:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOrganization = async () => {
    if (!editingOrganization) return

    try {
      if (submitting) return
      setSubmitting(true)
      
      // Validate all required fields
      if (!selectedOrgType) {
        toast({ title: 'Validation Error', description: 'Organization type is required', variant: 'destructive' })
        return
      }
      if (!formData.branchName.trim()) {
        toast({ title: 'Validation Error', description: 'Organization name is required', variant: 'destructive' })
        return
      }
      if (!formData.branchMailId.trim()) {
        toast({ title: 'Validation Error', description: 'Organization email is required', variant: 'destructive' })
        return
      }
      if (!formData.pinCode || formData.pinCode.length !== 6) {
        toast({ title: 'Validation Error', description: 'Valid pin code is required (6 digits)', variant: 'destructive' })
        return
      }
      if (!formData.branchOpenDate) {
        toast({ title: 'Validation Error', description: 'Organization open date is required', variant: 'destructive' })
        return
      }

      // Validate conditional fields based on organization type
      if (isLenderType()) {
        if (!formData.lenderType) {
          toast({ title: 'Validation Error', description: 'Type of Lender is required', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.panNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'PAN Number is required for Lender', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.gstNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'GST Number is required for Lender', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }
      
      if (isMunicipalityType()) {
        if (!formData.state?.trim()) {
          toast({ title: 'Validation Error', description: 'State is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.district?.trim()) {
          toast({ title: 'Validation Error', description: 'District is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.panNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'PAN Number is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
        if (!formData.gstNumber?.trim()) {
          toast({ title: 'Validation Error', description: 'GST Number is required for Municipality', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }

      // Extract parentBranchId from selectedOrgType to ensure it's correct
      const parentBranchId = selectedOrgType ? parseInt(selectedOrgType.split('-')[0]) : formData.parentBranchId
      
      // Always use FormData as API is designed to accept FormData
      const formDataObj = buildFormData(true, parentBranchId, 1) // true = include id and version
      
      await apiService.put(`/organizations/organizations`, formDataObj, {
        // axios will automatically set Content-Type to multipart/form-data for FormData
      })
      alerts.success("Success", "Organization updated successfully")
      setIsEditDialogOpen(false)
      setEditingOrganization(null)
      resetForm()
      fetchOrganizations()
    } catch (err) {
      alerts.error("Error", "Failed to update organization. Please try again.")
      setIsEditDialogOpen(false)
      console.error('Error updating organization:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      bankId: 1,
      parentBranchId: 1,
      branchName: '',
      branchMailId: '',
      pinCode: '',
      branchOpenDate: '',
      cashLimit: 0,
      fingerPrintDeviceType: 'SAGEM',
      lenderType: '',
      panNumber: '',
      gstNumber: '',
      panDocument: null,
      gstDocument: null,
      state: '',
      district: ''
    })
    setSelectedOrgType('')
    setOrgTypeOpen(false)
    setExistingPanDocument(null)
    setExistingGstDocument(null)
  }

  const openEditDialog = async (organization: Organization) => {
    setEditingOrganization(organization)
    setFormData({
      bankId: organization.bankId,
      parentBranchId: organization.parentBranchId,
      branchName: organization.branchName,
      branchMailId: organization.branchMailId,
      pinCode: organization.pinCode.toString(),
      branchOpenDate: organization.branchOpenDate,
      cashLimit: organization.cashLimit,
      fingerPrintDeviceType: organization.fingerPrintDeviceType,
      lenderType: '',
      panNumber: '',
      gstNumber: '',
      panDocument: null,
      gstDocument: null,
      state: '',
      district: ''
    })
    // Find the organization type for the selected parent branch ID
    // If organizationTypes is loaded, set it immediately, otherwise useEffect will handle it
    if (organizationTypes.length > 0) {
      const parentOrgType = organizationTypes.find((org: OrganizationItem) => org.id === organization.parentBranchId)
      setSelectedOrgType(parentOrgType ? `${parentOrgType.id}-${parentOrgType.branchName}` : '')
    } else {
      // Reset selectedOrgType, useEffect will set it when organizationTypes loads
      setSelectedOrgType('')
    }
    
    // Fetch organization details to populate conditional fields
    try {
      const orgDetails: any = await apiService.get(`/organizations/org-details/${organization.id}`)
      
      // Update form data with the fetched organization details
      setFormData(prev => ({
        ...prev,
        panNumber: orgDetails.panNumber || '',
        gstNumber: orgDetails.gstNumber || '',
        lenderType: orgDetails.typeOfLender || '',
        state: orgDetails.state || '',
        district: orgDetails.district || ''
      }))
      
      // Store existing document information for download functionality
      setExistingPanDocument(orgDetails.pan_document || null)
      setExistingGstDocument(orgDetails.gst_document || null)
    } catch (err) {
      console.error('Error fetching organization details:', err)
      // Continue with opening the dialog even if details fetch fails
      setExistingPanDocument(null)
      setExistingGstDocument(null)
    }
    
    setIsEditDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-GB")
    } catch {
      return dateString
    }
  }

  const handleOrgTypeChange = (value: string) => {
    setSelectedOrgType(value)
    const orgId = parseInt(value.split('-')[0])
    setFormData({ ...formData, parentBranchId: orgId })
    setOrgTypeOpen(false)
  }

  // Helper function to check if selected organization type is Lender
  const isLenderType = () => {
    if (!selectedOrgType) return false
    const orgName = selectedOrgType.split('-').slice(1).join('-').toLowerCase()
    return orgName.includes('lender')
  }

  // Helper function to check if selected organization type is Municipality
  const isMunicipalityType = () => {
    if (!selectedOrgType) return false
    const orgName = selectedOrgType.split('-').slice(1).join('-').toLowerCase()
    return orgName.includes('municipality')
  }

  // Fetch municipalities from API (for Municipality type)
  const {
    data: municipalitiesData,
    isLoading: loadingMunicipalities,
  } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const response = await apiService.get("/master/municipalities")
      // Extract data array from response: { status, message, data: [{ id, state, municipality, ... }] }
      const data = (response as any)?.data || []
      return data.map((item: any) => ({
        municipality: item.municipality,
        state: item.state
      }))
    },
    enabled: isMunicipalityType(), // Only fetch when municipality type is selected
  })

  // Helper function to get organization type from parentBranchId
  const getOrganizationType = (parentBranchId: number): 'lender' | 'municipality' => {
    const orgType = organizationTypes.find((org: OrganizationItem) => org.id === parentBranchId)
    if (!orgType) return 'lender' // Default
    const orgName = orgType.branchName.toLowerCase()
    return orgName.includes('municipality') ? 'municipality' : 'lender'
  }

  // Open fee configuration dialog
  const handleOpenFeeConfig = (organization: Organization) => {
    const orgType = getOrganizationType(organization.parentBranchId)
    setSelectedOrgForFeeConfig({
      id: organization.id,
      name: organization.branchName,
      type: orgType,
      parentBranchId: organization.parentBranchId,
    })
    setIsFeeConfigDialogOpen(true)
  }

  // Helper function to build FormData with all fields and files
  const buildFormData = (includeIdAndVersion: boolean = false, overrideParentBranchId?: number, overrideBankId?: number): FormData => {
    const formDataObj = new FormData()
    
    // Append basic fields (always included for all organization types)
    formDataObj.append('bankId', String(overrideBankId ?? formData.bankId))
    formDataObj.append('parentBranchId', String(overrideParentBranchId ?? formData.parentBranchId))
    formDataObj.append('branchName', formData.branchName)
    formDataObj.append('branchMailId', formData.branchMailId)
    formDataObj.append('pinCode', String(parseInt(formData.pinCode)))
    formDataObj.append('branchOpenDate', formData.branchOpenDate)
    formDataObj.append('cashLimit', String(formData.cashLimit))
    formDataObj.append('fingerPrintDeviceType', formData.fingerPrintDeviceType)
    
    // Append id and version if editing
    if (includeIdAndVersion && editingOrganization) {
      formDataObj.append('id', String(editingOrganization.id))
      formDataObj.append('version', String(editingOrganization.version))
    }
    
    // Append conditional fields based on organization type
    if (isLenderType()) {
      if (formData.lenderType) formDataObj.append('lenderType', formData.lenderType)
      if (formData.panNumber) formDataObj.append('panNumber', formData.panNumber)
      if (formData.gstNumber) formDataObj.append('gstNumber', formData.gstNumber)
      // Append files - ensure they are File instances
      if (formData.panDocument instanceof File) {
        formDataObj.append('panDocument', formData.panDocument, formData.panDocument.name)
      }
      if (formData.gstDocument instanceof File) {
        formDataObj.append('gstDocument', formData.gstDocument, formData.gstDocument.name)
      }
    } else if (isMunicipalityType()) {
      if (formData.state) formDataObj.append('state', formData.state)
      if (formData.district) formDataObj.append('district', formData.district)
      if (formData.panNumber) formDataObj.append('panNumber', formData.panNumber)
      if (formData.gstNumber) formDataObj.append('gstNumber', formData.gstNumber)
      // Append files - ensure they are File instances
      if (formData.panDocument instanceof File) {
        formDataObj.append('panDocument', formData.panDocument, formData.panDocument.name)
      }
      if (formData.gstDocument instanceof File) {
        formDataObj.append('gstDocument', formData.gstDocument, formData.gstDocument.name)
      }
    }
    // For other organization types, only basic fields are sent (no conditional fields)
    // This ensures FormData is always used regardless of organization type
    
    return formDataObj
  }

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Handle file change
  const handleFileChange = (
    field: 'panDocument' | 'gstDocument', 
    file: File | null
  ) => {
    setFormData(prev => ({ ...prev, [field]: file }))
    // Clear existing document when user uploads a new file
    if (file && field === 'panDocument') {
      setExistingPanDocument(null)
    }
    if (file && field === 'gstDocument') {
      setExistingGstDocument(null)
    }
  }

  // Handle file download
  const handleDownloadFile = async (fileId: number, filename: string) => {
    try {
      // Use axios directly to get blob response
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob'
      })
      
      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      alerts.success('Success', 'File downloaded successfully')
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to download file. Please try again.'
      alerts.error('Error', errorMessage)
      console.error('Error downloading file:', err)
    }
  }

  const columns: ColumnDef<Organization, any>[] = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      enableSorting: true,
    },
    {
      accessorKey: 'branchName',
      header: 'Organisation Name',
      cell: ({ row }) => <span className="font-medium">{row.original.branchName}</span>,
    },
    {
      header: 'Organisation Type',
      cell: ({ row }) => <span className="font-medium">{organizationTypeMap.get(row.original.parentBranchId) || "Unknown"}</span>,
    },
    {
      accessorKey: 'branchMailId',
      header: 'Email',
      cell: ({ row }) => <span className="text-sm">{row.original.branchMailId}</span>,
    },
    {
      accessorKey: 'pinCode',
      header: 'Pin Code',
      cell: ({ row }) => <span className="font-medium">{row.original.pinCode}</span>,
    },
    {
      accessorKey: 'branchOpenDate',
      header: 'Open Date',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.branchOpenDate)}</span>,
    },
    // {
    //   accessorKey: 'fingerPrintDeviceType',
    //   header: 'Device Type',
    //   cell: ({ row }) => (
    //     <Badge variant="secondary">
    //       {row.original.fingerPrintDeviceType}
    //     </Badge>
    //   ),
    // },
    {
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(row.original)}
            title="Edit Organization"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenFeeConfig(row.original)}
            title="Configure Fees"
          >
            <DollarSign className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [openEditDialog, handleOpenFeeConfig])

  return (
    <div className="space-y-6">
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Create New Organization</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add a new organization to the system with all required details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parentBranchId" className="text-sm font-medium">
                  Organization Type *
                </Label>
                <Popover open={orgTypeOpen} onOpenChange={setOrgTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={orgTypeOpen}
                      className="w-full justify-between h-10"
                      disabled={submitting || loadingOrgTypes}
                    >
                      <div className="flex items-center text-gray-500 font-normal">
                        <Building2 className="mr-3 h-4 w-4 text-gray-400" />
                        {loadingOrgTypes ? (
                          <span className="flex items-center gap-2"><Spinner size={16} /> Loading organization types...</span>
                        ) : selectedOrgType
                          ? organizationTypes.find((org: OrganizationItem) => `${org.id}-${org.branchName}` === selectedOrgType)?.branchName
                          : "Select organization type"}
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    {loadingOrgTypes ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Spinner size={16} /> Loading organization types...</div>
                    ) : (
                      <Command>
                        <CommandInput placeholder="Search organization types..." />
                        <CommandList>
                          <CommandEmpty>No organization type found.</CommandEmpty>
                          <CommandGroup>
                            {organizationTypes.map((org: OrganizationItem) => (
                              <CommandItem
                                key={org.id}
                                value={org.branchName}
                                onSelect={() => handleOrgTypeChange(`${org.id}-${org.branchName}`)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedOrgType === `${org.id}-${org.branchName}` ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{org.branchName}</span>
                                  <span className="text-xs text-muted-foreground">ID: {org.id}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchName" className="text-sm font-medium">
                  Organization Name *
                </Label>
                {isMunicipalityType() ? (
                  <Popover open={municipalityOpen} onOpenChange={setMunicipalityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={municipalityOpen}
                        className="w-full justify-between h-10"
                        disabled={submitting || loadingMunicipalities}
                      >
                        <div className="flex items-center text-gray-500 font-normal">
                          {loadingMunicipalities ? (
                            <span className="flex items-center gap-2"><Spinner size={16} /> Loading municipalities...</span>
                          ) : formData.branchName || "Select municipality"}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      {loadingMunicipalities ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Spinner size={16} /> Loading municipalities...</div>
                      ) : (
                        <Command>
                          <CommandInput placeholder="Search municipalities..." />
                          <CommandList>
                            <CommandEmpty>No municipality found.</CommandEmpty>
                            <CommandGroup>
                              {municipalitiesData?.map((item: { municipality: string; state: string }) => (
                                <CommandItem
                                  key={item.municipality}
                                  value={item.municipality}
                                  onSelect={() => {
                                    setFormData({ ...formData, branchName: item.municipality, state: item.state })
                                    setMunicipalityOpen(false)
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formData.branchName === item.municipality ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <span>{item.municipality}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      )}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    id="branchName"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="h-10"
                    placeholder="Enter organization name"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchMailId" className="text-sm font-medium">
                  Organization Email *
                </Label>
                <Input
                  id="branchMailId"
                  type="email"
                  value={formData.branchMailId}
                  onChange={(e) => setFormData({ ...formData, branchMailId: e.target.value })}
                  className="h-10"
                  placeholder="Enter organization email"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="pinCode" className="text-sm font-medium">
                  Pin Code *
                </Label>
                  <Input
                    id="pinCode"
                    type="text"
                    value={formData.pinCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '') // Only allow digits
                      if (value.length <= 6) {
                        setFormData({ ...formData, pinCode: value })
                      }
                    }}
                    className="h-10"
                    placeholder="Enter 6-digit pin code"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branchOpenDate" className="text-sm font-medium">
                    Organization Open Date *
                  </Label>
                  <DatePicker
                    value={formData.branchOpenDate ? new Date(formData.branchOpenDate.replace(/-/g, "/")) : undefined}
                    onChange={(d) => {
                      const yyyyMmDd = d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : ""
                      setFormData({ ...formData, branchOpenDate: yyyyMmDd })
                    }}
                    disableFutureDates
                  />
                </div>
              </div>

              {/* Conditional Fields for Lender */}
              {isLenderType() && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900">Lender Details</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lenderType" className="text-sm font-medium">
                      Type of Lender *
                    </Label>
                    <Select
                      value={formData.lenderType}
                      onValueChange={(value) => setFormData({ ...formData, lenderType: value })}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select type of lender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank">Bank</SelectItem>
                        <SelectItem value="NBFC">NBFC</SelectItem>
                        <SelectItem value="Multilateral">Multilateral</SelectItem>
                        <SelectItem value="Philanthropy">Philanthropy</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="panNumber" className="text-sm font-medium">
                        PAN Number *
                      </Label>
                      <Input
                        id="panNumber"
                        value={formData.panNumber || ''}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter PAN number"
                        maxLength={10}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstNumber" className="text-sm font-medium">
                        GST Number *
                      </Label>
                      <Input
                        id="gstNumber"
                        value={formData.gstNumber || ''}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter GST number"
                        maxLength={15}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="panDocument" className="text-sm font-medium">
                        PAN Document Upload *
                      </Label>
                      <Input
                        id="panDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          handleFileChange('panDocument', file)
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.panDocument && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div className="flex items-center space-x-2">
                            <FileIcon className="h-4 w-4" />
                            <span className="text-sm">{formData.panDocument.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(formData.panDocument.size)})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileChange('panDocument', null)}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload PAN document (PDF, JPG, PNG)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstDocument" className="text-sm font-medium">
                        GST Document Upload *
                      </Label>
                      <Input
                        id="gstDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          handleFileChange('gstDocument', file)
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.gstDocument && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div className="flex items-center space-x-2">
                            <FileIcon className="h-4 w-4" />
                            <span className="text-sm">{formData.gstDocument.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(formData.gstDocument.size)})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileChange('gstDocument', null)}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload GST document (PDF, JPG, PNG)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Fields for Municipality */}
              {isMunicipalityType() && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900">Municipality Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-medium">
                        State *
                      </Label>
                      <Input
                        id="state"
                        value={formData.state || ''}
                        className="h-10 bg-muted"
                        placeholder="State will be auto-filled"
                        disabled={true}
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">
                        State will be automatically filled when you select a municipality
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="district" className="text-sm font-medium">
                        District *
                      </Label>
                      <Input
                        id="district"
                        value={formData.district || ''}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="h-10"
                        placeholder="Enter district"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="panNumberMunicipality" className="text-sm font-medium">
                        PAN Number *
                      </Label>
                      <Input
                        id="panNumberMunicipality"
                        value={formData.panNumber || ''}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter PAN number"
                        maxLength={10}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstNumberMunicipality" className="text-sm font-medium">
                        GST Number *
                      </Label>
                      <Input
                        id="gstNumberMunicipality"
                        value={formData.gstNumber || ''}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter GST number"
                        maxLength={15}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="panDocumentMunicipality" className="text-sm font-medium">
                        PAN Document Upload *
                      </Label>
                      <Input
                        id="panDocumentMunicipality"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          handleFileChange('panDocument', file)
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.panDocument && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div className="flex items-center space-x-2">
                            <FileIcon className="h-4 w-4" />
                            <span className="text-sm">{formData.panDocument.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(formData.panDocument.size)})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileChange('panDocument', null)}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload PAN document (PDF, JPG, PNG)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstDocumentMunicipality" className="text-sm font-medium">
                        GST Document Upload *
                      </Label>
                      <Input
                        id="gstDocumentMunicipality"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          handleFileChange('gstDocument', file)
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.gstDocument && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div className="flex items-center space-x-2">
                            <FileIcon className="h-4 w-4" />
                            <span className="text-sm">{formData.gstDocument.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(formData.gstDocument.size)})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileChange('gstDocument', null)}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload GST document (PDF, JPG, PNG)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrganization} disabled={submitting}>
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading organizations...</div>
        </div>
      ) : organizations.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No organizations</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating a new organization.
          </p>
        </div>
      ) : (
        <DataTable<Organization, any>
          title="Organizations"
          description="Manage organization branches and details"
          columns={columns}
          data={organizations}
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Organization
              </Button>
            </div>
          }
          showToolbar={true}
          showFooter={true}
          enableExport={true}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          // Reset form and state when dialog closes
          resetForm()
          setEditingOrganization(null)
          setExistingPanDocument(null)
          setExistingGstDocument(null)
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Organization</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update the organization information and details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Organization ID</Label>
                <div className="h-10 px-3 py-2 text-sm bg-muted rounded-md border flex items-center">
                  {editingOrganization?.id ?? '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editParentBranchId" className="text-sm font-medium">
                  Organization Type *
                </Label>
                <Popover open={orgTypeOpen} onOpenChange={setOrgTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={orgTypeOpen}
                      className="w-full justify-between h-10"
                      disabled={submitting || loadingOrgTypes}
                    >
                      <div className="flex items-center text-gray-500 font-normal">
                        <Building2 className="mr-3 h-4 w-4 text-gray-400" />
                        {loadingOrgTypes ? (
                          <span className="flex items-center gap-2"><Spinner size={16} /> Loading organization types...</span>
                        ) : selectedOrgType
                          ? organizationTypes.find((org: OrganizationItem) => `${org.id}-${org.branchName}` === selectedOrgType)?.branchName
                          : "Select organization type"}
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    {loadingOrgTypes ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Spinner size={16} /> Loading organization types...</div>
                    ) : (
                      <Command>
                        <CommandInput placeholder="Search organization types..." />
                        <CommandList>
                          <CommandEmpty>No organization type found.</CommandEmpty>
                          <CommandGroup>
                            {organizationTypes.map((org: OrganizationItem) => (
                              <CommandItem
                                key={org.id}
                                value={org.branchName}
                                onSelect={() => handleOrgTypeChange(`${org.id}-${org.branchName}`)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedOrgType === `${org.id}-${org.branchName}` ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{org.branchName}</span>
                                  <span className="text-xs text-muted-foreground">ID: {org.id}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editBranchName" className="text-sm font-medium">
                  Organization Name *
                </Label>
                {isMunicipalityType() ? (
                  <Popover open={municipalityOpen} onOpenChange={setMunicipalityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={municipalityOpen}
                        className="w-full justify-between h-10"
                        disabled={submitting || loadingMunicipalities}
                      >
                        <div className="flex items-center text-gray-500 font-normal">
                          {loadingMunicipalities ? (
                            <span className="flex items-center gap-2"><Spinner size={16} /> Loading municipalities...</span>
                          ) : formData.branchName || "Select municipality"}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      {loadingMunicipalities ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Spinner size={16} /> Loading municipalities...</div>
                      ) : (
                        <Command>
                          <CommandInput placeholder="Search municipalities..." />
                          <CommandList>
                            <CommandEmpty>No municipality found.</CommandEmpty>
                            <CommandGroup>
                              {municipalitiesData?.map((item: { municipality: string; state: string }) => (
                                <CommandItem
                                  key={item.municipality}
                                  value={item.municipality}
                                  onSelect={() => {
                                    setFormData({ ...formData, branchName: item.municipality, state: item.state })
                                    setMunicipalityOpen(false)
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formData.branchName === item.municipality ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <span>{item.municipality}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      )}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    id="editBranchName"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="h-10"
                    placeholder="Enter organization name"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="editBranchMailId" className="text-sm font-medium">
                  Organization Email *
                </Label>
                <Input
                  id="editBranchMailId"
                  type="email"
                  value={formData.branchMailId}
                  onChange={(e) => setFormData({ ...formData, branchMailId: e.target.value })}
                  className="h-10"
                  placeholder="Enter organization email"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editPinCode" className="text-sm font-medium">
                    Pin Code *
                  </Label>
                  <Input
                    id="editPinCode"
                    type="text"
                    value={formData.pinCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '') // Only allow digits
                      if (value.length <= 6) {
                        setFormData({ ...formData, pinCode: value })
                      }
                    }}
                    className="h-10"
                    placeholder="Enter 6-digit pin code"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editBranchOpenDate" className="text-sm font-medium">
                    Organization Open Date *
                  </Label>
                  <DatePicker
                    value={formData.branchOpenDate ? new Date(formData.branchOpenDate) : undefined}
                    onChange={(d) => {
                      const yyyyMmDd = d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : ""
                      setFormData({ ...formData, branchOpenDate: yyyyMmDd })
                    }}
                  />
                </div>
              </div>

              {/* Conditional Fields for Lender */}
              {isLenderType() && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900">Lender Details</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="editLenderType" className="text-sm font-medium">
                      Type of Lender *
                    </Label>
                    <Select
                      value={formData.lenderType}
                      onValueChange={(value) => setFormData({ ...formData, lenderType: value })}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select type of lender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank">Bank</SelectItem>
                        <SelectItem value="NBFC">NBFC</SelectItem>
                        <SelectItem value="Multilateral">Multilateral</SelectItem>
                        <SelectItem value="Philanthropy">Philanthropy</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPanNumber" className="text-sm font-medium">
                        PAN Number *
                      </Label>
                      <Input
                        id="editPanNumber"
                        value={formData.panNumber || ''}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter PAN number"
                        maxLength={10}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editGstNumber" className="text-sm font-medium">
                        GST Number *
                      </Label>
                      <Input
                        id="editGstNumber"
                        value={formData.gstNumber || ''}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter GST number"
                        maxLength={15}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPanDocument" className="text-sm font-medium">
                        PAN Document {existingPanDocument && !formData.panDocument ? '' : '*'}
                      </Label>
                      {existingPanDocument && !formData.panDocument && (
                        // Show download option if document exists and no new file uploaded
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md border mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{existingPanDocument.original_filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(existingPanDocument.file_size)} • {existingPanDocument.mime_type}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(existingPanDocument.id, existingPanDocument.original_filename)}
                            disabled={submitting}
                            className="ml-2 flex-shrink-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      )}
                      {(!existingPanDocument || formData.panDocument) && (
                        // Show upload input if no existing document or user wants to replace
                        <>
                          <Input
                            id="editPanDocument"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleFileChange('panDocument', file)
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.panDocument && (
                            <div className="flex items-center justify-between p-2 bg-muted rounded-md mt-2">
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="text-sm">{formData.panDocument.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({formatFileSize(formData.panDocument.size)})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileChange('panDocument', null)}
                                disabled={submitting}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {existingPanDocument && !formData.panDocument 
                          ? 'Click download to view existing document, or upload a new file to replace it'
                          : 'Upload PAN document (PDF, JPG, PNG)'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editGstDocument" className="text-sm font-medium">
                        GST Document {existingGstDocument && !formData.gstDocument ? '' : '*'}
                      </Label>
                      {existingGstDocument && !formData.gstDocument && (
                        // Show download option if document exists and no new file uploaded
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md border mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{existingGstDocument.original_filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(existingGstDocument.file_size)} • {existingGstDocument.mime_type}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(existingGstDocument.id, existingGstDocument.original_filename)}
                            disabled={submitting}
                            className="ml-2 flex-shrink-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      )}
                      {(!existingGstDocument || formData.gstDocument) && (
                        // Show upload input if no existing document or user wants to replace
                        <>
                          <Input
                            id="editGstDocument"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleFileChange('gstDocument', file)
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.gstDocument && (
                            <div className="flex items-center justify-between p-2 bg-muted rounded-md mt-2">
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="text-sm">{formData.gstDocument.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({formatFileSize(formData.gstDocument.size)})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileChange('gstDocument', null)}
                                disabled={submitting}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {existingGstDocument && !formData.gstDocument 
                          ? 'Click download to view existing document, or upload a new file to replace it'
                          : 'Upload GST document (PDF, JPG, PNG)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Fields for Municipality */}
              {isMunicipalityType() && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900">Municipality Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editState" className="text-sm font-medium">
                        State *
                      </Label>
                      <Input
                        id="editState"
                        value={formData.state || ''}
                        className="h-10 bg-muted"
                        placeholder="State will be auto-filled"
                        disabled={true}
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">
                        State will be automatically filled when you select a municipality
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editDistrict" className="text-sm font-medium">
                        District *
                      </Label>
                      <Input
                        id="editDistrict"
                        value={formData.district || ''}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="h-10"
                        placeholder="Enter district"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPanNumberMunicipality" className="text-sm font-medium">
                        PAN Number *
                      </Label>
                      <Input
                        id="editPanNumberMunicipality"
                        value={formData.panNumber || ''}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter PAN number"
                        maxLength={10}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editGstNumberMunicipality" className="text-sm font-medium">
                        GST Number *
                      </Label>
                      <Input
                        id="editGstNumberMunicipality"
                        value={formData.gstNumber || ''}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        className="h-10"
                        placeholder="Enter GST number"
                        maxLength={15}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPanDocumentMunicipality" className="text-sm font-medium">
                        PAN Document {existingPanDocument && !formData.panDocument ? '' : '*'}
                      </Label>
                      {existingPanDocument && !formData.panDocument && (
                        // Show download option if document exists and no new file uploaded
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md border mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{existingPanDocument.original_filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(existingPanDocument.file_size)} • {existingPanDocument.mime_type}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(existingPanDocument.id, existingPanDocument.original_filename)}
                            disabled={submitting}
                            className="ml-2 flex-shrink-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      )}
                      {(!existingPanDocument || formData.panDocument) && (
                        // Show upload input if no existing document or user wants to replace
                        <>
                          <Input
                            id="editPanDocumentMunicipality"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleFileChange('panDocument', file)
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.panDocument && (
                            <div className="flex items-center justify-between p-2 bg-muted rounded-md mt-2">
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="text-sm">{formData.panDocument.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({formatFileSize(formData.panDocument.size)})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileChange('panDocument', null)}
                                disabled={submitting}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {existingPanDocument && !formData.panDocument 
                          ? 'Click download to view existing document, or upload a new file to replace it'
                          : 'Upload PAN document (PDF, JPG, PNG)'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editGstDocumentMunicipality" className="text-sm font-medium">
                        GST Document {existingGstDocument && !formData.gstDocument ? '' : '*'}
                      </Label>
                      {existingGstDocument && !formData.gstDocument && (
                        // Show download option if document exists and no new file uploaded
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md border mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{existingGstDocument.original_filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(existingGstDocument.file_size)} • {existingGstDocument.mime_type}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(existingGstDocument.id, existingGstDocument.original_filename)}
                            disabled={submitting}
                            className="ml-2 flex-shrink-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      )}
                      {(!existingGstDocument || formData.gstDocument) && (
                        // Show upload input if no existing document or user wants to replace
                        <>
                          <Input
                            id="editGstDocumentMunicipality"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleFileChange('gstDocument', file)
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.gstDocument && (
                            <div className="flex items-center justify-between p-2 bg-muted rounded-md mt-2">
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="text-sm">{formData.gstDocument.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({formatFileSize(formData.gstDocument.size)})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileChange('gstDocument', null)}
                                disabled={submitting}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {existingGstDocument && !formData.gstDocument 
                          ? 'Click download to view existing document, or upload a new file to replace it'
                          : 'Upload GST document (PDF, JPG, PNG)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleEditOrganization} disabled={submitting}>
              Update Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Configuration Dialog */}
      {selectedOrgForFeeConfig && (
        <FeeConfigurationDialog
          open={isFeeConfigDialogOpen}
          onOpenChange={(open) => {
            setIsFeeConfigDialogOpen(open)
            if (!open) {
              setSelectedOrgForFeeConfig(null)
            }
          }}
          organizationId={selectedOrgForFeeConfig.id}
          organizationName={selectedOrgForFeeConfig.name}
          organizationType={selectedOrgForFeeConfig.type}
          parentBranchId={selectedOrgForFeeConfig.parentBranchId}
        />
      )}
    </div>
  )
}
